/**
 * Ship-gate emit: after Dept13 PASS + ship-log Counts=yes, write Div4 shipped_outputs.
 * Reads cumulative Counts=yes from ship-log (same basis as Thursday poster).
 */
import { existsSync, readFileSync } from 'fs';
import path from 'path';

import type { DabosSql } from '@/lib/dabos/dabos-connection';
import { countShippedOutputs } from '@/lib/dabos/division-weekly-stats';
import { emitStat } from '@/lib/dabos/stats-emit';

const SHIP_LOG = path.join('C:', 'Dev', 'DABOS', 'docs', 'registers', 'ship-log.md');

export type ShipGateEmitResult = {
  shippedOutputs: number;
  inserted: string[];
  workspaceId: string;
  notes: string[];
};

export async function emitShippedOutputsFromShipLog(opts: {
  dabosSql: DabosSql;
  /** Optional ship-log row # for provenance */
  shipRow?: number;
  shipLogPath?: string;
}): Promise<ShipGateEmitResult> {
  const shipLogPath = opts.shipLogPath ?? SHIP_LOG;
  const notes: string[] = [];
  const inserted: string[] = [];

  if (!existsSync(shipLogPath)) {
    return {
      shippedOutputs: 0,
      inserted,
      workspaceId: '',
      notes: [`ship-log missing: ${shipLogPath}`],
    };
  }

  const md = readFileSync(shipLogPath, 'utf8');
  const shipped = countShippedOutputs(md);
  const day = new Date().toISOString().slice(0, 10);
  const workspaceId =
    opts.shipRow != null
      ? `ship-gate-${day}-row${opts.shipRow}`
      : `ship-gate-${day}-${Date.now()}`;

  const basis = {
    path: shipLogPath,
    note: 'Dept13 PASS → ship-log Counts=yes cumulative',
    ship_row: opts.shipRow ?? null,
  };

  for (const dept of [null, 'Dept12'] as const) {
    const result = await emitStat(opts.dabosSql, {
      workspaceId,
      divisionId: 'Div4',
      departmentId: dept,
      metricKey: 'shipped_outputs',
      value: shipped,
      basis,
      recordedBy: 'ship-gate',
      mode: 'insert_always',
    });
    if (result.inserted) {
      inserted.push(dept ? `Div4.Dept12.shipped_outputs` : `Div4.shipped_outputs`);
    }
  }

  notes.push(`shipped_outputs=${shipped} via ${workspaceId}`);
  return { shippedOutputs: shipped, inserted, workspaceId, notes };
}
