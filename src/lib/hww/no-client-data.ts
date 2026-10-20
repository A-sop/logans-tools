/**
 * Fail-closed guard: HWW payloads must not contain DVAG/Proviso/client identifiers.
 * Keep patterns coarse (names of folders / systems), not personal PII dictionaries.
 */

const FORBIDDEN = [
  /\bAF_Kunden\b/i,
  /\bCM_Kunden\b/i,
  /\bAF_DE_BeratungsOrdner\b/i,
  /\bproviso\.db\b/i,
  /\bKundenakte\b/i,
  /\bVersicherungsnummer\b/i,
  /\b\d{2}\.\d{2}\.\d{4}\s*-\s*[A-ZÄÖÜ][a-zäöüß]+/u, // German dossier-ish "DD.MM.YYYY - Name"
];

export type GuardResult = { ok: true } | { ok: false; reason: string };

export function assertNoClientData(payload: unknown, path = 'root'): GuardResult {
  if (payload == null) return { ok: true };
  if (typeof payload === 'string') {
    for (const re of FORBIDDEN) {
      if (re.test(payload)) {
        return { ok: false, reason: `forbidden pattern at ${path}` };
      }
    }
    return { ok: true };
  }
  if (typeof payload === 'number' || typeof payload === 'boolean') return { ok: true };
  if (Array.isArray(payload)) {
    for (let i = 0; i < payload.length; i++) {
      const r = assertNoClientData(payload[i], `${path}[${i}]`);
      if (!r.ok) return r;
    }
    return { ok: true };
  }
  if (typeof payload === 'object') {
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
      if (/client[_-]?name|kunden|vnr|vertragsnummer/i.test(k)) {
        return { ok: false, reason: `forbidden key ${path}.${k}` };
      }
      const r = assertNoClientData(v, `${path}.${k}`);
      if (!r.ok) return r;
    }
  }
  return { ok: true };
}
