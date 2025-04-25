CREATE TABLE nodes (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES nodes(id) ON DELETE CASCADE,
    level VARCHAR(50) NOT NULL,                 -- 'nota', 'titlu', 'capitol', 'sectiune', 'articol', 'alineat', 'litera', 'subpunct', 'anexa'
    label TEXT,                                 -- e.g., "Capitolul I", "Art. 5", "(1)", "a)", "(i)"
    content TEXT NOT NULL,                      -- Main text
    sort_order INTEGER                          -- Order among siblings (optional but strongly recommended)
);
