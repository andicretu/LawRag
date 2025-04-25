CREATE TYPE document_type AS ENUM (
    'lege',
    'hotarare',
    'ordonanta',
    'decizie',
    'ordin',
    'regulament',
    'norme',
    'cod'
);

CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    source_id VARCHAR(255) UNIQUE NOT NULL,
    code VARCHAR(255) NOT NULL,
    title TEXT NOT NULL,
    type document_type NOT NULL,
    url TEXT,
    emitent TEXT,
    publication_date DATE,
    fetched_at TIMESTAMP DEFAULT NOW(),
    notes TEXT
);
