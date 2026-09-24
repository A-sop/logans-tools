import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { LocalCrmIndex } from '@/lib/dabos-ops/contact-network/local-crm-index';

const temps: string[] = [];

function openTempIndex(): LocalCrmIndex {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ldw-crm-'));
  temps.push(dir);
  return new LocalCrmIndex(path.join(dir, 'test.db'));
}

afterEach(() => {
  for (const dir of temps.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('LocalCrmIndex people SSOT schema', () => {
  it('creates contacts with privacy/postal defaults and accepts source refs', () => {
    const index = openTempIndex();
    try {
      const id = index.upsertContact({
        fullName: 'Ada Example',
        email: 'ada@example.test',
        sourceSystem: 'google_contacts',
        externalRef: 'google:1',
      });
      index.addContactSource({
        contactId: id,
        sourceSystem: 'google_contacts',
        externalRef: 'google:1',
        rawLabel: 'myContacts',
      });
      const [row] = index.getContactByName('Ada Example');
      expect(row.privacyClass).toBe('unclassified');
      expect(row.status).toBe('active');
      expect(row.origin).toBe('owner');
      expect(row.street).toBeNull();
      expect(row.postalCode).toBeNull();
    } finally {
      index.close();
    }
  });

  it('does not update a dvag row when matching by email', () => {
    const index = openTempIndex();
    try {
      const dvagId = index.upsertContact({
        fullName: 'Frozen Client',
        email: 'shared@example.test',
        sourceSystem: 'dvag',
        externalRef: 'KN-1',
      });
      const googleId = index.upsertContact(
        {
          fullName: 'Google Copy',
          email: 'shared@example.test',
          sourceSystem: 'google_contacts',
          externalRef: 'google:1',
        },
        { matchEmail: true }
      );
      expect(googleId).not.toBe(dvagId);
      const [dvag] = index.getContactByName('Frozen Client');
      expect(dvag.sourceSystem).toBe('dvag');
      expect(dvag.fullName).toBe('Frozen Client');
      const [google] = index.getContactByName('Google Copy');
      expect(google.sourceSystem).toBe('google_contacts');
    } finally {
      index.close();
    }
  });
});
