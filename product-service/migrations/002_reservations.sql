CREATE TABLE IF NOT EXISTS reservations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  order_id   UUID        NOT NULL UNIQUE,

  status     TEXT        NOT NULL DEFAULT 'active'
             CHECK (status IN ('active', 'committed', 'cancelled')),

  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reservation_items (
  reservation_id UUID    NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  product_id     UUID    NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity       INTEGER NOT NULL CHECK (quantity > 0),
  -- Складений ключ: один товар може бути в резерві лише одним рядком.
  PRIMARY KEY (reservation_id, product_id)
);

-- Фоновий процес шукає протерміноване саме за цими двома полями.
CREATE INDEX IF NOT EXISTS idx_reservations_expiry
  ON reservations (expires_at) WHERE status = 'active';