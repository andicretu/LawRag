CREATE TYPE node_level AS ENUM (
  'prefata',
  'nota',
  'titlu',
  'carte',
  'capitol',
  'sectiune',
  'articol',
  'alineat',
  'litera',
  'subpunct',
  'anexa',
  'denumire',
  'publicare'
);

CREATE TABLE nodes (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES nodes(id) ON DELETE CASCADE,
    level node_level NOT NULL,
    label TEXT,
    content TEXT NOT NULL,
    sort_order INTEGER,
    section_type TEXT
);
