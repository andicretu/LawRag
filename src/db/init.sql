CREATE TABLE IF NOT EXISTS printable_ids (
  id SERIAL PRIMARY KEY,
  detalii_id INTEGER NOT NULL UNIQUE,
  printable_code TEXT NOT NULL UNIQUE,
  url TEXT GENERATED ALWAYS AS (
    'https://legislatie.just.ro/Public/FormaPrintabila/' || printable_code
  ) STORED,
  collected_at TIMESTAMP DEFAULT NOW()
  domain TEXT;            -- New: assigned field, e.g., 'sanatate'
);
