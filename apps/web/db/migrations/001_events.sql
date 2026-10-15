-- 001_events.sql — Phase 3 Step 1 (store binding): append-only event store.
--
-- Every JSONL ledger the app keeps today (subscriptions, orders, contact
-- messages, order tracking, broadcast drafts, leads, reviews) becomes a
-- stream in ONE append-only table. A "record" is an event; the current
-- state of a stream key (an email, an order id, ...) is its LATEST event,
-- resolved by query (ORDER BY id) — never by UPDATE. This preserves the
-- ledgers' append-only semantics exactly: history is never edited, a
-- later line supersedes an earlier one, and "no event" means "no state"
-- (entitlement checks fail closed on absence, as they do on a missing
-- JSONL file today).
--
-- Apply with: DATABASE_URL=... npm run db:migrate
-- (or implicitly via scripts/migrate-jsonl-to-events.mjs).

CREATE TABLE IF NOT EXISTS events (
  id          bigserial PRIMARY KEY,
  -- Stream name: 'subscriptions' | 'orders' | 'contact_messages' |
  -- 'order_tracking' | 'broadcasts' | 'leads' | 'reviews'.
  stream      text NOT NULL,
  -- The key the stream is folded by: normalized email (subscriptions,
  -- leads), order_id (orders, order_tracking), message_id (contact),
  -- broadcast_id (broadcasts), review id (reviews).
  stream_key  text NOT NULL,
  -- '<thing>.<past-tense-verb>', e.g. 'subscription.active',
  -- 'order.recorded'. Informational: state resolution is latest-wins
  -- regardless of type.
  event_type  text NOT NULL,
  -- The record, verbatim — the exact object the JSONL line carried.
  payload     jsonb NOT NULL,
  -- 'app' for live writes; 'migration:<source>' for rows imported by
  -- scripts/migrate-jsonl-to-events.mjs (auditability + safe repair).
  origin      text NOT NULL DEFAULT 'app',
  -- For app writes: the append time. For migrated rows: the record's own
  -- timestamp from the JSONL line, so history keeps its chronology.
  -- Ordering authority is `id` (insertion order), never this column.
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_stream_key_id_idx
  ON events (stream, stream_key, id);
CREATE INDEX IF NOT EXISTS events_stream_id_idx
  ON events (stream, id);

-- Append-only enforcement: event rows are never updated or deleted.
-- (TRUNCATE is not blocked — it is the test/reset path, available only to
-- the database owner, never to the app's request path.)
CREATE OR REPLACE FUNCTION events_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'events is append-only: % denied', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS events_append_only ON events;
CREATE TRIGGER events_append_only
  BEFORE UPDATE OR DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION events_append_only();

-- Idempotency ledger for scripts/migrate-jsonl-to-events.mjs: one row per
-- migrated source file, keyed by source name, carrying the line count and
-- content hash that were migrated. A re-run whose source still matches its
-- marker is a no-op; a source that changed after migration is refused
-- loudly instead of double-inserted.
CREATE TABLE IF NOT EXISTS migration_markers (
  source      text PRIMARY KEY,
  line_count  integer NOT NULL,
  sha256      text NOT NULL,
  migrated_at timestamptz NOT NULL DEFAULT now()
);
