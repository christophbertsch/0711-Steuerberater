import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import OpenAI from 'openai';
import fetch from 'node-fetch';
import FormData from 'form-data';
import dotenv from 'dotenv';
import { QdrantClient } from '@qdrant/js-client-rest';
// Removed Vercel Blob dependency - using database storage instead
// Import database with fallback
let db = null;
let initializeDatabase = null;
// pdf-parse will be imported dynamically

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Initialize OpenAI with environment variable (optional for blob storage functionality)
let openai = null;
if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here') {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  console.log('✅ OpenAI API initialized successfully');
} else {
  console.log('❌ OpenAI API key not configured - AI analysis will use mock responses');
}

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow localhost for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Allow Vercel deployments
    if (origin.includes('vercel.app')) {
      return callback(null, true);
    }
    
    // For production, you might want to be more restrictive
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static('dist'));

// Configure multer for file uploads (using memory storage for database)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for database storage
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|docx|xml|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype.startsWith('text/');
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images, PDFs, Word documents, XML files, and text files are allowed'));
    }
  }
});

// OpenAI client already initialized above

// Initialize Qdrant client
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://34.40.104.64:6333',
  apiKey: process.env.QDRANT_API_KEY, // Optional if no auth
});

const QDRANT_COLLECTION = 'steuerberater';

// Initialize database on startup
async function initApp() {
  try {
    // Dynamically import database module
    const dbModule = await import('../database/connection.js');
    db = dbModule.db;
    initializeDatabase = dbModule.initializeDatabase;
    
    await initializeDatabase();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    db = null;
    initializeDatabase = null;
  }
}

// Legacy in-memory storage (kept for fallback)
let documents = [];
let documentAnalyses = {};

