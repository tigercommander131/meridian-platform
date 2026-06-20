-- Sync: idempotency log for events drained from offline clients.
-- Every accepted event is recorded by its client-generated event_id so that
-- re-sending the same event (flaky network, retries) is a no-op.

CREATE TABLE synced_events (
  event_id     TEXT PRIMARY KEY,
  event_type   TEXT NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}',
  user_id      TEXT,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_synced_events_type ON synced_events(event_type);
