-- Create ENUM type for reference types (only if it doesn't already exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reference_type_enum') THEN
        CREATE TYPE reference_type_enum AS ENUM (
            'is_modified_by',
            'is_completed_by',
            'is_abrogated_by',
            'abrogates',
            'refers_to',
            'is_referred_by',
            'updates',
            'is_suspended_by',
            'suspends',
            'is_corrected_by',
            'corrects'
        );
    END IF;
END $$;

-- Create the table (only if it doesn't already exist)
CREATE TABLE IF NOT EXISTS legal_references (
    id SERIAL PRIMARY KEY,
    source_detalii_id INTEGER NOT NULL,        -- ID of the source law (DetaliiDocument ID)
    reference_type reference_type_enum NOT NULL,  -- Type of reference (ENUM)
    target_code_text VARCHAR(255) NOT NULL,    -- Target law code text (e.g., "LEGE 76 24/05/2012")
    section_label VARCHAR(255),                -- Label of the section where reference appears
    created_at TIMESTAMP DEFAULT NOW()         -- Timestamp for record creation
);

-- Index for fast lookup by source_detalii_id
CREATE INDEX IF NOT EXISTS idx_legal_references_source_detalii_id
ON legal_references (source_detalii_id);

-- Index for fast lookup by reference type
CREATE INDEX IF NOT EXISTS idx_legal_references_reference_type
ON legal_references (reference_type);