// Generate embeddings for text using OpenAI
async function generateEmbedding(text) {
  try {
    if (!openai) {
      throw new Error('OpenAI client not initialized - API key not configured');
    }
    
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// Store document in Qdrant with embeddings
async function storeDocumentInQdrant(documentId, text, metadata) {
  try {
    console.log(`📊 Storing document ${documentId} in Qdrant...`);
    
    // Generate embedding for the text
    const embedding = await generateEmbedding(text);
    
    // Store in Qdrant
    await qdrant.upsert(QDRANT_COLLECTION, {
      wait: true,
      points: [
        {
          id: documentId,
          vector: embedding,
          payload: {
            text: text,
            filename: metadata.filename,
            type: metadata.type,
            size: metadata.size,
            uploadDate: metadata.uploadDate,
            documentType: metadata.documentType || 'unknown',
            language: metadata.language || 'de',
            ...metadata
          }
        }
      ]
    });
    
    console.log(`✅ Document ${documentId} stored in Qdrant successfully`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error storing document ${documentId} in Qdrant:`, error);
    throw error;
  }
}

// Search documents in Qdrant using semantic similarity
async function searchDocumentsInQdrant(query, limit = 5) {
  try {
    console.log(`🔍 Searching Qdrant for: "${query}"`);
    
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    
    // Search in Qdrant
    const searchResult = await qdrant.search(QDRANT_COLLECTION, {
      vector: queryEmbedding,
      limit: limit,
      with_payload: true,
      with_vector: false
    });
    
    console.log(`📊 Found ${searchResult.length} similar documents`);
    
    return searchResult.map(result => ({
      id: result.id,
      score: result.score,
      ...result.payload
    }));
    
  } catch (error) {
    console.error('❌ Error searching Qdrant:', error);
    throw error;
  }
}

// Detect document type based on filename and content
function detectDocumentType(filename, text) {
  const lowerName = filename.toLowerCase();
  const lowerText = text.toLowerCase();
  
  // German tax document patterns
  const patterns = {
    'lohnsteuerbescheinigung': ['lohnsteuer', 'bescheinigung', 'arbeitgeber', 'bruttoarbeitslohn'],
    'spendenquittung': ['spende', 'zuwendung', 'gemeinnützig', 'donation', 'quittung'],
    'rechnung': ['rechnung', 'invoice', 'betrag', 'mwst', 'umsatzsteuer'],
    'quittung': ['quittung', 'beleg', 'kassenbon', 'receipt'],
    'versicherung': ['versicherung', 'police', 'beitrag', 'insurance'],
    'medizinisch': ['arzt', 'apotheke', 'medizin', 'kranken', 'gesundheit'],
    'bildung': ['schule', 'universität', 'kurs', 'fortbildung', 'seminar'],
    'handwerker': ['handwerker', 'renovierung', 'reparatur', 'sanierung'],
    'kinderbetreuung': ['kindergarten', 'kita', 'betreuung', 'tagesmutter'],
    'fahrtkosten': ['fahrt', 'kilometer', 'benzin', 'diesel', 'tankstelle']
  };
  
  // Check filename first
  for (const [type, keywords] of Object.entries(patterns)) {
    if (keywords.some(keyword => lowerName.includes(keyword))) {
      return type;
    }
  }
  
  // Check content
  for (const [type, keywords] of Object.entries(patterns)) {
    const matches = keywords.filter(keyword => lowerText.includes(keyword)).length;
    if (matches >= 2) { // Require at least 2 keyword matches for content-based detection
      return type;
    }
  }
  
  return 'sonstiges';
}

// Extract PDF text using external service or fallback methods
async function extractPDFTextReliable(buffer, fileName) {
  try {
    console.log(`🔍 Starting reliable PDF text extraction for: ${fileName}`);
    
    // Method 1: Try Python PyPDF2 script first (most reliable) - only in development
    if (process.env.NODE_ENV === 'development' || process.env.ENABLE_PYTHON_EXTRACTION === 'true') {
      try {
        console.log('🐍 Attempting Python PyPDF2 script...');
        
        // spawn and path already imported at top
        
        const scriptPath = path.join(__dirname, '..', 'scripts', 'extract_pdf.py');
        const base64Data = buffer.toString('base64');
        
        const result = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Python script timeout after 10 seconds'));
          }, 10000);
          
          const python = spawn('python3', [scriptPath]);
          let output = '';
          let errorOutput = '';
          
          python.stdout.on('data', (data) => {
            output += data.toString();
          });
          
          python.stderr.on('data', (data) => {
            errorOutput += data.toString();
          });
          
          python.on('close', (code) => {
            clearTimeout(timeout);
            if (code === 0) {
              try {
                const result = JSON.parse(output);
                resolve(result);
              } catch (parseError) {
                reject(new Error(`Failed to parse Python script output: ${parseError.message}`));
              }
            } else {
              reject(new Error(`Python script failed with code ${code}: ${errorOutput}`));
            }
          });
          
          python.on('error', (error) => {
            clearTimeout(timeout);
            reject(new Error(`Failed to start Python script: ${error.message}`));
          });
          
          // Send base64 data to Python script
          python.stdin.write(base64Data);
          python.stdin.end();
        });
        
        if (result.success && result.text && result.text.trim().length > 10) {
          console.log(`✅ Python script extracted ${result.text_length} characters from ${result.pages} pages`);
          console.log(`📝 First 100 chars: ${result.text.substring(0, 100)}...`);
          return result.text.trim();
        } else {
          console.log(`⚠️ Python script failed: ${result.error}`);
        }
        
      } catch (pythonError) {
        console.log('⚠️ Python script unavailable:', pythonError.message);
      }
    } else {
      console.log('🚫 Python extraction disabled in production environment');
    }
    
    // Method 2: Try external PDF service as fallback (if configured)
    const pdfServiceUrl = process.env.PDF_SERVICE_URL;
    if (pdfServiceUrl) {
      try {
        console.log(`🌐 Attempting external PDF service at: ${pdfServiceUrl}`);
        
        // FormData and fetch already imported at top
        
        const form = new FormData();
        form.append('file', buffer, {
          filename: fileName,
          contentType: 'application/pdf'
        });
        
        const response = await fetch(`${pdfServiceUrl}/extract`, {
          method: 'POST',
          body: form,
          timeout: 10000 // 10 second timeout
        });
        
        if (response.ok) {
          const result = await response.json();
          
          if (result.success && result.text && result.text.trim().length > 10) {
            console.log(`✅ External service extracted ${result.text_length} characters from ${result.pages} pages`);
            console.log(`📝 First 100 chars: ${result.text.substring(0, 100)}...`);
            return result.text.trim();
          }
        }
        
        console.log(`⚠️ External service failed: ${response.status}`);
        
      } catch (serviceError) {
        console.log('⚠️ External PDF service unavailable:', serviceError.message);
      }
    }
    
    // Method 3: Try pdf-parse as fallback (primary method in production)
    try {
      console.log('📚 Attempting pdf-parse extraction...');
      const pdfParse = await import('pdf-parse');
      
      // Configure pdf-parse options for better extraction
      const options = {
        normalizeWhitespace: false,
        disableCombineTextItems: false
      };
      
      const pdfData = await pdfParse.default(buffer, options);
      
      if (pdfData.text && pdfData.text.trim().length > 10) {
        console.log(`✅ pdf-parse extracted ${pdfData.text.length} characters`);
        console.log(`📝 First 100 chars: ${pdfData.text.substring(0, 100)}...`);
        return pdfData.text.trim();
      } else {
        console.log('⚠️ pdf-parse returned minimal text');
      }
      
    } catch (pdfParseError) {
      console.log('⚠️ pdf-parse failed:', pdfParseError.message);
      
      // Try with different options if first attempt fails
      try {
        console.log('🔄 Retrying pdf-parse with different options...');
        const pdfParse = await import('pdf-parse');
        
        const fallbackOptions = {
          normalizeWhitespace: true,
          disableCombineTextItems: true
        };
        
        const pdfData = await pdfParse.default(buffer, fallbackOptions);
        
        if (pdfData.text && pdfData.text.trim().length > 5) {
          console.log(`✅ pdf-parse retry extracted ${pdfData.text.length} characters`);
          return pdfData.text.trim();
        }
        
      } catch (retryError) {
        console.log('⚠️ pdf-parse retry also failed:', retryError.message);
      }
    }
    
    // Method 4: Basic text extraction as last resort
    try {
      console.log('🔍 Attempting basic text extraction...');
      
      const bufferString = buffer.toString('latin1');
      const allMatches = bufferString.match(/\(([^)]{2,})\)/g);
      
      if (allMatches && allMatches.length > 0) {
        const extractedText = allMatches
          .map(match => match.slice(1, -1))
          .filter(text => {
            return text.length > 1 && 
                   /[a-zA-Z0-9äöüÄÖÜß]/.test(text) && 
                   !text.includes('endstream') && 
                   !text.includes('xref') &&
                   !text.includes('trailer') &&
                   !text.includes('ReportLab');
          })
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (extractedText.length > 10) {
          console.log(`✅ Basic extraction found ${extractedText.length} characters`);
          return extractedText;
        }
      }
      
    } catch (basicError) {
      console.log('⚠️ Basic extraction failed:', basicError.message);
    }
    
    console.log('❌ All PDF extraction methods failed');
    return null;
    
  } catch (error) {
    console.error('❌ PDF extraction error:', error.message);
    throw error;
  }
}

// Helper function to extract text from buffer during upload
async function extractTextFromBuffer(buffer, mimeType, fileName) {
  try {
    console.log(`Starting text extraction for ${fileName} (${mimeType})`);
    
    if (mimeType === 'application/pdf') {
      console.log(`Processing PDF buffer: ${fileName} (${buffer.length} bytes)`);
      
      // Try reliable PDF text extraction with multiple methods
      try {
        console.log('🔍 Attempting reliable PDF text extraction...');
        
        const pdfText = await extractPDFTextReliable(buffer, fileName);
        
        if (pdfText && pdfText.trim().length > 10) {
          console.log(`✅ Successfully extracted ${pdfText.length} characters from PDF`);
          return `PDF Document: ${fileName}\n\nExtracted Content:\n${pdfText.trim()}`;
        } else {
          console.log(`⚠️ PDF extraction returned minimal text (${pdfText ? pdfText.length : 0} chars)`);
        }
        
      } catch (extractionError) {
        console.error('❌ PDF text extraction failed:', extractionError.message);
      }
      
      // If PDF extraction fails, use intelligent analysis based on filename
      console.log('📝 Using intelligent metadata analysis as fallback');
      return await getIntelligentMetadataAnalysis(fileName, buffer.length);
      
    } else if (mimeType.startsWith('image/')) {
      console.log(`Processing image: ${fileName}`);
      
      try {
        // Use Tesseract.js for OCR
        const Tesseract = await import('tesseract.js');
        
        console.log('Starting OCR with Tesseract.js');
        const { data: { text } } = await Tesseract.recognize(buffer, 'deu+eng', {
          logger: m => console.log('OCR Progress:', m)
        });
        
        if (text && text.trim().length > 10) {
          console.log(`Successfully extracted ${text.length} characters via OCR`);
          return `Image Document: ${fileName}\n\nOCR Extracted Content:\n${text.trim()}`;
        } else {
          console.log('OCR extracted minimal text');
          return `Image Document: ${fileName}\n\nOCR extraction completed but minimal text found. This may be a low-quality scan or image without text.`;
        }
        
      } catch (ocrError) {
        console.error('OCR failed:', ocrError);
        return `Image Document: ${fileName}\n\nOCR extraction failed: ${ocrError.message}. Manual review required.`;
      }
      
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      console.log(`Processing Word document: ${fileName}`);
      
      try {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        
        if (result.value && result.value.trim().length > 0) {
          console.log(`Successfully extracted ${result.value.length} characters from Word document`);
          return `Word Document: ${fileName}\n\nExtracted Content:\n${result.value.trim()}`;
        } else {
          return `Word Document: ${fileName}\n\nNo text content found in document.`;
        }
        
      } catch (wordError) {
        console.error('Word document extraction failed:', wordError);
        return `Word Document: ${fileName}\n\nText extraction failed: ${wordError.message}`;
      }
      
    } else if (mimeType.includes('xml') || fileName.endsWith('.xml')) {
      const xmlContent = buffer.toString('utf-8');
      console.log(`Successfully extracted ${xmlContent.length} characters from XML`);
      return `XML Document: ${fileName}\n\nContent:\n${xmlContent}`;
      
    } else if (mimeType.startsWith('text/')) {
      const textContent = buffer.toString('utf-8');
      console.log(`Successfully extracted ${textContent.length} characters from text file`);
      return `Text Document: ${fileName}\n\nContent:\n${textContent}`;
      
    } else {
      console.log(`Unsupported file type: ${mimeType}`);
      return `File: ${fileName}\n\nText extraction not supported for file type: ${mimeType}. Manual review required.`;
    }
    
  } catch (error) {
    console.error('Text extraction error:', error);
    return `File: ${fileName}\n\nText extraction failed: ${error.message}. Manual review required.`;
  }
}

// Enhanced intelligent metadata analysis
async function getIntelligentMetadataAnalysis(fileName, fileSize) {
  const lowerName = fileName.toLowerCase();
  const year = fileName.match(/20\d{2}/)?.[0] || '2024';
  
  let documentContext = `PDF Document: ${fileName} (${fileSize} bytes, Jahr: ${year})\n\n`;
  documentContext += `HINWEIS: Vollständige Textextraktion nicht möglich - möglicherweise gescanntes Dokument oder bildbasierte PDF.\n\n`;
  
  // Enhanced pattern recognition
  const patterns = {
    donation: ['spenden', 'donation', 'zuwendung', 'gemeinnützig', 'hilft'],
    receipt: ['quittung', 'receipt', 'beleg', 'kassenbon', 'bon'],
    invoice: ['rechnung', 'invoice', 'faktura', 'rg'],
    salary: ['lohn', 'gehalt', 'salary', 'entgelt', 'lohnabrechnung'],
    tax: ['steuer', 'tax', 'est', 'einkommensteuer', 'umsatzsteuer'],
    medical: ['arzt', 'medical', 'medizin', 'kranken', 'gesundheit', 'apotheke'],
    insurance: ['versicherung', 'insurance', 'police', 'beitrag'],
    utility: ['strom', 'gas', 'wasser', 'telefon', 'internet', 'telekom'],
    education: ['bildung', 'schule', 'universität', 'kurs', 'fortbildung', 'seminar']
  };
  
  let detectedType = 'other';
  let confidence = 0.5;
  
  for (const [type, keywords] of Object.entries(patterns)) {
    const matches = keywords.filter(keyword => lowerName.includes(keyword)).length;
    if (matches > 0) {
      detectedType = type;
      confidence = Math.min(0.3 + (matches * 0.2), 0.9);
      break;
    }
  }
  
  // Add type-specific analysis
  switch (detectedType) {
    case 'donation':
      documentContext += `SPENDENQUITTUNG ERKANNT (Confidence: ${Math.round(confidence * 100)}%)\n`;
      documentContext += `Jahr: ${year}\n`;
      documentContext += `Steuerliche Relevanz: Sonderausgaben (§ 10b EStG)\n`;
      documentContext += `Abzugsfähig: Bis zu 20% des Gesamtbetrags der Einkünfte\n\n`;
      documentContext += `Erforderliche Angaben für steuerliche Anerkennung:\n`;
      documentContext += `- Name und Anschrift der begünstigten Organisation\n`;
      documentContext += `- Bestätigung der Gemeinnützigkeit (Freistellungsbescheid)\n`;
      documentContext += `- Spendenbetrag in Ziffern und Buchstaben\n`;
      documentContext += `- Datum der Zuwendung\n`;
      documentContext += `- Verwendungszweck der Spende\n`;
      documentContext += `- Unterschrift des Empfängers\n\n`;
      documentContext += `EMPFEHLUNG: Spende in Anlage Sonderausgaben eintragen.`;
      break;
      
    case 'receipt':
      documentContext += `QUITTUNG/BELEG ERKANNT (Confidence: ${Math.round(confidence * 100)}%)\n`;
      documentContext += `Jahr: ${year}\n`;
      documentContext += `Steuerliche Relevanz: Betriebsausgaben oder Werbungskosten\n\n`;
      documentContext += `Erforderliche Angaben für steuerliche Anerkennung:\n`;
      documentContext += `- Vollständiger Name und Anschrift des Leistungserbringers\n`;
      documentContext += `- Datum der Leistung\n`;
      documentContext += `- Art und Umfang der Leistung\n`;
      documentContext += `- Entgelt und darauf entfallender Steuerbetrag\n`;
      documentContext += `- Steuersatz oder Hinweis auf Steuerbefreiung\n\n`;
      documentContext += `EMPFEHLUNG: Prüfung auf Absetzbarkeit als Werbungskosten oder Betriebsausgaben.`;
      break;
      
    case 'invoice':
      documentContext += `RECHNUNG ERKANNT (Confidence: ${Math.round(confidence * 100)}%)\n`;
      documentContext += `Jahr: ${year}\n`;
      documentContext += `Steuerliche Relevanz: Umsatzsteuer und Betriebsausgaben\n\n`;
      documentContext += `Pflichtangaben einer ordnungsgemäßen Rechnung:\n`;
      documentContext += `- Vollständiger Name und Anschrift des Rechnungsstellers\n`;
      documentContext += `- Steuernummer oder Umsatzsteuer-Identifikationsnummer\n`;
      documentContext += `- Rechnungsdatum und fortlaufende Rechnungsnummer\n`;
      documentContext += `- Menge und Art der Lieferung/Leistung\n`;
      documentContext += `- Entgelt und darauf entfallender Steuerbetrag\n`;
      documentContext += `- Steuersatz\n\n`;
      documentContext += `EMPFEHLUNG: Wichtig für Umsatzsteuer-Voranmeldung und Betriebsausgaben.`;
      break;
      
    case 'medical':
      documentContext += `MEDIZINISCHE AUSGABEN ERKANNT (Confidence: ${Math.round(confidence * 100)}%)\n`;
      documentContext += `Jahr: ${year}\n`;
      documentContext += `Steuerliche Relevanz: Außergewöhnliche Belastungen (§ 33 EStG)\n\n`;
      documentContext += `Absetzbar als außergewöhnliche Belastungen:\n`;
      documentContext += `- Arztkosten, Zahnarztkosten\n`;
      documentContext += `- Medikamente (verschreibungspflichtig)\n`;
      documentContext += `- Krankenhaus- und Kurkosten\n`;
      documentContext += `- Hilfsmittel (Brille, Hörgerät, etc.)\n\n`;
      documentContext += `WICHTIG: Zumutbare Eigenbelastung wird abgezogen (1-7% des Einkommens)\n`;
      documentContext += `EMPFEHLUNG: Sammlung aller medizinischen Ausgaben für Gesamtbetrachtung.`;
      break;
      
    default:
      documentContext += `STEUERRELEVANTES DOKUMENT ERKANNT (Confidence: ${Math.round(confidence * 100)}%)\n`;
      documentContext += `Jahr: ${year}\n`;
      documentContext += `Hinweis: Automatische Klassifizierung basierend auf Dateiname.\n`;
      documentContext += `Für detaillierte Analyse ist eine manuelle Prüfung des Dokumentinhalts erforderlich.\n\n`;
      documentContext += `EMPFEHLUNG: Dokument von Steuerberater prüfen lassen.`;
  }
  
  return documentContext;
}

// Helper function to extract text from different file types (legacy - for existing files)
async function extractTextFromFile(blobUrl, mimeType, fileName, fileSize) {
  try {
    if (mimeType === 'application/pdf') {
      console.log(`Extracting text from PDF: ${fileName}`);
      
      try {
        // Use pdfjs-dist for PDF text extraction (serverless-compatible)
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js');
        
        // Fetch PDF data
        const response = await fetch(blobUrl);
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Load PDF document
        const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
        const pdf = await loadingTask.promise;
        
        let fullText = '';
        
        // Extract text from all pages
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += pageText + '\n';
        }
        
        if (fullText.trim()) {
          console.log(`Successfully extracted ${fullText.length} characters from PDF`);
          return `PDF Document: ${fileName}\n\nExtracted Content:\n${fullText.trim()}`;
        } else {
          console.log('PDF appears to be empty or image-based');
          // Fallback to intelligent metadata analysis
          return await getIntelligentMetadataAnalysis(fileName, fileSize);
        }
        
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError);
        // Fallback to intelligent metadata analysis
        return await getIntelligentMetadataAnalysis(fileName, fileSize);
      }
    } else if (mimeType.startsWith('image/')) {
      // For images, you would use OCR like Tesseract
      return 'OCR text extraction would be implemented here';
    } else if (mimeType.includes('xml') || fileName.endsWith('.xml')) {
      // Fetch content from Vercel Blob
      const response = await fetch(blobUrl);
      const content = await response.text();
      return content;
    } else if (mimeType.includes('text')) {
      // Fetch content from Vercel Blob
      const response = await fetch(blobUrl);
      const content = await response.text();
      return content;
    }
    return '';
  } catch (error) {
    console.error('Error extracting text:', error);
    return '';
  }
}

// Helper function to classify document type using AI
async function classifyDocument(content, filename) {
  try {
    if (!openai) {
      // Mock classification based on filename
      const lowerName = filename.toLowerCase();
      if (lowerName.includes('est') || lowerName.includes('steuer')) return 'tax_form';
      if (lowerName.includes('rechnung') || lowerName.includes('invoice')) return 'invoice';
      if (lowerName.includes('quittung') || lowerName.includes('receipt')) return 'receipt';
      if (lowerName.includes('spende') || lowerName.includes('donation')) return 'donation';
      if (lowerName.includes('lohn') || lowerName.includes('gehalt')) return 'salary';
      return 'other';
    }

    const prompt = `
    Analyze this document content and filename to classify the document type.
    
    Filename: ${filename}
    Content: ${content.substring(0, 1000)}...
    
    Classify this document as one of:
    - tax_form: Official tax forms or returns
    - receipt: Purchase receipts or invoices
    - invoice: Business invoices
    - donation: Donation certificates or receipts
    - salary: Salary statements or pay slips
    - other: Any other document type
    
    Respond with just the classification (e.g., "tax_form").
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 50,
      temperature: 0.1
    });

    return response.choices[0].message.content.trim().toLowerCase();
  } catch (error) {
    console.error('Error classifying document:', error);
    return 'other';
  }
}

// Helper function to generate expert opinion using AI
async function generateExpertOpinion(documentType, extractedContent, filename) {
  try {
    // Check if OpenAI API key is configured
    if (!openai) {
      console.log('OpenAI API key not configured, returning mock analysis');
      return {
        summary: `Mock-Analyse für ${filename}: OpenAI API-Schlüssel nicht konfiguriert. Bitte setzen Sie OPENAI_API_KEY in der .env Datei für echte KI-Analyse.`,
        taxRelevance: "medium",
        taxImplications: ["Mock: Steuerliche Relevanz erkannt", "Konfigurieren Sie OpenAI API für echte Analyse"],
        legalConsiderations: ["Mock: Rechtliche Prüfung empfohlen", "Echte Analyse erfordert OpenAI API-Schlüssel"],
        potentialDeductions: [
          {
            category: "Demo-Abzug",
            amount: 100,
            description: "Beispiel-Abzug (Mock-Daten)",
            confidence: 0.5,
            requirements: ["OpenAI API-Schlüssel konfigurieren"]
          }
        ],
        recommendations: ["OpenAI API-Schlüssel in .env Datei setzen für echte KI-Analyse"],
        warnings: ["Dies sind Mock-Daten - konfigurieren Sie OpenAI API für echte Analyse"],
        confidence: 0.5
      };
    }
    const prompt = `
    Analysieren Sie dieses deutsche Steuerdokument als Experte und geben Sie eine umfassende Bewertung ab.
    
    Dokumenttyp: ${documentType}
    Dateiname: ${filename}
    Inhalt: ${extractedContent}
    
    Bitte analysieren Sie:
    1. Eine Zusammenfassung des Dokuments
    2. Steuerliche Relevanz (high/medium/low/none)
    3. Rechtliche Überlegungen für deutsche Steuern
    4. Potenzielle Steuerabzüge mit Beträgen falls erkennbar
    5. Empfehlungen für den Steuerpflichtigen
    6. Warnungen oder wichtige Hinweise
    
    Antworten Sie NUR mit gültigem JSON in dieser Struktur (alle Texte auf Deutsch):
    {
      "summary": "Kurze Zusammenfassung des Dokuments auf Deutsch",
      "taxRelevance": "high|medium|low|unknown",
      "taxImplications": ["Steuerliche Auswirkung 1", "Steuerliche Auswirkung 2"],
      "legalConsiderations": ["Rechtliche Überlegung 1", "Rechtliche Überlegung 2"],
      "potentialDeductions": [
        {
          "category": "Kategoriename",
          "amount": null,
          "description": "Beschreibung auf Deutsch",
          "confidence": 0.8,
          "requirements": ["Voraussetzung 1", "Voraussetzung 2"]
        }
      ],
      "recommendations": ["Empfehlung 1", "Empfehlung 2"],
      "warnings": ["Warnung 1", "Warnung 2"],
      "confidence": 0.85
    }
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ 
        role: "system", 
        content: "Sie sind ein deutscher Steuerexperte. Antworten Sie IMMER auf Deutsch und NUR mit gültigem JSON, ohne zusätzlichen Text. Alle Texte in der JSON-Antwort müssen auf Deutsch sein."
      }, { 
        role: "user", 
        content: prompt 
      }],
      max_tokens: 1500,
      temperature: 0.3
    });

    const content = response.choices[0].message.content.trim();
    
    // Try to extract JSON if response contains other text
    let jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return JSON.parse(content);
  } catch (error) {
    console.error('Error generating expert opinion:', error);
    return {
      summary: "Dokumentanalyse derzeit nicht möglich. Bitte versuchen Sie es später erneut.",
      taxRelevance: "unknown",
      taxImplications: ["Analyse fehlgeschlagen - manuelle Prüfung erforderlich"],
      legalConsiderations: ["Dokument sollte von einem Steuerberater geprüft werden"],
      potentialDeductions: [],
      recommendations: ["Bitte wenden Sie sich an einen Steuerberater für eine detaillierte Analyse"],
      warnings: ["Automatische Analyse fehlgeschlagen - manuelle Prüfung empfohlen"],
      confidence: 0.0
    };
  }
}

// Helper function to search tax law using Tavily API
async function searchTaxLaw(query) {
  try {
    const tavilyApiKey = process.env.TAVILY_API_KEY || 'your-tavily-api-key';
    
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tavilyApiKey}`
      },
      body: JSON.stringify({
        query: `${query} German tax law 2024`,
        search_depth: 'advanced',
        include_domains: ['bundesfinanzministerium.de', 'gesetze-im-internet.de', 'steuerberater.de'],
        max_results: 10
      })
    });

    if (!response.ok) {
      throw new Error('Tavily API request failed');
    }

    const data = await response.json();
    
    // Transform Tavily results to our format
    const results = data.results?.map(result => ({
      title: result.title,
      description: result.content,
      effectiveDate: '2024-01-01', // Default date
      impact: 'medium', // Default impact
      category: 'General',
      source: result.url
    })) || [];

    return {
      query,
      results,
      summary: `Found ${results.length} relevant tax law updates for: ${query}`,
      relevantChanges: results.slice(0, 3).map(r => r.title)
    };
  } catch (error) {
    console.error('Error searching tax law:', error);
    // Return mock data if API fails
    return {
      query,
      results: [
        {
          title: "Tax Changes 2024 - Overview",
          description: "Comprehensive overview of German tax changes for 2024 including new deduction limits and digital obligations.",
          effectiveDate: "2024-01-01",
          impact: "high",
          category: "General",
          source: "https://example.com"
        }
      ],
      summary: "Mock tax law search results (API not configured)",
      relevantChanges: ["New digital tax obligations", "Updated deduction limits", "Changes to home office rules"]
    };
  }
}

