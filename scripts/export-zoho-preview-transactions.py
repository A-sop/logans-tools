#!/usr/bin/env python3
"""
Export on-disk Zoho Books working CSVs to JSON for LDW Books UI (no live API).

Sources:
  - logs/zoho-working/db-apply-*-preview.csv
  - logs/zoho-working/_archive/**/paypal-wrapup/YYYY-all.csv

Monthly *-preview.csv files are often header-only; skipped when empty.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from datetime import date
from pathlib import Path

DEFAULT_ZOHO = Path(r'C:\DATA\20_ADMIN\!!_ZOHO-BOOKS')
DEFAULT_CHART = DEFAULT_ZOHO / 'Chart_of_Accounts.csv'
LOG_DIR = DEFAULT_ZOHO / 'logs' / 'zoho-working'


def load_chart_codes(chart_path: Path) -> dict[str, str]:
    by_name: dict[str, str] = {}
    if not chart_path.is_file():
        return by_name
    with chart_path.open(encoding='utf-8-sig', newline='') as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            name = (row.get('Account Name') or '').strip()
            code = (row.get('Account Code') or '').strip()
            if name and code:
                by_name[name] = code
    return by_name


def format_date(raw: str) -> str:
    raw = (raw or '').strip()[:10]
    if not raw:
        return ''
    if re.match(r'^\d{4}-\d{2}-\d{2}$', raw):
        y, m, d = raw.split('-')
        return f'{d}.{m}.{y}'
    return raw


def row_from_preview(row: dict, chart: dict[str, str], source: str, bank: str) -> dict | None:
    hat = (row.get('hat') or '').strip().lower()
    if hat in ('transfer', 'private'):
        return None
    amount_raw = row.get('amount') or '0'
    try:
        amount = abs(float(str(amount_raw).replace(',', '.')))
    except ValueError:
        return None
    if amount <= 0:
        return None
    doc = (row.get('debit_or_credit') or '').strip().lower()
    direction = 'in' if doc == 'credit' else 'out'
    account = (row.get('account_name') or '').strip()
    dt = format_date(row.get('date') or '')
    if not dt:
        return None
    return {
        'date': dt,
        'payee': (row.get('payee') or row.get('description') or '').strip() or '—',
        'direction': direction,
        'amount': round(amount, 2),
        'hat': hat or 'business',
        'suggestedAccount': account,
        'skr03': chart.get(account, ''),
        'bank': bank,
        'source': source,
    }


def row_from_paypal(row: dict, chart: dict[str, str], source: str) -> dict | None:
    year = (row.get('year') or '').strip()
    hat = 'business'
    if (row.get('transfer_class') or '').strip().lower().find('transfer') >= 0:
        return None
    ttype = (row.get('transaction_type') or '').strip().lower()
    if ttype == 'transfer_fund':
        return None
    try:
        amount = abs(float(str(row.get('amount_eur') or '0').replace(',', '.')))
    except ValueError:
        return None
    if amount <= 0:
        return None
    direction_raw = (row.get('direction') or '').strip().lower()
    direction = 'in' if direction_raw == 'credit' else 'out'
    account = ''
    dt = format_date(row.get('date') or '')
    if not dt or (year and year not in dt and not dt.endswith(year[-2:])):
        if year and len(year) == 4:
            parts = dt.split('.')
            if len(parts) == 3:
                dt = dt  # already dd.mm.yyyy
    payee = (row.get('payee') or row.get('description') or '').strip() or '—'
    return {
        'date': dt,
        'payee': payee,
        'direction': direction,
        'amount': round(amount, 2),
        'hat': 'income' if direction == 'in' and 'income' in ttype else hat,
        'suggestedAccount': account,
        'skr03': '',
        'bank': 'PayPal',
        'source': source,
    }


def collect_preview_files(zoho_root: Path) -> list[Path]:
    files: list[Path] = []
    log = zoho_root / 'logs' / 'zoho-working'
    if log.is_dir():
        files.extend(sorted(log.glob('db-apply-*-preview.csv')))
        archive = log / '_archive'
        if archive.is_dir():
            files.extend(sorted(archive.glob('**/paypal-wrapup/*-all.csv')))
    return files


def export_year(
    year: int,
    files: list[Path],
    chart: dict[str, str],
    dest: Path,
) -> int:
    seen: set[str] = set()
    rows_out: list[dict] = []

    for path in files:
        with path.open(encoding='utf-8-sig', newline='') as handle:
            reader = csv.DictReader(handle, delimiter=';')
            if not reader.fieldnames:
                continue
            is_paypal = 'amount_eur' in (reader.fieldnames or [])
            for row in reader:
                if is_paypal:
                    if (row.get('year') or '').strip() != str(year):
                        continue
                    mapped = row_from_paypal(row, chart, path.name)
                    bank = 'PayPal'
                else:
                    raw_date = (row.get('date') or '')[:10]
                    if not raw_date.startswith(str(year)):
                        continue
                    bank = 'Zoho Books'
                    if 'n26' in path.name.lower():
                        bank = 'N26 Business'
                    elif 'dkb' in path.name.lower():
                        bank = 'DKB Cash'
                    elif 'db-' in path.name.lower() or 'deutsche' in path.name.lower():
                        bank = 'Deutsche Bank'
                    mapped = row_from_preview(row, chart, path.name, bank)

                if not mapped:
                    continue
                key = (
                    f"{mapped['date']}|{mapped['amount']:.2f}|{mapped['direction']}|"
                    f"{mapped['payee'].casefold()}|{mapped['bank']}"
                )
                if key in seen:
                    continue
                seen.add(key)
                rows_out.append(mapped)

    rows_out.sort(key=lambda r: r['date'])
    payload = {
        'year': year,
        'exported': date.today().isoformat(),
        'source': 'zoho-preview-exports',
        'rows': rows_out,
    }
    dest.parent.mkdir(parents=True, exist_ok=True)
    out = dest / f'transactions-zoho-{year}.json'
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    return len(rows_out)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--zoho-root', type=Path, default=DEFAULT_ZOHO)
    parser.add_argument('--year', type=int, action='append')
    parser.add_argument(
        '--dest',
        type=Path,
        default=Path(__file__).resolve().parent.parent / 'src' / 'data' / 'euer',
    )
    args = parser.parse_args()
    years = args.year or list(range(2020, 2027))
    chart = load_chart_codes(args.zoho_root / 'Chart_of_Accounts.csv')
    files = collect_preview_files(args.zoho_root)

    for year in years:
        n = export_year(year, files, chart, args.dest)
        print(f'{year}: {n} Zoho export rows -> transactions-zoho-{year}.json')


if __name__ == '__main__':
    main()
