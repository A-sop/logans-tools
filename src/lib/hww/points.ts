/** Student-points scoring for wisdom-log rows (BPL 17 May 71 RC II). */

export type WisdomKind = 'page' | 'demo' | 'clay_demo' | 'word' | 'checksheet_item' | 'wbt_module';

export type WisdomRow = {
  date: string;
  kind: string;
  demo_form: string;
  area: string;
  count: number;
  pointsTyped: string;
  title: string;
  source_ref: string;
  path: string;
  checkout: string;
  hours: string;
  notes: string;
  lineNo: number;
};

export type PointsResult = {
  points: number;
  ignoredTypedPoints: boolean;
  flags: string[];
};

export function computePoints(row: WisdomRow): PointsResult {
  const flags: string[] = [];
  const count = Number.isFinite(row.count) && row.count > 0 ? row.count : 1;
  let points = 0;
  const kind = row.kind.trim();
  const checkout = row.checkout.trim().toLowerCase();
  const form = row.demo_form.trim();

  if (kind === 'page') {
    points = 3 * count;
  } else if (kind === 'demo') {
    points = 10 * count;
    if (!row.path.trim()) flags.push('no evidence');
  } else if (kind === 'clay_demo') {
    if (form === 'labelled_diagram') {
      if (checkout === 'pass') points = 25 * count;
      else if (checkout === 'flunk') {
        points = 0;
        flags.push('redo');
      } else {
        points = 0;
        flags.push('awaiting checkout');
      }
    } else {
      points = 25 * count;
    }
    if (!row.path.trim()) flags.push('no evidence');
  } else {
    points = 0;
  }

  const ignoredTypedPoints = Boolean(row.pointsTyped.trim());
  if (ignoredTypedPoints) flags.push('typed points ignored');

  return { points, ignoredTypedPoints, flags };
}
