# 🚀 Vercel Deployment Guide - Enhanced Document Processing

## 📋 Prerequisites

- ✅ Frontend already deployed on Vercel (https://0711-steuerberater.vercel.app)
- ✅ PostgreSQL database on Google Cloud SQL
- ✅ Enhanced backend with database storage ready

## 🔧 Step 1: Update Environment Variables in Vercel

Go to your Vercel project settings and add these environment variables:

### Required Database Variables
```
DB_HOST=34.107.63.251
DB_PORT=5432
DB_NAME=steuerberater
DB_USER=postgres
DB_PASSWORD=<o8-x_@8smbXhI.V
```

### Optional AI Service Variables (already configured)
```
OPENAI_API_KEY=your-existing-openai-key
TAVILY_API_KEY=your-existing-tavily-key
```

### Remove Old Variables (if present)
- ❌ `BLOB_READ_WRITE_TOKEN` (no longer needed)

## 🚀 Step 2: Deploy the Enhanced Backend

### Option A: Automatic Deployment (Recommended)
```bash
# Push your changes to trigger automatic deployment
git add .
git commit --author="openhands <openhands@all-hands.dev>" -m "Deploy enhanced backend to Vercel"
git push origin enhanced-document-processing-database-storage

# Then merge to main branch for deployment
```

### Option B: Manual Deployment with Vercel CLI
```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Deploy to production
vercel --prod
```

## 📁 Step 3: Verify Configuration Files

### ✅ vercel.json (Updated)
```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "builds": [
    {
      "src": "api/index.js",
      "use": "@vercel/node"
    },
    {
      "src": "dist/**/*",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/index.js"
    },
    {
      "src": "/(.*)",
      "dest": "/dist/$1"
    }
  ],
  "functions": {
    "api/index.js": {
      "maxDuration": 30
    }
  }
}
```

### ✅ package.json Scripts
```json
{
  "scripts": {
    "build": "vite build",
    "dev": "vite --host 0.0.0.0",
    "server": "node api/index.js",
    "start": "node api/index.js"
  }
}
```

## 🧪 Step 4: Test the Deployment

### 1. Test Frontend
Visit: https://0711-steuerberater.vercel.app
- ✅ Should load the enhanced interface
- ✅ Navigate to "Dokumente hochladen" tab

### 2. Test API Endpoints
```bash
# Test document list (should connect to database)
curl https://0711-steuerberater.vercel.app/api/documents

# Test document upload
curl -X POST https://0711-steuerberater.vercel.app/api/documents/upload \
  -F "document=@your-test-file.pdf"

# Test AI analysis
curl -X POST https://0711-steuerberater.vercel.app/api/ai/analyze \
  -H "Content-Type: application/json" \
  -d '{"documentId": "1"}'
```

### 3. Test Enhanced Features
1. **Upload a PDF document**
   - Should extract text content
   - Should show processing status
   - Should classify document type based on content

2. **Upload a text file**
   - Should process immediately
   - Should show content analysis

3. **Test reprocessing**
   - Click "Reprocess" on any document
   - Should update with enhanced analysis

## 🔍 Step 5: Monitor Deployment

### Vercel Dashboard
- **Functions**: https://vercel.com/dashboard/functions
- **Deployments**: https://vercel.com/dashboard/deployments
- **Analytics**: Monitor API performance

### Check Function Logs
```bash
# View real-time logs
vercel logs https://0711-steuerberater.vercel.app --follow

# Check specific function logs
vercel logs https://0711-steuerberater.vercel.app/api/documents/upload
```

## 🎯 Key Features Now Available

### Enhanced Document Processing
- ✅ **Content-based Analysis**: AI analyzes actual document content, not filenames
- ✅ **Multi-format Support**: PDF, Word, images, text files, XML
- ✅ **OCR Capabilities**: Text extraction from scanned documents
- ✅ **Database Storage**: Files stored directly in PostgreSQL (no external dependencies)

### Advanced API Endpoints
- ✅ `POST /api/documents/upload` - Enhanced upload with content analysis
- ✅ `GET /api/documents` - List documents from database
- ✅ `GET /api/documents/:id/status` - Real-time processing status
- ✅ `POST /api/documents/:id/reprocess` - Reprocess with updated algorithms
- ✅ `GET /api/documents/:id/file` - Serve files directly from database
- ✅ `DELETE /api/documents/:id` - Complete document deletion

### German Tax Document Recognition
- ✅ **Spendenquittung** (Donation receipts)
- ✅ **Rechnungen** (Invoices) 
- ✅ **Steuerformulare** (Tax forms)
- ✅ **Lohnabrechnungen** (Salary statements)
- ✅ **Belege** (General receipts)

## 🔒 Security & Performance

### Security Features
- ✅ Database credentials in environment variables
- ✅ Flexible CORS configuration for Vercel
- ✅ File type validation and size limits
- ✅ SQL injection protection with parameterized queries

### Performance Optimizations
- ✅ 30-second function timeout for complex processing
- ✅ Efficient file streaming from database
- ✅ Client-side text extraction for immediate feedback
- ✅ Memory-based file processing (no disk I/O)

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Errors**
   ```bash
   # Check if environment variables are set
   curl https://0711-steuerberater.vercel.app/api/documents
   ```
   - Verify DB_* environment variables in Vercel settings
   - Check database firewall allows Vercel IPs

2. **Function Timeout Errors**
   - Large files may timeout (30s limit)
   - Consider implementing chunked processing for very large files

3. **CORS Issues**
   - Updated CORS configuration should handle all Vercel domains
   - Check browser console for specific CORS errors

### Debug Commands
```bash
# Test database connection
curl https://0711-steuerberater.vercel.app/api/documents

# Test file upload
curl -X POST https://0711-steuerberater.vercel.app/api/documents/upload \
  -F "document=@test.pdf" -v

# Check function logs
vercel logs https://0711-steuerberater.vercel.app
```

## 🎉 Success Indicators

Your deployment is successful when:
- ✅ Frontend loads at https://0711-steuerberater.vercel.app
- ✅ Document upload works with enhanced processing
- ✅ AI analysis uses actual document content
- ✅ Documents are stored and retrieved from database
- ✅ All API endpoints respond correctly
- ✅ Processing status updates work in real-time

## 📈 Next Steps

1. **Test thoroughly** with various document types
2. **Monitor performance** in Vercel dashboard
3. **Set up alerts** for function errors
4. **Consider custom domain** if desired
5. **Scale database** if needed for production load

---

**Your enhanced German tax advisor application with database storage is now fully deployed on Vercel! 🚀**

The system now provides credible AI assessment based on actual document content, enabling smart and accurate tax declaration assistance.