// API Routes

// Document upload
app.post('/api/documents/upload', upload.single('document'), async (req, res) => {
  try {
    console.log('Upload request received');
    
    if (!req.file) {
      console.log('No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('File received:', req.file.originalname, req.file.size, 'bytes');

    // Extract text content immediately during upload
    let extractedText = '';
    
    try {
      console.log('Starting text extraction');
      extractedText = await extractTextFromBuffer(req.file.buffer, req.file.mimetype, req.file.originalname);
      console.log(`Successfully extracted ${extractedText.length} characters from ${req.file.originalname}`);
      
    } catch (extractError) {
      console.error('Text extraction failed during upload:', extractError);
      extractedText = `Text extraction failed for ${req.file.originalname}. Manual review required.`;
      // Don't fail the upload if text extraction fails
    }

    // Save to database
    let document = null;
    if (db) {
      try {
        console.log('Attempting to save document to database');
        document = await db.createDocument({
          name: req.file.originalname,
          originalFilename: req.file.originalname,
          fileType: req.file.mimetype,
          fileSize: req.file.size,
          fileData: req.file.buffer, // Store file data directly in database
          extractedText: extractedText,
          documentType: null // Will be determined during analysis
        });
        console.log('Document saved to database with ID:', document.id);
        
        // Also store in Qdrant for semantic search (if text was extracted)
        if (extractedText && extractedText.length > 50) {
          try {
            await storeDocumentInQdrant(document.id.toString(), extractedText, {
              filename: req.file.originalname,
              type: req.file.mimetype,
              size: req.file.size,
              uploadDate: new Date().toISOString(),
              documentType: detectDocumentType(req.file.originalname, extractedText),
              language: detectLanguage(extractedText)
            });
            console.log('Document also stored in Qdrant for semantic search');
          } catch (qdrantError) {
            console.error('Failed to store in Qdrant (non-critical):', qdrantError);
            // Don't fail the upload if Qdrant storage fails
          }
        } else {
          console.log('Skipping Qdrant storage - insufficient text content');
        }
        
      } catch (dbError) {
        console.error('Failed to save to database:', dbError);
        return res.status(500).json({ error: 'Database storage failed: ' + dbError.message });
      }
    } else {
      return res.status(500).json({ error: 'Database not available' });
    }
    
    // Create response document format
    const responseDocument = {
      id: document.id.toString(),
      name: document.name,
      type: document.file_type,
      size: document.file_size,
      uploadDate: document.upload_date,
      extractedText: document.extracted_text ? document.extracted_text.substring(0, 1000) : extractedText.substring(0, 1000),
      contentAnalysis: {
        hasText: extractedText.length > 50,
        isScanned: req.file.mimetype === 'application/pdf' && extractedText.length < 100,
        language: detectLanguage(extractedText),
        confidence: calculateExtractionConfidence(extractedText)
      }
    };
    
    // Add to in-memory storage for compatibility
    documents.push(responseDocument);
    
    console.log('Sending response');
    res.json(responseDocument);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed: ' + error.message });
  }
});

// Get all documents
app.get('/api/documents', async (req, res) => {
  try {
    // Get documents from database
    if (db) {
      try {
        const dbDocuments = await db.getDocuments();
        
        // Convert to response format
        const responseDocuments = dbDocuments.map(doc => ({
          id: doc.id.toString(),
          name: doc.name,
          type: doc.file_type,
          size: doc.file_size,
          uploadDate: doc.upload_date,
          extractedText: doc.extracted_text ? doc.extracted_text.substring(0, 1000) : '',
          contentAnalysis: {
            hasText: doc.extracted_text && doc.extracted_text.length > 50,
            isScanned: doc.file_type === 'application/pdf' && (!doc.extracted_text || doc.extracted_text.length < 100),
            language: detectLanguage(doc.extracted_text || ''),
            confidence: calculateExtractionConfidence(doc.extracted_text || '')
          }
        }));
        
        return res.json(responseDocuments);
      } catch (dbError) {
        console.error('Database error:', dbError);
        return res.status(500).json({ error: 'Database error: ' + dbError.message });
      }
    }

    // Fallback to in-memory documents if database not available
    return res.json(documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents: ' + error.message });
  }
});

// Serve document file from database
app.get('/api/documents/:id/file', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (db) {
      const document = await db.getDocumentById(parseInt(id));
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      const fileData = await db.getDocumentData(parseInt(id));
      if (!fileData) {
        return res.status(404).json({ error: 'Document file data not found' });
      }
      
      res.set({
        'Content-Type': document.file_type,
        'Content-Length': fileData.length,
        'Content-Disposition': `inline; filename="${document.name}"`
      });
      
      res.send(fileData);
    } else {
      res.status(500).json({ error: 'Database not available' });
    }
  } catch (error) {
    console.error('Error serving document file:', error);
    res.status(500).json({ error: 'Failed to serve document file: ' + error.message });
  }
});

// Delete document
app.delete('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (db) {
      try {
        await db.deleteDocument(parseInt(id));
        
        // Remove from in-memory storage
        const index = documents.findIndex(doc => doc.id === id);
        if (index !== -1) {
          documents.splice(index, 1);
        }
        delete documentAnalyses[id];
        
        res.json({ message: 'Document deleted successfully' });
      } catch (dbError) {
        console.error('Database error deleting document:', dbError);
        res.status(500).json({ error: 'Failed to delete document: ' + dbError.message });
      }
    } else {
      // Fallback to in-memory deletion
      const index = documents.findIndex(doc => doc.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      documents.splice(index, 1);
      delete documentAnalyses[id];
      
      res.json({ message: 'Document deleted successfully' });
    }
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Delete failed: ' + error.message });
  }
});

