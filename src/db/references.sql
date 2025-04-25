CREATE TYPE reference_type_enum AS ENUM (
    'modifies',
    'is_modified_by',
    'completes',
    'is_completed_by',
    'abrogates',
    'is_abrogated_by',
    'refers_to',
    'is_referred_by',
    'updates',
    'suspends',
    'is_suspended_by',
    'corrects',
    'is_corrected_by'
);

CREATE TABLE document_references (
    id SERIAL PRIMARY KEY,
    source_document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    target_document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    rreference_type reference_type_enum NOT NULL,-- normalized action (modifies, completes, abrogates, etc.)
    section_label TEXT,                         -- Optional: e.g., "Art. 11" if specific section targeted
    details TEXT                                -- Optional: extra note (e.g., "Modifică Art. 11 alin. (3)")
);
