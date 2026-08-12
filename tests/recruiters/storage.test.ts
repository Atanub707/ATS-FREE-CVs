import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDb, teardownTestDb } from './initDb';
import { runWithUser, addContactNote, setContactFollowUp, setContactFollowedUp, setContactPipeline, recordContactEmailDetail, listContactEmails, getContactStats, listContactsCsv, getDb } from '../../server/storage/fileStorage';

describe('recruiter storage', () => {
  beforeEach(() => { setupTestDb(); runWithUser('u1', () => {
    getDb().prepare('INSERT INTO hr_contacts (id, user_id, email, name, company, job_role, phone, type, type_label, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('c1', 'u1', 'a@x.com', 'Alice', 'ACME', 'Engineer', '+1 555', 'recruit', 'Recruiter', new Date().toISOString());
    getDb().prepare('INSERT INTO hr_contacts (id, user_id, email, name, company, job_role, phone, type, type_label, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('c2', 'u1', null, 'Bob', 'BETA', 'HR', null, 'hr', 'HR', new Date().toISOString());
  }); });
  afterEach(() => teardownTestDb());

  it('adds a note', () => {
    runWithUser('u1', () => {
      expect(addContactNote('c1', 'Likes Kubernetes')).toBe(true);
      expect(getDb().prepare('SELECT notes FROM hr_contacts WHERE id = ?').get('c1').notes).toBe('Likes Kubernetes');
    });
  });

  it('sets follow-up and followed-up flags', () => {
    runWithUser('u1', () => {
      expect(setContactFollowUp('c1', '2026-09-01T00:00:00.000Z')).toBe(true);
      expect(setContactFollowedUp('c1', true)).toBe(true);
      const row = getDb().prepare('SELECT follow_up_at, followed_up FROM hr_contacts WHERE id = ?').get('c1');
      expect(row.follow_up_at).toBe('2026-09-01T00:00:00.000Z');
      expect(row.followed_up).toBe(1);
    });
  });

  it('validates pipeline status', () => {
    runWithUser('u1', () => {
      expect(setContactPipeline('c1', 'interview')).toBe(true);
      expect(setContactPipeline('c1', 'bogus')).toBe(true); // stores null
      expect(getDb().prepare('SELECT pipeline_status FROM hr_contacts WHERE id = ?').get('c1').pipeline_status).toBeNull();
    });
  });

  it('records and lists sent emails', () => {
    runWithUser('u1', () => {
      recordContactEmailDetail('c1', { recipient: 'a@x.com', subject: 'Hi', body: 'Body', status: 'sent' });
      const list = listContactEmails('c1');
      expect(list).toHaveLength(1);
      expect(list[0].subject).toBe('Hi');
      expect(list[0].status).toBe('sent');
    });
  });

  it('computes stats', () => {
    runWithUser('u1', () => {
      const s = getContactStats();
      expect(s.total).toBe(2);
      expect(s.withEmail).toBe(1);
      expect(s.withPhone).toBe(1);
      expect(s.companies).toBe(2);
    });
  });

  it('exports CSV rows with display name', () => {
    runWithUser('u1', () => {
      const rows = listContactsCsv();
      expect(rows).toHaveLength(2);
      expect(rows[0].name).toBe('Alice');
    });
  });
});
