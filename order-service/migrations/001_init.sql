CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL,

  status TEXT NOT NULL DEFAULT 'pending'
         CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled')),

  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'UAH',

  reservation_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,

  product_name TEXT    NOT NULL,
  product_slug TEXT    NOT NULL,
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),

  quantity INTEGER NOT NULL CHECK (quantity > 0),

  PRIMARY KEY (order_id, product_id)
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key        TEXT PRIMARY KEY,
  user_id    UUID NOT NULL,
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);