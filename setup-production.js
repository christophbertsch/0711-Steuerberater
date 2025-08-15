#!/usr/bin/env node

/**
 * Production Setup Script for Steuerberater Mega Microagent Platform
 * 
 * This script initializes the production environment with:
 * - PostgreSQL database connection and schema
 * - Qdrant vector database collection
 * - PDF2Q service connectivity test
 * - Environment validation
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

// Load environment variables
dotenv.config();

const REQUIRED_ENV_VARS = [
  'DB_HOST',
  'DB_USER', 
  'DB_PASSWORD',
  'QDRANT_URL'
];

const OPTIONAL_ENV_VARS = [
  'OPENAI_API_KEY',
  'TAVILY_API_KEY'
];

console.log('🚀 Steuerberater Mega Microagent Platform - Production Setup');
console.log('=' .repeat(60));

// Check environment variables
function checkEnvironment() {
  console.log('\n📋 Checking environment variables...');
  
  const missing = [];
  const optional = [];
  
  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    } else {
      console.log(`✅ ${envVar}: configured`);
    }
  }
  
  for (const envVar of OPTIONAL_ENV_VARS) {
    if (!process.env[envVar] || process.env[envVar] === 'your-openai-api-key-here' || process.env[envVar] === 'your-tavily-api-key-here') {
      optional.push(envVar);
    } else {
      console.log(`✅ ${envVar}: configured`);
    }
  }
  
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    console.error('Please check your .env file and ensure all required variables are set.');
    process.exit(1);
  }
  
  if (optional.length > 0) {
    console.warn(`⚠️  Optional environment variables not configured: ${optional.join(', ')}`);
    console.warn('Some features may use mock responses without these API keys.');
  }
  
  console.log('✅ Environment check completed');
}

// Test PostgreSQL connection
async function testPostgreSQL() {
  console.log('\n🗄️  Testing PostgreSQL connection...');
  
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'steuerberater',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });
  
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT version()');
    console.log(`✅ PostgreSQL connected: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}`);
    
    // Test database schema
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        file_type VARCHAR(100) NOT NULL,
        file_size INTEGER NOT NULL,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        file_data BYTEA,
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
    
    console.log('✅ Database schema initialized');
    client.release();
    await pool.end();
  } catch (error) {
    console.error(`❌ PostgreSQL connection failed: ${error.message}`);
    process.exit(1);
  }
}

// Test Qdrant connection
async function testQdrant() {
  console.log('\n📊 Testing Qdrant connection...');
  
  const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
  });
  
  try {
    // Test connection
    const collections = await qdrant.getCollections();
    console.log(`✅ Qdrant connected: ${collections.collections.length} collections found`);
    
    // Check if steuerberater collection exists
    const collectionName = process.env.QDRANT_COLLECTION || 'steuerberater';
    try {
      const collection = await qdrant.getCollection(collectionName);
      console.log(`✅ Collection '${collectionName}' exists with ${collection.points_count} points`);
    } catch (collectionError) {
      console.log(`⚠️  Collection '${collectionName}' not found, creating...`);
      
      // Create collection with OpenAI ada-002 dimensions
      await qdrant.createCollection(collectionName, {
        vectors: {
          size: 1536,
          distance: 'Cosine'
        }
      });
      
      console.log(`✅ Collection '${collectionName}' created successfully`);
    }
  } catch (error) {
    console.error(`❌ Qdrant connection failed: ${error.message}`);
    process.exit(1);
  }
}

// Test PDF2Q service
async function testPDF2Q() {
  console.log('\n📄 Testing PDF2Q service...');
  
  const pdf2qUrl = process.env.PDF2Q_SERVICE_URL || 'https://pdf2q.onrender.com';
  
  try {
    // Simple HTTP request to test service availability
    const url = new URL(pdf2qUrl);
    const client = url.protocol === 'https:' ? https : http;
    
    const response = await new Promise((resolve, reject) => {
      const req = client.get(url, (res) => {
        resolve(res);
      });
      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
    
    if (response.statusCode === 200 || response.statusCode === 404) {
      console.log(`✅ PDF2Q service available (status: ${response.statusCode})`);
    } else {
      console.warn(`⚠️  PDF2Q service responded with status: ${response.statusCode}`);
    }
  } catch (error) {
    console.warn(`⚠️  PDF2Q service test failed: ${error.message}`);
    console.warn('PDF extraction may fall back to alternative methods');
  }
}

// Test OpenAI API (if configured)
async function testOpenAI() {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-openai-api-key-here') {
    console.log('\n🤖 OpenAI API key not configured - will use mock responses');
    return;
  }
  
  console.log('\n🤖 Testing OpenAI API...');
  
  try {
    // Simple test - we'll skip the actual API call for now
    console.log('✅ OpenAI API key configured');
    console.log('   Note: Actual API test skipped in setup script');
  } catch (error) {
    console.error(`❌ OpenAI API test failed: ${error.message}`);
  }
}

// Create production .env file if it doesn't exist
function createEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('\n📝 Creating .env file from template...');
    
    const examplePath = path.join(process.cwd(), '.env.example');
    if (fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, envPath);
      console.log('✅ .env file created from .env.example');
      console.log('⚠️  Please edit .env file and add your API keys');
    } else {
      console.warn('⚠️  .env.example not found, please create .env manually');
    }
  }
}

// Main setup function
async function main() {
  try {
    createEnvFile();
    checkEnvironment();
    await testPostgreSQL();
    await testQdrant();
    await testPDF2Q();
    await testOpenAI();
    
    console.log('\n🎉 Production setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Start the backend server: npm run server');
    console.log('2. Start the frontend: npm run dev');
    console.log('3. Access the application at: http://localhost:54940');
    console.log('4. Access Qdrant dashboard: http://34.40.104.64:6333/dashboard');
    
  } catch (error) {
    console.error(`\n❌ Setup failed: ${error.message}`);
    process.exit(1);
  }
}

// Run setup
main();