# Steuerberater Mega Microagent Platform 🏛️🤖⚡

An editorial-based, tax law/regulation mega microagent platform with comprehensive AI-powered document analysis, legal opinion generation, and automated tax declaration creation. Built with production-ready infrastructure including Qdrant vector database, PostgreSQL, and PDF2Q service integration.

## 🌟 Features

### 🏗️ **Production Infrastructure**
- **Qdrant Vector Database**: Semantic document search and storage at `http://34.40.104.64:6333`
- **PostgreSQL Database**: Structured data storage at `34.107.63.251:5432`
- **PDF2Q Service**: Reliable German text extraction at `https://pdf2q.onrender.com`
- **Microagent Architecture**: Specialized agents for different tax domains

### 📄 **Advanced Document Processing**
- **Multi-format Support**: PDF, images, Word documents, XML files
- **German Text Optimization**: PDF2Q service for accurate German character encoding
- **Intelligent Classification**: AI-powered document type detection
- **OCR Capabilities**: Tesseract.js for scanned document processing
- **Vector Storage**: Automatic embedding generation and Qdrant storage

### 🤖 **Editorial Microagent System**
- **Specialized Tax Agents**: ESt, USt, KSt, GewSt declaration agents
- **Editorial Content Management**: Bulk ingestion of tax law content
- **Rule Specification Extraction**: Automated legal rule parsing
- **Tavily Integration**: Real-time tax law research and updates
- **Agent Orchestration**: Coordinated multi-agent workflows

### 🧠 **AI-Powered Analysis**
- **Expert Opinion Generation**: GPT-4 powered tax analysis
- **Semantic Search**: Vector-based document similarity matching
- **Tax Relevance Assessment**: Automated classification and scoring
- **Deduction Identification**: Smart detection of tax-deductible items
- **Risk Assessment**: Compliance warnings and recommendations

### 📊 **Tax Declaration Automation**
- **Form Auto-Population**: Data extraction from analyzed documents
- **Multi-Form Support**: ESt, USt-VA, KSt, GewSt declarations
- **Real-time Calculations**: German tax calculation engine
- **PDF Generation**: Professional tax declaration documents
- **Validation Engine**: Built-in compliance checking

### 🎯 Document Types Supported

#### Tax Forms & Official Documents
- Income tax returns (ESt forms)
- Salary statements (Lohnsteuerbescheinigung)
- Tax assessments
- Official correspondence

#### Receipts & Invoices
- Business expenses
- Medical expenses
- Donation receipts
- Education expenses
- Home office expenses

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Access to production infrastructure:
  - PostgreSQL: `34.107.63.251:5432` (credentials provided)
  - Qdrant: `http://34.40.104.64:6333`
  - PDF2Q: `https://pdf2q.onrender.com`
- OpenAI API key (for AI analysis)
- Tavily API key (for tax research)

### Installation

1. **Clone and setup**:
```bash
git clone https://github.com/christophbertsch/0711-Steuerberater.git
cd 0711-Steuerberater
git checkout stable-mega-microagent-platform
npm install
```

2. **Production setup**:
```bash
# Run automated setup (creates .env, tests connections)
npm run setup

# Or manually create .env from template
cp .env.example .env
# Edit .env with your API keys
```

3. **Start the platform**:
```bash
# Start backend server
npm run server &

# Start frontend development server  
npm run dev
```

### Access Points
- **Frontend**: http://localhost:54940
- **Backend API**: http://localhost:55934/api
- **Qdrant Dashboard**: http://34.40.104.64:6333/dashboard#/collections/steuerberater

## 🧪 Testing

### Run Comprehensive Tests
```bash
node test-app.js
```

### Run Tax Research (requires Tavily API key)
```bash
node research-2024-tax-changes.js
```

### Test Individual Components
```bash
# Test document upload
curl -X POST -F "document=@test-file.pdf" http://localhost:56534/api/documents/upload

# Test AI analysis
curl -X POST -H "Content-Type: application/json" \
  -d '{"documentId":"123"}' \
  http://localhost:56534/api/ai/analyze

# Test tax research
curl -X POST -H "Content-Type: application/json" \
  -d '{"query":"German tax changes 2024"}' \
  http://localhost:56534/api/research/search
```

## 📁 Project Structure

```
tax-law-ai-app/
├── src/                          # Frontend React application
│   ├── components/               # React components
│   │   ├── DocumentUpload.tsx    # File upload interface
│   │   ├── DocumentAnalysis.tsx  # AI analysis display
│   │   ├── TaxResearch.tsx       # Tax law research
│   │   └── TaxDeclarationGenerator.tsx # Tax declaration wizard
│   ├── services/                 # API service layers
│   │   ├── documentService.ts    # Document management
│   │   ├── aiService.ts          # AI analysis
│   │   ├── researchService.ts    # Tax research
│   │   └── taxService.ts         # Tax calculations
│   ├── types/                    # TypeScript definitions
│   └── utils/                    # Utility functions
├── server.js                     # Express backend server
├── research-2024-tax-changes.js  # Tax research script
├── test-app.js                   # Comprehensive test suite
├── start.sh                      # Application startup script
└── uploads/                      # Document storage directory
```

