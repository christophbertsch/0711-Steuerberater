import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { put, del, list } from '@vercel/blob';
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
  origin: [
    'http://localhost:56534', 
    'http://localhost:54628', 
    'http://127.0.0.1:56534', 
    'http://127.0.0.1:54628',
    'https://0711-steuerberater.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static('dist'));

// Configure multer for file uploads (using memory storage for Vercel Blob)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|docx|xml/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images, PDFs, Word documents, and XML files are allowed'));
    }
  }
});

// In-memory storage for documents (in production, use a database)
let documents = [];
let documentAnalyses = {};

// Helper function to extract text from different file types
async function extractTextFromFile(blobUrl, mimeType, fileName, fileSize) {
  try {
    if (mimeType === 'application/pdf') {
      // For now, provide enhanced metadata analysis until PDF parsing is stable
      console.log(`Processing PDF document: ${fileName}`);
      
      // Extract useful information from filename and provide context
      const isReceipt = fileName.toLowerCase().includes('quittung') || fileName.toLowerCase().includes('receipt');
      const isDonation = fileName.toLowerCase().includes('spenden') || fileName.toLowerCase().includes('donation');
      const isInvoice = fileName.toLowerCase().includes('rechnung') || fileName.toLowerCase().includes('invoice');
      const year = fileName.match(/20\d{2}/)?.[0] || '2024';
      
      let documentContext = `PDF Document: ${fileName} (${fileSize} bytes, Jahr: ${year})\n\n`;
      
      if (isDonation) {
        documentContext += `Dies ist eine Spendenquittung. Typische Inhalte:\n`;
        documentContext += `- Name der gemeinnützigen Organisation\n`;
        documentContext += `- Spendenbetrag und Datum\n`;
        documentContext += `- Bestätigung der Gemeinnützigkeit\n`;
        documentContext += `- Verwendungszweck der Spende\n`;
        documentContext += `- Unterschrift und Stempel der Organisation\n\n`;
        documentContext += `Steuerliche Relevanz: Spenden können als Sonderausgaben abgesetzt werden.`;
      } else if (isReceipt) {
        documentContext += `Dies ist eine Quittung/Beleg. Typische Inhalte:\n`;
        documentContext += `- Datum und Betrag der Zahlung\n`;
        documentContext += `- Art der Leistung oder des Produkts\n`;
        documentContext += `- Zahlungsempfänger\n`;
        documentContext += `- Mehrwertsteuer-Informationen\n\n`;
        documentContext += `Steuerliche Relevanz: Kann als Betriebsausgabe oder Werbungskosten relevant sein.`;
      } else if (isInvoice) {
        documentContext += `Dies ist eine Rechnung. Typische Inhalte:\n`;
        documentContext += `- Rechnungsnummer und Datum\n`;
        documentContext += `- Leistungsbeschreibung\n`;
        documentContext += `- Netto- und Bruttobetrag\n`;
        documentContext += `- Mehrwertsteuer-Ausweis\n\n`;
        documentContext += `Steuerliche Relevanz: Wichtig für Umsatzsteuer und Betriebsausgaben.`;
      } else {
        documentContext += `Dies ist ein steuerrelevantes Dokument basierend auf dem Dateinamen.\n`;
        documentContext += `Für eine detaillierte Analyse wäre eine manuelle Prüfung des Dokumentinhalts erforderlich.`;
      }
      
      return documentContext;
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
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Check if Vercel Blob token is configured
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({ 
        error: 'Vercel Blob Storage not configured. Please set BLOB_READ_WRITE_TOKEN in your environment variables.' 
      });
    }

    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileName = `documents/${uniqueSuffix}-${req.file.originalname}`;

    // Upload to Vercel Blob
    const blob = await put(fileName, req.file.buffer, {
      access: 'public',
      contentType: req.file.mimetype,
    });

    const document = {
      id: Date.now().toString(),
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size,
      uploadDate: new Date(),
      blobUrl: blob.url,
      blobPathname: blob.pathname
    };

    documents.push(document);
    res.json(document);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed: ' + error.message });
  }
});

