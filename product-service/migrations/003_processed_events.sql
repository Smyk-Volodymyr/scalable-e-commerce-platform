CREATE TABLE IF NOT EXISTS processed_events (
  message_id   TEXT PRIMARY KEY,
  event_type   TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);