## 🔧 API Endpoints

### Document Management
- `POST /api/documents/upload` - Upload document
- `GET /api/documents` - List all documents
- `DELETE /api/documents/:id` - Delete document

### AI Analysis
- `POST /api/ai/analyze` - Analyze document
- `POST /api/ai/expert-opinion` - Get expert opinion
- `POST /api/ai/extract-data` - Extract structured data
- `POST /api/ai/classify` - Classify document type

### Tax Research
- `POST /api/research/search` - Search tax law
- `GET /api/research/updates/2024` - Get 2024 updates
- `POST /api/research/topic` - Research specific topic

### Tax Declaration
- `POST /api/tax/generate-declaration` - Generate declaration
- `POST /api/tax/calculate` - Calculate tax
- `POST /api/tax/validate` - Validate declaration

## 🎨 User Interface

### Modern Design
- **Responsive Layout**: Works on desktop, tablet, and mobile
- **Tailwind CSS**: Modern, utility-first styling
- **Intuitive Navigation**: Tab-based interface
- **Progress Indicators**: Clear workflow guidance
- **Real-time Feedback**: Live updates and notifications

### Accessibility
- **Screen Reader Support**: ARIA labels and semantic HTML
- **Keyboard Navigation**: Full keyboard accessibility
- **High Contrast**: Accessible color schemes
- **Focus Management**: Clear focus indicators

## 🔒 Security & Privacy

### Data Protection
- **Local Processing**: Documents processed locally when possible
- **Secure Upload**: Encrypted file transmission
- **Temporary Storage**: Automatic cleanup of processed files
- **No Persistent Storage**: Documents not permanently stored

### API Security
- **Rate Limiting**: Protection against abuse
- **Input Validation**: Comprehensive input sanitization
- **Error Handling**: Secure error responses
- **CORS Configuration**: Proper cross-origin settings

## 🌍 German Tax Law Compliance

### 2024 Updates Covered
- **Digital Documentation Requirements**
- **Home Office Deduction Changes**
- **Electric Vehicle Tax Benefits**
- **New Deduction Limits**
- **Updated Tax Brackets**
- **Cryptocurrency Taxation**

### Supported Tax Forms
- **ESt 1 A**: Main income tax return
- **Anlage N**: Employment income
- **Anlage G**: Business income
- **Anlage KAP**: Capital gains
- **Anlage SO**: Other income

## 🤖 AI Capabilities

### Document Analysis
- **Content Extraction**: Text, numbers, dates, amounts
- **Context Understanding**: Document purpose and relevance
- **Relationship Mapping**: Connections between documents
- **Anomaly Detection**: Unusual patterns or errors

### Expert Opinion Generation
- **Tax Implications**: Detailed tax impact analysis
- **Legal Considerations**: Compliance and regulatory aspects
- **Risk Assessment**: Potential issues and warnings
- **Optimization Suggestions**: Tax-saving recommendations

### Research Integration
- **Real-time Updates**: Latest tax law changes
- **Source Verification**: Authoritative legal sources
- **Impact Analysis**: How changes affect individual cases
- **Historical Context**: Evolution of tax regulations

## 📈 Performance

### Optimization Features
- **Lazy Loading**: Components loaded on demand
- **Caching**: Intelligent caching of API responses
- **Compression**: Optimized asset delivery
- **Progressive Enhancement**: Works without JavaScript

### Scalability
- **Modular Architecture**: Easy to extend and maintain
- **API-First Design**: Backend can serve multiple frontends
- **Database Ready**: Easy migration to persistent storage
- **Cloud Deployment**: Ready for cloud platforms

## 🛠️ Development

### Tech Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, OpenAI API
- **Build Tools**: Vite, PostCSS
- **Testing**: Custom test suite
- **Documentation**: Comprehensive inline docs

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

### Code Quality
- **TypeScript**: Full type safety
- **ESLint**: Code linting and formatting
- **Error Boundaries**: Graceful error handling
- **Performance Monitoring**: Built-in performance tracking

## 📞 Support

### Getting Help
- **Documentation**: Comprehensive inline help
- **Error Messages**: Clear, actionable error descriptions
- **Logging**: Detailed application logs
- **Debug Mode**: Enhanced debugging capabilities

### Common Issues
- **API Keys**: Ensure OpenAI and Tavily keys are set
- **File Formats**: Check supported file types
- **Network**: Verify internet connection for research features
- **Permissions**: Ensure file system write permissions

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **OpenAI**: For GPT-4 analysis capabilities
- **Tavily**: For real-time tax law research
- **German Federal Ministry of Finance**: For official tax information
- **React Community**: For the excellent framework and ecosystem

---

**⚠️ Legal Disclaimer**: This application provides educational information and should not be considered as professional tax or legal advice. Always consult with qualified tax professionals for specific situations. Tax laws are subject to change and may vary by jurisdiction.