// Get all documents
app.get('/api/documents', async (req, res) => {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      // Return in-memory documents when blob storage not configured
      return res.json(documents);
    }

    // Get real documents from Vercel Blob
    const { blobs } = await list();
    
    const blobDocuments = blobs.map((blob, index) => {
      // Extract filename from pathname
      const filename = blob.pathname.split('/').pop() || 'unknown.pdf';
      // Remove the timestamp prefix from filename
      const cleanName = filename.replace(/^\d+-\d+-/, '');
      
      return {
        id: (index + 1).toString(),
        name: cleanName,
        type: 'application/pdf',
        size: blob.size,
        uploadDate: blob.uploadedAt,
        blobUrl: blob.url,
        blobPathname: blob.pathname
      };
    });

    res.json(blobDocuments);
  } catch (error) {
    console.error('Error fetching documents:', error);
    // Fallback to in-memory documents on error
    res.json(documents);
  }
});

// Delete document
app.delete('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const index = documents.findIndex(doc => doc.id === id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = documents[index];
    
    // Delete file from Vercel Blob if blobUrl exists
    if (document.blobUrl && process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        await del(document.blobUrl);
      } catch (blobError) {
        console.error('Error deleting from Vercel Blob:', blobError);
        // Continue with deletion from memory even if blob deletion fails
      }
    }
    
    // Remove from arrays
    documents.splice(index, 1);
    delete documentAnalyses[id];
    
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Delete failed: ' + error.message });
  }
});

// Analyze document
app.post('/api/ai/analyze', async (req, res) => {
  console.log('AI analyze endpoint called with:', req.body);
  try {
    const { documentId } = req.body;
    
    // Get documents from blob storage
    let document = null;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const { blobs } = await list();
        const blobDocuments = blobs.map((blob, index) => {
          const filename = blob.pathname.split('/').pop() || 'unknown.pdf';
          const cleanName = filename.replace(/^\d+-\d+-/, '');
          
          return {
            id: (index + 1).toString(),
            name: cleanName,
            type: 'application/pdf',
            size: blob.size,
            uploadDate: blob.uploadedAt,
            blobUrl: blob.url,
            blobPathname: blob.pathname
          };
        });
        
        document = blobDocuments.find(doc => doc.id === documentId);
      } catch (error) {
        console.error('Error fetching from blob storage:', error);
      }
    }
    
    // Fallback to in-memory documents
    if (!document) {
      document = documents.find(doc => doc.id === documentId);
    }
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check if already analyzed
    if (documentAnalyses[documentId]) {
      return res.json(documentAnalyses[documentId]);
    }

    // Extract text from document
    const content = await extractTextFromFile(document.blobUrl || document.filePath, document.type, document.name, document.size);
    
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

// List all files in Vercel Blob Storage
app.get('/api/blob/list', async (req, res) => {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({ 
        error: 'Vercel Blob Storage not configured. Please set BLOB_READ_WRITE_TOKEN in your environment variables.' 
      });
    }

    const { blobs } = await list();
    res.json(blobs);
  } catch (error) {
    console.error('Blob list error:', error);
    res.status(500).json({ error: 'Failed to list blob files: ' + error.message });
  }
});

// Migrate existing local files to Vercel Blob Storage
app.post('/api/blob/migrate', async (req, res) => {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({ 
        error: 'Vercel Blob Storage not configured. Please set BLOB_READ_WRITE_TOKEN in your environment variables.' 
      });
    }

    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      return res.json({ message: 'No local uploads directory found', migratedFiles: [] });
    }

    const files = fs.readdirSync(uploadsDir);
    const migratedFiles = [];

    for (const file of files) {
      const filePath = path.join(uploadsDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        try {
          const fileBuffer = fs.readFileSync(filePath);
          const fileName = `documents/migrated-${Date.now()}-${file}`;
          
          // Upload to Vercel Blob
          const blob = await put(fileName, fileBuffer, {
            access: 'public',
          });

          migratedFiles.push({
            originalPath: filePath,
            blobUrl: blob.url,
            fileName: file,
            size: stats.size
          });

          console.log(`Migrated ${file} to Vercel Blob: ${blob.url}`);
        } catch (error) {
          console.error(`Failed to migrate ${file}:`, error);
        }
      }
    }

    res.json({ 
      message: `Successfully migrated ${migratedFiles.length} files to Vercel Blob Storage`,
      migratedFiles 
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ error: 'Migration failed: ' + error.message });
  }
});

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

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
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