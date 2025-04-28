CREATE TYPE node_level AS ENUM (
  'nota',
  'titlu',
  'carte',       -- 🔥 New (for Codes)
  'capitol',
  'sectiune',
  'articol',
  'alineat',
  'litera',
  'subpunct',
  'anexa'
);

CREATE TABLE nodes (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES nodes(id) ON DELETE CASCADE,
    level node_level NOT NULL                
    label TEXT,                                 -- e.g., "Capitolul I", "Art. 5", "(1)", "a)", "(i)"
    content TEXT NOT NULL,                      -- Main text
    sort_order INTEGER                          -- Order among siblings
);
