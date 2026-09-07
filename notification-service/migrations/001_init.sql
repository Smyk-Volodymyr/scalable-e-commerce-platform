CREATE TABLE IF NOT EXISTS notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id   TEXT NOT NULL UNIQUE,

  event_type   TEXT NOT NULL,
  recipient    TEXT NOT NULL,
  subject      TEXT NOT NULL,
  body         TEXT NOT NULL,

  status       TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications (created_at DESC);