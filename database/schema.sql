-- Database schema for 0711-Steuerberater

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    blob_url TEXT,
    blob_pathname TEXT,
    extracted_text TEXT,
    document_type VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Document analyses table
CREATE TABLE IF NOT EXISTS document_analyses (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    document_type VARCHAR(100),
    tax_relevance VARCHAR(50),
    confidence DECIMAL(3,2),
    expert_opinion JSONB,
    extracted_data JSONB,
    suggested_actions TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tax research queries table (for caching)
CREATE TABLE IF NOT EXISTS tax_research (
    id SERIAL PRIMARY KEY,
    query TEXT NOT NULL,
    results JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Editorial packages table (for Tax Editorial Agents system)
CREATE TABLE IF NOT EXISTS editorial_packages (
    id SERIAL PRIMARY KEY,
    package_id VARCHAR(255) UNIQUE NOT NULL,
    topic VARCHAR(255) NOT NULL,
    version VARCHAR(50) DEFAULT '1.0.0',
    status VARCHAR(50) DEFAULT 'active',
    jurisdiction VARCHAR(10) DEFAULT 'DE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rule specifications table
CREATE TABLE IF NOT EXISTS rule_specifications (
    id SERIAL PRIMARY KEY,
    package_id VARCHAR(255) REFERENCES editorial_packages(package_id) ON DELETE CASCADE,
    rule_id VARCHAR(255) NOT NULL,
    topic VARCHAR(255) NOT NULL,
    rule_type VARCHAR(100) NOT NULL,
    logic TEXT NOT NULL,
    parameters JSONB DEFAULT '{}',
    form_mappings JSONB DEFAULT '[]',
    tests JSONB DEFAULT '[]',
    citations JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(package_id, rule_id)
);

-- Editorial notes table
CREATE TABLE IF NOT EXISTS editorial_notes (
    id SERIAL PRIMARY KEY,
    package_id VARCHAR(255) REFERENCES editorial_packages(package_id) ON DELETE CASCADE,
    rule_id VARCHAR(255),
    audience VARCHAR(50) NOT NULL, -- 'user', 'reviewer', 'developer'
    content TEXT NOT NULL,
    citations JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User steps table
CREATE TABLE IF NOT EXISTS user_steps (
    id SERIAL PRIMARY KEY,
    package_id VARCHAR(255) REFERENCES editorial_packages(package_id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    form_reference VARCHAR(100),
    kz_reference VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quality metrics table
CREATE TABLE IF NOT EXISTS quality_metrics (
    id SERIAL PRIMARY KEY,
    package_id VARCHAR(255) REFERENCES editorial_packages(package_id) ON DELETE CASCADE,
    coverage_score DECIMAL(3,2) DEFAULT 0.00,
    consistency_score DECIMAL(3,2) DEFAULT 0.00,
    authority_score DECIMAL(3,2) DEFAULT 0.00,
    total_rules INTEGER DEFAULT 0,
    total_notes INTEGER DEFAULT 0,
    total_steps INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_documents_upload_date ON documents(upload_date);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_document_analyses_document_id ON document_analyses(document_id);
CREATE INDEX IF NOT EXISTS idx_tax_research_query ON tax_research USING hash(query);

-- Editorial system indexes
CREATE INDEX IF NOT EXISTS idx_editorial_packages_topic ON editorial_packages(topic);
CREATE INDEX IF NOT EXISTS idx_editorial_packages_status ON editorial_packages(status);
CREATE INDEX IF NOT EXISTS idx_rule_specifications_package_id ON rule_specifications(package_id);
CREATE INDEX IF NOT EXISTS idx_rule_specifications_topic ON rule_specifications(topic);
CREATE INDEX IF NOT EXISTS idx_editorial_notes_package_id ON editorial_notes(package_id);
CREATE INDEX IF NOT EXISTS idx_editorial_notes_audience ON editorial_notes(audience);
CREATE INDEX IF NOT EXISTS idx_user_steps_package_id ON user_steps(package_id);
CREATE INDEX IF NOT EXISTS idx_quality_metrics_package_id ON quality_metrics(package_id);

-- Update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_analyses_updated_at BEFORE UPDATE ON document_analyses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_editorial_packages_updated_at BEFORE UPDATE ON editorial_packages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();