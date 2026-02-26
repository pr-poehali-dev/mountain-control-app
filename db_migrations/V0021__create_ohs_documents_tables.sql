
CREATE TABLE IF NOT EXISTS ohs_documents (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'employee_registry',
    file_name VARCHAR(500),
    sheets JSONB NOT NULL DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ohs_sheets (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL,
    sheet_name VARCHAR(500) NOT NULL,
    sheet_index INTEGER NOT NULL DEFAULT 0,
    headers JSONB NOT NULL DEFAULT '[]',
    rows_data JSONB NOT NULL DEFAULT '[]',
    formulas JSONB NOT NULL DEFAULT '{}',
    merged_cells JSONB NOT NULL DEFAULT '[]',
    column_widths JSONB DEFAULT '{}',
    row_count INTEGER DEFAULT 0,
    col_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ohs_documents_category ON ohs_documents(category);
CREATE INDEX idx_ohs_sheets_document_id ON ohs_sheets(document_id);
