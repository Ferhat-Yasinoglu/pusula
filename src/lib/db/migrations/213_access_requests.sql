-- Visitors of the public landing page ask for access to this gateway; the operator
-- approves (which issues a normal API key) or rejects each request in the dashboard.
CREATE TABLE IF NOT EXISTS access_requests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL,
  decided_at TEXT,
  api_key_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_access_requests_status_created
  ON access_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_access_requests_email ON access_requests(email);