// Search documents using semantic similarity
app.post('/api/documents/search', async (req, res) => {
  try {
    const { query, limit = 5 } = req.body;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    console.log(`🔍 Semantic search request: "${query}"`);
    
    try {
      // Search in Qdrant using semantic similarity
      const searchResults = await searchDocumentsInQdrant(query.trim(), limit);
      
      // Enhance results with database information if available
      const enhancedResults = [];
      
      for (const result of searchResults) {
        let enhancedResult = { ...result };
        
        // Try to get additional info from database
        if (db && result.id) {
          try {
            const dbDocument = await db.getDocumentById(parseInt(result.id));
            if (dbDocument) {
              enhancedResult = {
                ...enhancedResult,
                id: dbDocument.id.toString(),
                name: dbDocument.name,
                type: dbDocument.file_type,
                size: dbDocument.file_size,
                uploadDate: dbDocument.upload_date,
                extractedText: result.text || dbDocument.extracted_text,
                similarity: result.score,
                documentType: result.documentType || 'unknown'
              };
            }
          } catch (dbError) {
            console.log('Could not enhance result with database info:', dbError.message);
          }
        }
        
        enhancedResults.push(enhancedResult);
      }
      
      console.log(`✅ Found ${enhancedResults.length} semantically similar documents`);
      
      res.json({
        query: query,
        results: enhancedResults,
        total: enhancedResults.length,
        searchType: 'semantic'
      });
      
    } catch (qdrantError) {
      console.error('Qdrant search failed:', qdrantError);
      
      // Fallback to simple text search in database
      if (db) {
        try {
          console.log('Falling back to database text search...');
          const dbDocuments = await db.getDocuments();
          
          const filteredResults = dbDocuments
            .filter(doc => {
              const searchText = (doc.extracted_text || '').toLowerCase();
              const searchQuery = query.toLowerCase();
              return searchText.includes(searchQuery) || doc.name.toLowerCase().includes(searchQuery);
            })
            .slice(0, limit)
            .map(doc => ({
              id: doc.id.toString(),
              name: doc.name,
              type: doc.file_type,
              size: doc.file_size,
              uploadDate: doc.upload_date,
              extractedText: doc.extracted_text,
              similarity: 0.5, // Default similarity for text search
              documentType: detectDocumentType(doc.name, doc.extracted_text || ''),
              searchType: 'text'
            }));
          
          console.log(`📝 Fallback search found ${filteredResults.length} documents`);
          
          return res.json({
            query: query,
            results: filteredResults,
            total: filteredResults.length,
            searchType: 'text_fallback'
          });
          
        } catch (dbError) {
          console.error('Database fallback search failed:', dbError);
        }
      }
      
      // Final fallback to in-memory search
      const memoryResults = documents
        .filter(doc => {
          const searchText = (doc.extractedText || '').toLowerCase();
          const searchQuery = query.toLowerCase();
          return searchText.includes(searchQuery) || doc.name.toLowerCase().includes(searchQuery);
        })
        .slice(0, limit)
        .map(doc => ({
          ...doc,
          similarity: 0.3,
          searchType: 'memory'
        }));
      
      res.json({
        query: query,
        results: memoryResults,
        total: memoryResults.length,
        searchType: 'memory_fallback'
      });
    }
    
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed: ' + error.message });
  }
});

