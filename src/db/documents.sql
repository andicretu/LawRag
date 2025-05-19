CREATE TYPE document_type AS ENUM (
    'lege',
    'hotarare',
    'ordonanta',
    'ordonanta_de_urgenta',
    'decizie',
    'ordin',
    'regulament',
    'norme',
    'norme_metodologice',
    'metodologie',
    'program',
    'strategie_nationala',
    'ghid_finantare',
    'ghid'
    'cod',
    'criterii_si_norme',
    'caiet_de_sarcini',
    'anexa',
    'decret',
    'acord'
    'protocol'
    'tratat'
    'statut'
    'conventie'
    'UNKNOWN'
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
    domain TEXT,            -- New: assigned field, e.g., 'sanatate'
    keywords TEXT[]         -- New: optional extracted keywords
);

ALTER TABLE documents 
ADD COLUMN text TEXT,
ADD COLUMN fetched_api BOOLEAN DEFAULT FALSE;

