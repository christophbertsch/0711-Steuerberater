import { Pool } from 'pg';

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || '34.107.63.251',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'steuerberater',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Only create connection pool if credentials are provided
let pool = null;
if (process.env.DB_USER && process.env.DB_PASSWORD) {
  pool = new Pool(dbConfig);
} else {
  console.log('Database credentials not provided, database operations will be disabled');
}

// Test connection
if (pool) {
  pool.on('connect', () => {
    console.log('Connected to PostgreSQL database');
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
  });
}

// Initialize database schema
async function initializeDatabase() {
  if (!pool) {
    throw new Error('Database pool not initialized - credentials not provided');
  }
  const client = await pool.connect();
  try {
    // Create tables if they don't exist
    await client.query(`
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
    `);

    await client.query(`
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
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tax_research (
        id SERIAL PRIMARY KEY,
        query TEXT NOT NULL,
        results JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_documents_upload_date ON documents(upload_date);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_document_analyses_document_id ON document_analyses(document_id);
    `);

    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Database query functions
const db = {
  // Generic query function
  query: (text, params) => {
    if (!pool) throw new Error('Database not available');
    return pool.query(text, params);
  },

  // Document operations
  async createDocument(documentData) {
    if (!pool) throw new Error('Database not available');
    const { name, originalFilename, fileType, fileSize, blobUrl, blobPathname, extractedText, documentType } = documentData;
    const result = await pool.query(
      `INSERT INTO documents (name, original_filename, file_type, file_size, blob_url, blob_pathname, extracted_text, document_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, originalFilename, fileType, fileSize, blobUrl, blobPathname, extractedText, documentType]
    );
    return result.rows[0];
  },

  async getDocuments() {
    if (!pool) throw new Error('Database not available');
    const result = await pool.query('SELECT * FROM documents ORDER BY upload_date DESC');
    return result.rows;
  },

  async getDocumentById(id) {
    if (!pool) throw new Error('Database not available');
    const result = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);
    return result.rows[0];
  },

  async deleteDocument(id) {
    if (!pool) throw new Error('Database not available');
    await pool.query('DELETE FROM documents WHERE id = $1', [id]);
  },

  // Analysis operations
  async createAnalysis(analysisData) {
    if (!pool) throw new Error('Database not available');
    const { documentId, documentType, taxRelevance, confidence, expertOpinion, extractedData, suggestedActions } = analysisData;
    const result = await pool.query(
      `INSERT INTO document_analyses (document_id, document_type, tax_relevance, confidence, expert_opinion, extracted_data, suggested_actions)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [documentId, documentType, taxRelevance, confidence, JSON.stringify(expertOpinion), JSON.stringify(extractedData), suggestedActions]
    );
    return result.rows[0];
  },

  async getAnalysisByDocumentId(documentId) {
    if (!pool) throw new Error('Database not available');
    const result = await pool.query('SELECT * FROM document_analyses WHERE document_id = $1', [documentId]);
    return result.rows[0];
  },

  // Tax research operations
  async saveTaxResearch(query, results) {
    if (!pool) throw new Error('Database not available');
    await pool.query(
      'INSERT INTO tax_research (query, results) VALUES ($1, $2)',
      [query, JSON.stringify(results)]
    );
  },

  async getTaxResearch(query) {
    if (!pool) throw new Error('Database not available');
    const result = await pool.query('SELECT results FROM tax_research WHERE query = $1 ORDER BY created_at DESC LIMIT 1', [query]);
    return result.rows[0]?.results;
  }
};

export { db, initializeDatabase, pool };