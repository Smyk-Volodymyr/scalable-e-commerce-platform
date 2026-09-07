CREATE TABLE IF NOT EXISTS categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  slug       TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- RESTRICT, а не CASCADE: видалення категорії з товарами має падати з помилкою.
  -- CASCADE тут означав би "видалив категорію — випадково стер 200 товарів".
  category_id UUID        NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,

  name        TEXT        NOT NULL,
  slug        TEXT        NOT NULL UNIQUE,
  description TEXT,

  -- Ціна в копійках цілим числом. Пояснення нижче — це важливо.
  price_cents INTEGER     NOT NULL CHECK (price_cents >= 0),
  currency    CHAR(3)     NOT NULL DEFAULT 'UAH',

  -- CHECK — справжній захист від продажу в мінус, а не перевірка в коді.
  stock       INTEGER     NOT NULL DEFAULT 0 CHECK (stock >= 0),

  -- М'яке видалення: товар зникає з вітрини, але лишається в базі.
  is_active   BOOLEAN     NOT NULL DEFAULT true,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Вибірка товарів категорії — найчастіший запит у каталозі.
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category_id);

-- Вітрина завжди фільтрує за is_active. Частковий індекс:
-- у нього потрапляють тільки активні рядки, тому він менший і швидший.
CREATE INDEX IF NOT EXISTS idx_products_active ON products (created_at DESC) WHERE is_active;