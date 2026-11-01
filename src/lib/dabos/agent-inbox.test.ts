// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  buildInsertSql,
  forbiddenContent,
  parseDeadline,
  parseSendArgs,
  sqlLiteral,
  validateSend,
  type SendInput,
} from '@/lib/dabos/agent-inbox';

const base: SendInput = {
  from: 'div4',
  to: 'div5',
  subject: 'made-up',
  body: 'made-up body',
  claim: 'none',
  reason: null,
  deadlineAt: null,
  blocks: null,
  dedupeKey: 'div4:topic',
};

describe('dabos-inbox send (AC2)', () => {
  it('parses the CLI, maps hat aliases and reads Berlin deadlines', () => {
    const a = parseSendArgs([
      'send', '--from', 'Div4', '--to', 'dept13', '--subject', 's', '--key', 'div4:k',
      '--claim', 'deadline_today', '--reason', 'deadline_6h: close', '--deadline', '2026-11-05 14:00', '--print-sql',
    ]);
    expect(a.command).toBe('send');
    expect(a.printSql).toBe(true);
    expect(a.input).toMatchObject({ from: 'div4', to: 'div5', claim: 'deadline_today', dedupeKey: 'div4:k' });
    expect(a.input.deadlineAt!.toISOString()).toBe('2026-11-05T13:00:00.000Z');
    expect(parseDeadline('2026-07-01T14:00').toISOString()).toBe('2026-07-01T12:00:00.000Z');
    expect(parseDeadline('2026-11-05T13:00:00Z').toISOString()).toBe('2026-11-05T13:00:00.000Z');
    expect(() => parseDeadline('tomorrow')).toThrow();
    expect(() => parseSendArgs(['send', '--bogus', 'x'])).toThrow(/unknown option/);
    expect(() => parseSendArgs(['send', '--from'])).toThrow(/needs a value/);
  });

  it('refuses Logan as a recipient, unknown agents, bad keys and claims without reasons', () => {
    expect(validateSend(base)).toEqual([]);
    expect(validateSend({ ...base, to: 'logan' })[0]).toMatch(/approval_queue/);
    expect(validateSend({ ...base, to: 'div9' })[0]).toMatch(/to must be one of/);
    expect(validateSend({ ...base, from: 'stranger' })[0]).toMatch(/from must be one of/);
    expect(validateSend({ ...base, dedupeKey: 'X' })[0]).toMatch(/key must be/);
    expect(validateSend({ ...base, claim: 'urgent' })[0]).toMatch(/needs a reason/);
    expect(validateSend({ ...base, claim: 'blocking', reason: 'x' })[0]).toMatch(/needs --blocks/);
    expect(validateSend({ ...base, claim: 'deadline_today', reason: 'x' })[0]).toMatch(/needs --deadline/);
  });

  it('refuses bodies that look like secrets or bank data, with fake values only', () => {
    const fakes = [
      'crsr_' + 'a'.repeat(20),
      'ghp_' + 'b'.repeat(30),
      'postgresql://user:' + 'pw' + '@host/db',
      'npg_' + 'c'.repeat(12),
      'sk_live_' + 'd'.repeat(16),
      '-----BEGIN OPENSSH PRIVATE KEY-----',
      'Bearer ' + 'e'.repeat(30),
      'DE89 3704 0044 0532 0130 00',
    ];
    for (const f of fakes) {
      expect(forbiddenContent(`see ${f} here`)).not.toEqual([]);
      expect(validateSend({ ...base, body: `x ${f}` }).join(' ')).toMatch(/forbidden content/);
    }
    expect(forbiddenContent('logans-tools #63 at abcdef1234567890abcdef1234567890abcdef12')).toEqual([]);
  });

  it('builds one INSERT statement with quotes escaped', () => {
    expect(sqlLiteral("it's")).toBe("'it''s'");
    const sql = buildInsertSql({ ...base, subject: "it's; DROP TABLE x; --" });
    expect(sql.startsWith('INSERT INTO agent_inbox')).toBe(true);
    expect(sql).toContain("'it''s; DROP TABLE x; --'");
    expect(sql.trim().endsWith('RETURNING id;')).toBe(true);
    expect(() => buildInsertSql({ ...base, to: 'logan' })).toThrow();
  });
});