// Analyze document
app.post('/api/ai/analyze', async (req, res) => {
  console.log('AI analyze endpoint called with:', req.body);
  try {
    const { documentId } = req.body;
    
    // Get document from database first
    let document = null;
    if (db) {
      try {
        const dbDocument = await db.getDocumentById(parseInt(documentId));
        if (dbDocument) {
          document = {
            id: dbDocument.id.toString(),
            name: dbDocument.name,
            type: dbDocument.file_type,
            size: dbDocument.file_size,
            uploadDate: dbDocument.upload_date,
            blobUrl: dbDocument.blob_url,
            blobPathname: dbDocument.blob_pathname,
            extractedText: dbDocument.extracted_text
          };
          console.log(`Found document in database: ${document.name}`);
        }
      } catch (dbError) {
        console.error('Database error, falling back to blob storage:', dbError);
      }
    }

    // No blob storage fallback needed - using database only
    
    // Final fallback to in-memory documents
    if (!document) {
      document = documents.find(doc => doc.id === documentId);
    }
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check if already analyzed in database
    if (db) {
      try {
        const existingAnalysis = await db.getAnalysisByDocumentId(parseInt(documentId));
        if (existingAnalysis) {
          console.log(`Found existing analysis in database for document ${documentId}`);
          const analysis = {
            documentType: existingAnalysis.document_type,
            taxRelevance: existingAnalysis.tax_relevance,
            extractedData: existingAnalysis.extracted_data,
            expertOpinion: existingAnalysis.expert_opinion,
            suggestedActions: existingAnalysis.suggested_actions,
            confidence: existingAnalysis.confidence
          };
          return res.json(analysis);
        }
      } catch (dbError) {
        console.error('Database error checking existing analysis:', dbError);
      }
    }

    // Fallback: Check if already analyzed in memory
    if (documentAnalyses[documentId]) {
      return res.json(documentAnalyses[documentId]);
    }

    // Get text content - use pre-extracted text if available, otherwise extract on-demand
    let content = '';
    if (document.textBlobUrl) {
      // Use pre-extracted text from upload
      try {
        const textResponse = await fetch(document.textBlobUrl);
        content = await textResponse.text();
        console.log(`Using pre-extracted text (${content.length} characters) for ${document.name}`);
      } catch (textError) {
        console.error('Failed to fetch pre-extracted text:', textError);
        // Fallback to on-demand extraction
        content = await extractTextFromFile(document.blobUrl || document.filePath, document.type, document.name, document.size);
      }
    } else if (document.extractedText) {
      // Use text stored in document object (for backward compatibility)
      content = document.extractedText;
      console.log(`Using stored extracted text for ${document.name}`);
    } else {
      // Fallback to on-demand extraction for old documents
      content = await extractTextFromFile(document.blobUrl || document.filePath, document.type, document.name, document.size);
      console.log(`Using on-demand text extraction for ${document.name}`);
    }
    
    // Classify document
    const documentType = await classifyDocument(content, document.name);
    
    // Generate expert opinion
    const expertOpinion = await generateExpertOpinion(documentType, content, document.name);
    
    const analysis = {
      documentType,
      taxRelevance: expertOpinion.taxRelevance,
      extractedData: { content: content.substring(0, 500) },
      expertOpinion,
      suggestedActions: expertOpinion.recommendations,
      confidence: expertOpinion.confidence
    };

    // Save analysis to database
    if (db) {
      try {
        await db.createAnalysis({
          documentId: parseInt(documentId),
          documentType,
          taxRelevance: expertOpinion.taxRelevance,
          confidence: expertOpinion.confidence,
          expertOpinion,
          extractedData: { content: content.substring(0, 500) },
          suggestedActions: expertOpinion.recommendations
        });
        console.log(`Analysis saved to database for document ${documentId}`);
      } catch (dbError) {
        console.error('Failed to save analysis to database:', dbError);
      }
    }

    // Also save to memory for backward compatibility
    documentAnalyses[documentId] = analysis;
    res.json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// Tax law search
app.post('/api/research/search', async (req, res) => {
  try {
    const { query } = req.body;
    const results = await searchTaxLaw(query);
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get document processing status
app.get('/api/documents/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get document from database or memory
    let document = null;
    if (db) {
      try {
        const dbDocument = await db.getDocumentById(parseInt(id));
        if (dbDocument) {
          document = {
            id: dbDocument.id.toString(),
            name: dbDocument.name,
            extractedText: dbDocument.extracted_text
          };
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
      }
    }
    
    if (!document) {
      document = documents.find(doc => doc.id === id);
    }
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Determine processing status based on extracted text availability
    const hasExtractedText = document.extractedText && document.extractedText.length > 50;
    
    res.json({
      status: hasExtractedText ? 'completed' : 'processing',
      progress: hasExtractedText ? 100 : 50,
      extractedText: hasExtractedText ? document.extractedText.substring(0, 1000) : undefined
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ 
      status: 'failed',
      progress: 0,
      error: error.message 
    });
  }
});

// Reprocess document with enhanced extraction
app.post('/api/documents/:id/reprocess', async (req, res) => {
  try {
    const { id } = req.params;
    const { useOCR = false, enhancedExtraction = true } = req.body;
    
    console.log(`Reprocessing document ${id} with options:`, { useOCR, enhancedExtraction });
    
    // Get document from database or memory
    let document = null;
    if (db) {
      try {
        const dbDocument = await db.getDocumentById(parseInt(id));
        if (dbDocument) {
          document = {
            id: dbDocument.id.toString(),
            name: dbDocument.name,
            type: dbDocument.file_type,
            size: dbDocument.file_size,
            uploadDate: dbDocument.upload_date,
            blobUrl: dbDocument.blob_url,
            blobPathname: dbDocument.blob_pathname,
            extractedText: dbDocument.extracted_text
          };
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
      }
    }
    
    if (!document) {
      document = documents.find(doc => doc.id === id);
    }
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Re-extract text with enhanced options
    let newExtractedText = '';
    
    if (db) {
      try {
        // Get the document file data from database
        const fileData = await db.getDocumentData(parseInt(id));
        if (!fileData) {
          return res.status(404).json({ error: 'Document file data not found' });
        }
        
        // Re-extract with enhanced options
        if (useOCR && document.type.startsWith('image/')) {
          console.log('Using OCR for image reprocessing');
          newExtractedText = await extractTextFromBuffer(fileData, document.type, document.name);
        } else if (enhancedExtraction) {
          console.log('Using enhanced extraction for reprocessing');
          newExtractedText = await extractTextFromBuffer(fileData, document.type, document.name);
        } else {
          // Use existing text
          newExtractedText = document.extractedText || '';
        }
        
      } catch (fetchError) {
        console.error('Error fetching document for reprocessing:', fetchError);
        return res.status(500).json({ error: 'Failed to fetch document for reprocessing' });
      }
    } else {
      return res.status(500).json({ error: 'Database not available for reprocessing' });
    }
    
    // Update document with new extracted text
    if (db && newExtractedText !== document.extractedText) {
      try {
        await db.query(
          'UPDATE documents SET extracted_text = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [newExtractedText, parseInt(id)]
        );
        console.log(`Updated extracted text in database for document ${id}`);
      } catch (dbError) {
        console.error('Failed to update database:', dbError);
      }
    }
    
    // Update in-memory document
    const memoryDoc = documents.find(doc => doc.id === id);
    if (memoryDoc) {
      memoryDoc.extractedText = newExtractedText;
    }
    
    // Return updated document with content analysis
    const processedDocument = {
      ...document,
      extractedText: newExtractedText,
      contentAnalysis: {
        hasText: newExtractedText.length > 50,
        isScanned: document.type === 'application/pdf' && newExtractedText.length < 100,
        language: detectLanguage(newExtractedText),
        confidence: calculateExtractionConfidence(newExtractedText)
      }
    };
    
    res.json(processedDocument);
    
  } catch (error) {
    console.error('Reprocessing error:', error);
    res.status(500).json({ error: 'Reprocessing failed: ' + error.message });
  }
});

// Helper functions for reprocessing
function detectLanguage(text) {
  if (!text || text.length < 50) return 'unknown';
  
  const germanWords = ['der', 'die', 'das', 'und', 'ist', 'mit', 'für', 'von', 'auf', 'zu', 'steuer', 'rechnung', 'betrag'];
  const englishWords = ['the', 'and', 'is', 'with', 'for', 'from', 'on', 'to', 'tax', 'invoice', 'amount'];
  
  const lowerText = text.toLowerCase();
  const germanCount = germanWords.filter(word => lowerText.includes(word)).length;
  const englishCount = englishWords.filter(word => lowerText.includes(word)).length;
  
  if (germanCount > englishCount) return 'de';
  if (englishCount > germanCount) return 'en';
  return 'unknown';
}

function calculateExtractionConfidence(text) {
  if (!text) return 0;
  
  let confidence = Math.min(text.length / 1000, 1);
  
  if (text.includes('€') || text.includes('EUR')) confidence += 0.1;
  if (/\d{2}\.\d{2}\.\d{4}/.test(text)) confidence += 0.1;
  if (/\d+[,\.]\d{2}/.test(text)) confidence += 0.1;
  if (text.includes('Rechnung') || text.includes('Invoice')) confidence += 0.1;
  if (text.includes('Steuer') || text.includes('Tax')) confidence += 0.1;
  
  return Math.min(confidence, 1);
}

// Get recent tax updates for 2024
app.get('/api/research/updates/2024', async (req, res) => {
  try {
    // Mock data for recent tax updates
    const updates = [
      {
        title: "Digital Tax Obligations 2024",
        description: "New requirements for digital documentation and electronic submission of tax returns.",
        effectiveDate: "2024-01-01",
        impact: "high",
        category: "Digital",
        source: "https://bundesfinanzministerium.de"
      },
      {
        title: "Home Office Deduction Changes",
        description: "Updated rules for home office deductions with new maximum limits and requirements.",
        effectiveDate: "2024-01-01",
        impact: "medium",
        category: "Deductions",
        source: "https://steuerberater.de"
      },
      {
        title: "Electric Vehicle Tax Benefits Extended",
        description: "Extension of tax benefits for electric and hybrid vehicles through 2024.",
        effectiveDate: "2024-01-01",
        impact: "medium",
        category: "Vehicles",
        source: "https://gesetze-im-internet.de"
      }
    ];
    
    res.json(updates);
  } catch (error) {
    console.error('Updates error:', error);
    res.status(500).json({ error: 'Failed to fetch updates' });
  }
});

// Generate tax declaration
app.post('/api/tax/generate-declaration', async (req, res) => {
  try {
    const { personalInfo, incomeData, deductionData, documents } = req.body;
    
    // Calculate tax (simplified German tax calculation)
    const taxableIncome = Math.max(0, incomeData.total - deductionData.total);
    let calculatedTax = 0;
    
    // Simplified German tax brackets for 2024
    if (taxableIncome > 66760) {
      calculatedTax = 15694 + (taxableIncome - 66760) * 0.42;
    } else if (taxableIncome > 17005) {
      calculatedTax = (taxableIncome - 17005) * 0.14 + (taxableIncome - 17005) * (taxableIncome - 17005) * 0.0000023;
    } else if (taxableIncome > 11604) {
      calculatedTax = (taxableIncome - 11604) * 0.14;
    }
    
    // Assume some tax was already paid (simplified)
    const taxPaid = incomeData.salary * 0.25; // Rough estimate
    const refundAmount = Math.max(0, taxPaid - calculatedTax);
    
    const declaration = {
      personalInfo,
      income: incomeData,
      deductions: deductionData,
      documents: documents || [],
      calculatedTax: Math.round(calculatedTax),
      refundAmount: Math.round(refundAmount)
    };
    
    res.json(declaration);
  } catch (error) {
    console.error('Declaration generation error:', error);
    res.status(500).json({ error: 'Failed to generate declaration' });
  }
});

// Specialized Agents API
app.post('/api/agents/analyze', async (req, res) => {
  try {
    const { agentType, userProfile } = req.body;
    
    // Get regulatory research from Tavily
    const regulatoryBasis = await getGermanTaxRegulations(agentType, userProfile);
    
    let analysis;
    switch (agentType) {
      case 'optimization':
        analysis = await runTaxOptimizationAgent(userProfile, regulatoryBasis);
        break;
      case 'investment':
        analysis = await runInvestmentTaxAgent(userProfile, regulatoryBasis);
        break;
      case 'retirement':
        analysis = await runRetirementPlanningAgent(userProfile, regulatoryBasis);
        break;
      default:
        throw new Error('Unknown agent type');
    }
    
    res.json(analysis);
  } catch (error) {
    console.error('Agent analysis error:', error);
    res.status(500).json({ error: 'Failed to run agent analysis' });
  }
});

// Get German tax regulations using Tavily
async function getGermanTaxRegulations(agentType, userProfile) {
  const queries = {
    optimization: [
      'German tax deductions 2024 optimization strategies',
      'Steueroptimierung Deutschland 2024 legal methods',
      'German tax brackets 2024 optimization'
    ],
    investment: [
      'German investment tax 2024 Abgeltungsteuer',
      'Tax-efficient investing Germany 2024',
      'German capital gains tax optimization 2024'
    ],
    retirement: [
      'German pension tax 2024 Riester Rürup',
      'Retirement planning tax Germany 2024',
      'German pension contributions tax benefits 2024'
    ]
  };

  const searchQueries = queries[agentType] || [];
  const regulations = [];

  for (const query of searchQueries) {
    try {
      const searchResult = await searchTaxLaw(query);
      if (searchResult && searchResult.length > 0) {
        regulations.push(...searchResult.slice(0, 2)); // Take top 2 results per query
      }
    } catch (error) {
      console.error(`Error searching for ${query}:`, error);
    }
  }

  // Fallback regulatory basis if Tavily fails
  if (regulations.length === 0) {
    const fallbackRegulations = {
      optimization: [
        'German Income Tax Act (EStG) §§ 9, 10, 10a - Deductible expenses and special expenses',
        'German Tax Code (AO) § 42 - Tax optimization within legal boundaries',
        'German Investment Tax Act (InvStG) - Investment income taxation rules'
      ],
      investment: [
        'German Investment Tax Act (InvStG) 2024 - Capital gains and dividend taxation',
        'German Banking Act (KWG) - Investment account regulations',
        'EU Savings Directive implementation in German tax law'
      ],
      retirement: [
        'German Pension Tax Act (AltEinkG) - Retirement income taxation',
        'German Income Tax Act (EStG) § 10a - Riester pension contributions',
        'German Pension Scheme Act - Rürup pension tax benefits'
      ]
    };
    return fallbackRegulations[agentType] || [];
  }

  return regulations.map(reg => reg.title || reg.description || reg).slice(0, 5);
}

// Tax Optimization Agent
async function runTaxOptimizationAgent(userProfile, regulatoryBasis) {
  const recommendations = [];
  let totalPotentialSavings = 0;

  // Analyze tax bracket optimization
  const currentTaxRate = calculateGermanTaxRate(userProfile.income);
  if (currentTaxRate > 0.25 && userProfile.employmentType === 'employee') {
    const savingsFromDeductions = Math.min(userProfile.income * 0.05, 2000);
    recommendations.push({
      id: 'tax-bracket-optimization',
      title: 'Tax Bracket Optimization through Deductions',
      description: 'Maximize deductible expenses to reduce taxable income and potentially move to a lower tax bracket.',
      impact: 'high',
      confidence: 85,
      potentialSavings: savingsFromDeductions,
      timeframe: 'Current tax year',
      requirements: [
        'Document all work-related expenses',
        'Consider additional pension contributions',
        'Optimize timing of income and expenses'
      ],
      risks: [
        'Requires proper documentation',
        'Some deductions have annual limits'
      ]
    });
    totalPotentialSavings += savingsFromDeductions;
  }

  // Church tax optimization
  if (userProfile.income > 50000) {
    const churchTaxSavings = userProfile.income * 0.008; // Approximate church tax rate
    recommendations.push({
      id: 'church-tax-optimization',
      title: 'Church Tax Consideration',
      description: 'Evaluate church tax implications and potential optimization strategies.',
      impact: 'medium',
      confidence: 70,
      potentialSavings: churchTaxSavings,
      timeframe: 'Next tax year',
      requirements: [
        'Review church membership status',
        'Consider timing of membership changes',
        'Understand legal implications'
      ],
      risks: [
        'Personal and family considerations',
        'Social implications'
      ]
    });
    totalPotentialSavings += churchTaxSavings;
  }

  // Business expense optimization for freelancers
  if (userProfile.employmentType === 'freelancer') {
    const businessExpenseSavings = Math.min(userProfile.income * 0.15, 5000);
    recommendations.push({
      id: 'business-expense-optimization',
      title: 'Business Expense Maximization',
      description: 'Optimize business expense deductions including home office, equipment, and professional development.',
      impact: 'high',
      confidence: 90,
      potentialSavings: businessExpenseSavings,
      timeframe: 'Current tax year',
      requirements: [
        'Maintain detailed expense records',
        'Separate business and personal expenses',
        'Consider home office deduction'
      ],
      risks: [
        'Requires audit-proof documentation',
        'Business purpose must be demonstrable'
      ]
    });
    totalPotentialSavings += businessExpenseSavings;
  }

  return {
    agentType: 'Tax Optimization',
    recommendations,
    totalPotentialSavings: Math.round(totalPotentialSavings),
    analysisDate: new Date().toISOString(),
    regulatoryBasis
  };
}

// Investment Tax Strategy Agent
async function runInvestmentTaxAgent(userProfile, regulatoryBasis) {
  const recommendations = [];
  let totalPotentialSavings = 0;

  // Tax-loss harvesting
  if (userProfile.investmentPortfolio > 10000) {
    const taxLossSavings = Math.min(userProfile.investmentPortfolio * 0.02, 1000);
    recommendations.push({
      id: 'tax-loss-harvesting',
      title: 'Tax-Loss Harvesting Strategy',
      description: 'Realize investment losses to offset capital gains and reduce tax liability under German Abgeltungsteuer.',
      impact: 'medium',
      confidence: 75,
      potentialSavings: taxLossSavings,
      timeframe: 'End of tax year',
      requirements: [
        'Review investment portfolio for unrealized losses',
        'Consider wash sale rules',
        'Coordinate with overall investment strategy'
      ],
      risks: [
        'May conflict with long-term investment goals',
        'Transaction costs must be considered'
      ]
    });
    totalPotentialSavings += taxLossSavings;
  }

  // Freistellungsauftrag optimization
  const freistellungsSavings = Math.min(userProfile.investmentPortfolio * 0.26 * 0.01, 220); // 26% tax on €801 allowance
  recommendations.push({
    id: 'freistellungsauftrag-optimization',
    title: 'Freistellungsauftrag Optimization',
    description: 'Optimize the distribution of your €801 annual tax-free allowance across different banks and investment accounts.',
    impact: 'medium',
    confidence: 95,
    potentialSavings: freistellungsSavings,
    timeframe: 'Beginning of tax year',
    requirements: [
      'Review current Freistellungsauftrag distribution',
      'Calculate expected investment income per account',
      'Redistribute allowances optimally'
    ],
    risks: [
      'Requires annual review and adjustment',
      'Must not exceed total allowance limit'
    ]
  });
  totalPotentialSavings += freistellungsSavings;

  // ETF vs. individual stocks tax efficiency
  if (userProfile.investmentPortfolio > 25000) {
    const etfTaxSavings = userProfile.investmentPortfolio * 0.005;
    recommendations.push({
      id: 'etf-tax-efficiency',
      title: 'ETF Tax Efficiency Strategy',
      description: 'Consider tax-efficient ETF structures and accumulating vs. distributing funds for optimal tax treatment.',
      impact: 'low',
      confidence: 80,
      potentialSavings: etfTaxSavings,
      timeframe: 'Long-term strategy',
      requirements: [
        'Analyze current portfolio composition',
        'Research tax-efficient ETF options',
        'Consider accumulating ETFs for tax deferral'
      ],
      risks: [
        'May limit investment choices',
        'Tax laws may change'
      ]
    });
    totalPotentialSavings += etfTaxSavings;
  }

  return {
    agentType: 'Investment Tax Strategy',
    recommendations,
    totalPotentialSavings: Math.round(totalPotentialSavings),
    analysisDate: new Date().toISOString(),
    regulatoryBasis
  };
}

// Retirement Planning Tax Agent
async function runRetirementPlanningAgent(userProfile, regulatoryBasis) {
  const recommendations = [];
  let totalPotentialSavings = 0;

  // Riester pension optimization
  if (userProfile.age < 60 && userProfile.employmentType === 'employee') {
    const riesterMaxContribution = Math.min(userProfile.income * 0.04, 2100);
    const riesterTaxSavings = riesterMaxContribution * calculateGermanTaxRate(userProfile.income);
    recommendations.push({
      id: 'riester-optimization',
      title: 'Riester Pension Optimization',
      description: 'Maximize Riester pension contributions to benefit from government subsidies and tax deductions.',
      impact: 'high',
      confidence: 90,
      potentialSavings: riesterTaxSavings,
      timeframe: 'Annual contribution',
      requirements: [
        'Eligible employment status',
        'Annual contribution up to 4% of income (max €2,100)',
        'Apply for government subsidies (Zulagen)'
      ],
      risks: [
        'Funds locked until retirement',
        'Limited investment options',
        'Pension payments are fully taxable'
      ]
    });
    totalPotentialSavings += riesterTaxSavings;
  }

  // Rürup pension for high earners
  if (userProfile.income > 60000) {
    const ruerupMaxDeduction = Math.min(userProfile.income * 0.1, 25787); // 2024 limit
    const ruerupTaxSavings = ruerupMaxDeduction * calculateGermanTaxRate(userProfile.income) * 0.96; // 96% deductible in 2024
    recommendations.push({
      id: 'ruerup-optimization',
      title: 'Rürup Pension Tax Optimization',
      description: 'Utilize Rürup pension for significant tax deductions, especially beneficial for high earners and self-employed.',
      impact: 'high',
      confidence: 85,
      potentialSavings: ruerupTaxSavings,
      timeframe: 'Annual contribution',
      requirements: [
        'High income level for maximum benefit',
        'Long-term commitment (no early withdrawal)',
        'Consider investment options within Rürup framework'
      ],
      risks: [
        'No inheritance rights for spouse',
        'Pension payments fully taxable',
        'Inflation risk over long term'
      ]
    });
    totalPotentialSavings += ruerupTaxSavings;
  }

  // Company pension scheme optimization
  if (userProfile.employmentType === 'employee') {
    const companyPensionSavings = Math.min(userProfile.income * 0.04, 3000);
    recommendations.push({
      id: 'company-pension-optimization',
      title: 'Company Pension Scheme (bAV) Optimization',
      description: 'Optimize company pension contributions through salary conversion (Entgeltumwandlung) for tax and social security savings.',
      impact: 'medium',
      confidence: 80,
      potentialSavings: companyPensionSavings,
      timeframe: 'Monthly payroll deduction',
      requirements: [
        'Employer offers company pension scheme',
        'Salary conversion agreement',
        'Consider employer matching contributions'
      ],
      risks: [
        'Reduced statutory pension claims',
        'Social security contributions on pension payments',
        'Employer dependency'
      ]
    });
    totalPotentialSavings += companyPensionSavings;
  }

  // Retirement timing optimization
  if (userProfile.age > 55) {
    const timingOptimizationSavings = userProfile.retirementSavings * 0.05;
    recommendations.push({
      id: 'retirement-timing-optimization',
      title: 'Retirement Timing Tax Optimization',
      description: 'Optimize the timing of retirement and pension withdrawals to minimize tax burden across retirement years.',
      impact: 'medium',
      confidence: 75,
      potentialSavings: timingOptimizationSavings,
      timeframe: 'Pre-retirement planning',
      requirements: [
        'Detailed retirement income projection',
        'Consider pension splitting with spouse',
        'Plan withdrawal sequence from different accounts'
      ],
      risks: [
        'Tax law changes',
        'Health and longevity considerations',
        'Inflation impact on fixed incomes'
      ]
    });
    totalPotentialSavings += timingOptimizationSavings;
  }

  return {
    agentType: 'Retirement Planning Tax',
    recommendations,
    totalPotentialSavings: Math.round(totalPotentialSavings),
    analysisDate: new Date().toISOString(),
    regulatoryBasis
  };
}

// Helper function to calculate German tax rate
function calculateGermanTaxRate(income) {
  // Simplified German tax brackets for 2024
  if (income <= 11604) return 0;
  if (income <= 17005) return 0.14;
  if (income <= 66760) return 0.24;
  if (income <= 277825) return 0.42;
  return 0.45;
}

// Don't serve static files in serverless function - handled by Vercel routing

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '2.0.0-enhanced-database',
    storage: 'PostgreSQL Database',
    deployment: 'Enhanced Backend with Content Analysis',
    features: ['Multi-format support', 'OCR capabilities', 'Content-based analysis', 'German tax classification']
  });
});

// Test endpoint to debug upload issues
app.post('/api/test-upload', (req, res) => {
  console.log('Test upload endpoint hit');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  res.json({ message: 'Test endpoint working', headers: req.headers });
});

// Test multer configuration
app.get('/api/test-multer-config', (req, res) => {
  try {
    console.log('Testing multer configuration');
    console.log('Multer:', typeof multer);
    console.log('Upload middleware:', typeof upload);
    res.json({ 
      message: 'Multer config test', 
      multerType: typeof multer,
      uploadType: typeof upload,
      multerVersion: multer.version || 'unknown'
    });
  } catch (error) {
    console.error('Multer config error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test multer upload endpoint
app.post('/api/test-multer', upload.single('document'), (req, res) => {
  console.log('Test multer endpoint hit');
  console.log('File:', req.file);
  console.log('Body:', req.body);
  res.json({ 
    message: 'Multer test working', 
    file: req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    } : null
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database (non-blocking)
initApp().catch(error => {
  console.error('Database initialization failed, continuing without database:', error);
});

// Start server locally, export for Vercel
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 56534;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Tax & Law AI Expert server running on http://localhost:${PORT}`);
    console.log('Make sure to set your OPENAI_API_KEY and TAVILY_API_KEY environment variables');
  });
}

// Export for Vercel
export default app;