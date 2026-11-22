/**
 * Database module: AccessRequests
 * Requests for gateway access sent from the public landing page, and the operator's decision.
 */

import { v4 as uuidv4 } from "uuid";
import { getDbInstance } from "./core.ts";

export type AccessRequestStatus = "pending" | "approved" | "rejected";

export interface AccessRequest {
  id: string;
  name: string;
  email: string;
  reason: string | null;
  status: AccessRequestStatus;
  createdAt: string;
  decidedAt: string | null;
  apiKeyId: string | null;
}

interface AccessRequestDbRow {
  id: string;
  name: string;
  email: string;
  reason: string | null;
  status: string;
  created_at: string;
  decided_at: string | null;
  api_key_id: string | null;
}

function mapRow(row: AccessRequestDbRow): AccessRequest {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    reason: row.reason,
    status: row.status as AccessRequestStatus,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
    apiKeyId: row.api_key_id,
  };
}

/**
 * Stores a pending request. A second request from an email that already has one pending is
 * not stored again: the existing id comes back with `created: false`.
 */
export function createAccessRequest(input: {
  name: string;
  email: string;
  reason?: string | null;
}): { id: string; created: boolean } {
  const db = getDbInstance();
  const email = input.email.trim().toLowerCase();
  const existing = db
    .prepare("SELECT id FROM access_requests WHERE email = ? AND status = 'pending'")
    .get(email) as { id: string } | undefined;
  if (existing) return { id: existing.id, created: false };

  const id = uuidv4();
  db.prepare(
    `INSERT INTO access_requests (id, name, email, reason, status, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?)`
  ).run(id, input.name.trim(), email, input.reason?.trim() || null, new Date().toISOString());
  return { id, created: true };
}

export function listAccessRequests(opts?: { status?: AccessRequestStatus }): AccessRequest[] {
  const db = getDbInstance();
  // rowid breaks ties between requests stored within the same millisecond.
  const rows = opts?.status
    ? (db
        .prepare(
          "SELECT * FROM access_requests WHERE status = ? ORDER BY created_at DESC, rowid DESC"
        )
        .all(opts.status) as AccessRequestDbRow[])
    : (db
        .prepare("SELECT * FROM access_requests ORDER BY created_at DESC, rowid DESC")
        .all() as AccessRequestDbRow[]);
  return rows.map(mapRow);
}

export function getAccessRequest(id: string): AccessRequest | null {
  const db = getDbInstance();
  const row = db.prepare("SELECT * FROM access_requests WHERE id = ?").get(id) as
    AccessRequestDbRow | undefined;
  return row ? mapRow(row) : null;
}

export function countPendingAccessRequests(): number {
  const db = getDbInstance();
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM access_requests WHERE status = 'pending'")
    .get() as { n: number };
  return row.n;
}

/**
 * Moves a pending request to `status`. Returns the updated request, or null when the request
 * does not exist or was already decided, so two concurrent decisions cannot both succeed.
 */
export function decideAccessRequest(
  id: string,
  status: Exclude<AccessRequestStatus, "pending">
): AccessRequest | null {
  const db = getDbInstance();
  const result = db
    .prepare(
      "UPDATE access_requests SET status = ?, decided_at = ? WHERE id = ? AND status = 'pending'"
    )
    .run(status, new Date().toISOString(), id);
  if (result.changes === 0) return null;
  return getAccessRequest(id);
}

export function attachApiKey(id: string, apiKeyId: string): void {
  const db = getDbInstance();
  db.prepare("UPDATE access_requests SET api_key_id = ? WHERE id = ?").run(apiKeyId, id);
}

/** Puts an approved request back to pending, for when issuing its key failed. */
export function reopenAccessRequest(id: string): void {
  const db = getDbInstance();
  db.prepare(
    "UPDATE access_requests SET status = 'pending', decided_at = NULL, api_key_id = NULL WHERE id = ?"
  ).run(id);
}
