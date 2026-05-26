# Copy booking suggestions + account map from C:\DATA for Vercel bundle (no Zoho API).
$ErrorActionPreference = 'Stop'
$srcRoot = 'C:\DATA\20_ADMIN'
$dest = Join-Path $PSScriptRoot '..' 'src' 'data' 'euer' | Resolve-Path

Copy-Item (Join-Path $srcRoot '!!_ZOHO-BOOKS\zoho-account-eur-map.csv') (Join-Path $dest 'account-eur-map.csv') -Force

Get-ChildItem (Join-Path $srcRoot '!!_ZOHO-BOOKS\logs\zoho-working\euer-summary-*.csv') -ErrorAction SilentlyContinue |
  Copy-Item -Destination $dest -Force

foreach ($dir in Get-ChildItem $srcRoot -Directory -Filter '!_TAXES-*') {
  $year = ($dir.Name -replace '^!_TAXES-', '')
  Get-ChildItem $dir.FullName -Filter '*-booking-suggestions.csv' | ForEach-Object {
    $outName = "suggestions-$year-$($_.BaseName).csv"
    Copy-Item $_.FullName (Join-Path $dest $outName) -Force
  }
}

python -c @"
import json, openpyxl
from pathlib import Path
p = Path(r'$srcRoot') / '!!_TAX-ADMIN' / '250111_LDW_EÜR-seit2020-m-Vorlage.xlsx'
wb = openpyxl.load_workbook(p, read_only=True, data_only=True)
ws = wb['EÜR_lists']
labels = {}
for r in range(2, ws.max_row + 1):
    t = ws.cell(r, 1).value
    if t and ' - ' in str(t):
        z = str(t).split(' - ', 1)[0].strip()
        labels[z] = str(t).strip()
wb.close()
Path(r'$dest').joinpath('eur-zeile-labels.json').write_text(json.dumps(labels, ensure_ascii=False, indent=2), encoding='utf-8')
print('eur-zeile-labels.json', len(labels), 'zeilen')
"@

$exportPy = Join-Path $PSScriptRoot 'export-workbook-transactions.py'
if (Test-Path $exportPy) {
  python $exportPy --master (Join-Path $srcRoot '!!_TAX-ADMIN\250111_LDW_EÜR-seit2020-m-Vorlage.xlsx') --dest $dest
}

$zohoBooks = Join-Path $srcRoot '!!_ZOHO-BOOKS'
foreach ($y in 2020..2026) {
  python (Join-Path $zohoBooks 'scripts\euer_workbook.py') summarize --year $y 2>$null
}
Get-ChildItem (Join-Path $zohoBooks 'logs\zoho-working\euer-summary-*.csv') -ErrorAction SilentlyContinue |
  Copy-Item -Destination $dest -Force

Write-Host "Bundled EÜR data in $dest"
