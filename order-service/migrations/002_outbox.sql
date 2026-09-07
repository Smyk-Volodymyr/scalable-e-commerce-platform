CREATE TABLE IF NOT EXISTS outbox (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  event_type    TEXT        NOT NULL,

  aggregate_id  UUID        NOT NULL,

  payload       JSONB       NOT NULL,

  published_at  TIMESTAMPTZ,
  attempts      INTEGER     NOT NULL DEFAULT 0,
  last_error    TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending
  ON outbox (created_at) WHERE published_at IS NULL;