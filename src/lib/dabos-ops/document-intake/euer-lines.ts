/** Curated EÜR Zeilen for tax_beleg naming — mirror of euer-line-codes.md common expense lines. */

export interface EuerLineEntry {
  zeile: string;
  kurzbezeichnungDe: string;
  keywords: RegExp[];
}

export const COMMON_EUER_LINES: EuerLineEntry[] = [
  { zeile: '49', kurzbezeichnungDe: 'Telekommunikation', keywords: [/telekom|vodafone|o2|telefon|internet|netcologne/i] },
  { zeile: '51', kurzbezeichnungDe: 'Fortbildung', keywords: [/fortbildung|seminar|kurs|training|weiterbildung/i] },
  { zeile: '52', kurzbezeichnungDe: 'Rechts-Steuerberatung', keywords: [/steuerberat|rechtsanwalt|notar|buchf[uü]hrung/i] },
  { zeile: '46', kurzbezeichnungDe: 'Miete-Geschaeftsraum', keywords: [/miete|pacht|gesch[aä]ftsraum/i] },
  { zeile: '56', kurzbezeichnungDe: 'EDV-Kosten', keywords: [/software|hosting|saas|edv|it-?support|cursor|microsoft|adobe/i] },
  { zeile: '57', kurzbezeichnungDe: 'Arbeitsmittel', keywords: [/b[uü]robedarf|office|postage|porto|fachliteratur/i] },
  { zeile: '55', kurzbezeichnungDe: 'Beitraege-Versicherungen', keywords: [/versicherung|beitrag|ihk|kammer/i] },
  { zeile: '53', kurzbezeichnungDe: 'Leasing-beweglich', keywords: [/leasing/i] },
  { zeile: '81', kurzbezeichnungDe: 'Leasing-Kfz', keywords: [/leasing.*kfz|kfz.*leasing/i] },
  { zeile: '82', kurzbezeichnungDe: 'Kfz-Abgaben', keywords: [/kfz|kraftfahrzeug|fahrzeugsteuer/i] },
  { zeile: '83', kurzbezeichnungDe: 'Kfz-Fahrtkosten', keywords: [/tankstelle|treibstoff|reparatur.*auto/i] },
  { zeile: '27', kurzbezeichnungDe: 'Fremdleistungen', keywords: [/fremdleistung|subunternehmer|dienstleistung/i] },
  { zeile: '28', kurzbezeichnungDe: 'Personalaufwand', keywords: [/gehalt|lohn|personal/i] },
  { zeile: '63', kurzbezeichnungDe: 'Vorsteuer', keywords: [/vorsteuer|ust.*rechnung/i] },
  { zeile: '66', kurzbezeichnungDe: 'Sonstige-BA', keywords: [/sonstige.*ausgabe|betriebsausgabe/i] },
  { zeile: '26', kurzbezeichnungDe: 'Waren-Rohstoffe', keywords: [/waren|rohstoff|einkauf/i] },
];

export function matchEuerLine(text: string): { entry: EuerLineEntry; confidence: number } | null {
  const haystack = text.slice(0, 4000);
  let best: { entry: EuerLineEntry; score: number } | null = null;

  for (const entry of COMMON_EUER_LINES) {
    for (const keyword of entry.keywords) {
      if (keyword.test(haystack)) {
        const score = 0.55 + entry.keywords.length * 0.02;
        if (!best || score > best.score) {
          best = { entry, score: Math.min(0.92, score) };
        }
        break;
      }
    }
  }

  if (!best) return null;
  return { entry: best.entry, confidence: best.score };
}
