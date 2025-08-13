# Backend Deployment Guide

## 🎯 Current Status
- ✅ Frontend: Deployed on Vercel (https://0711-steuerberater.vercel.app)
- ✅ Database: PostgreSQL on Google Cloud SQL
- ❌ Backend: Running locally (needs deployment)

## 🏆 Recommended: Deploy Backend on Vercel

### Why Vercel?
- Same platform as your frontend
- Environment variables already configured
- Automatic deployments from Git
- Cost-effective serverless functions
- No additional platform management

### 📋 Steps to Deploy Backend on Vercel

#### 1. Update Vercel Configuration
Create/update `vercel.json`:

```json
{
  "version": 2,
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

#### 2. Add Database Environment Variables to Vercel
```bash
# Add these to your Vercel project settings:
DB_HOST=34.107.63.251
DB_PORT=5432
DB_NAME=steuerberater
DB_USER=postgres
DB_PASSWORD=<o8-x_@8smbXhI.V
```

#### 3. Deploy
```bash
# If you have Vercel CLI installed:
vercel --prod

# Or push to your main branch (auto-deployment)
git add .
git commit -m "Deploy enhanced backend with database storage"
git push origin main
```

#### 4. Test Deployment
```bash
# Test document upload
curl -X POST https://0711-steuerberater.vercel.app/api/documents/upload \
  -F "document=@your-test-file.pdf"

# Test document list
curl https://0711-steuerberater.vercel.app/api/documents
```

## 🔄 Alternative: Deploy on Render

If you prefer a persistent server (no cold starts), Render is an excellent choice:

### Steps for Render Deployment

#### 1. Create Render Account
- Go to https://render.com
- Connect your GitHub repository

#### 2. Create Web Service
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Environment**: Node.js

#### 3. Add Environment Variables
```
DB_HOST=34.107.63.251
DB_PORT=5432
DB_NAME=steuerberater
DB_USER=postgres
DB_PASSWORD=<o8-x_@8smbXhI.V
OPENAI_API_KEY=your-openai-key
TAVILY_API_KEY=your-tavily-key
```

#### 4. Update Frontend API URL
Update your frontend to point to Render URL:
```javascript
// In your frontend config
const API_BASE_URL = 'https://your-app-name.onrender.com';
```

## 🔧 Required Code Changes for Deployment

### Update CORS Configuration
```javascript
// In api/index.js, update CORS origins:
app.use(cors({
  origin: [
    'http://localhost:54628',
    'http://localhost:54629', 
    'https://0711-steuerberater.vercel.app',
    'https://your-backend-url.vercel.app' // Add your backend URL
  ],
  credentials: true
}));
```

### Update Frontend API Configuration
Create `src/config/api.js`:
```javascript
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://0711-steuerberater.vercel.app'  // Vercel
  // ? 'https://your-app.onrender.com'       // Render alternative
  : 'http://localhost:3001';

export default API_BASE_URL;
```

## 🧪 Testing Your Deployment

### 1. Test Core Functionality
```bash
# Test document upload
curl -X POST https://your-backend-url/api/documents/upload \
  -F "document=@test-file.pdf"

# Test AI analysis
curl -X POST https://your-backend-url/api/ai/analyze \
  -H "Content-Type: application/json" \
  -d '{"documentId": "1"}'

# Test document retrieval
curl https://your-backend-url/api/documents
```

### 2. Test Database Connection
```bash
# Should return documents from database
curl https://your-backend-url/api/documents
```

### 3. Test File Serving
```bash
# Should serve file from database
curl -I https://your-backend-url/api/documents/1/file
```

## 🔒 Security Checklist

- ✅ Database credentials in environment variables
- ✅ CORS properly configured
- ✅ API keys not exposed in client code
- ✅ File upload validation in place
- ✅ SQL injection protection with parameterized queries

## 📊 Monitoring & Maintenance

### Vercel Monitoring
- **Dashboard**: https://vercel.com/dashboard
- **Function Logs**: Monitor API performance
- **Analytics**: Track usage patterns

### Render Monitoring
- **Dashboard**: https://dashboard.render.com
- **Logs**: Real-time application logs
- **Metrics**: CPU, memory, response times

## 🚨 Important Notes

1. **Database Connection**: Your PostgreSQL database is already configured and working
2. **File Storage**: Files are stored in database (no external storage needed)
3. **Environment Variables**: Make sure all required variables are set in your deployment platform
4. **CORS**: Update CORS configuration to include your deployed backend URL

## 🎯 My Recommendation

**Deploy on Vercel** because:
- Your frontend is already there
- Environment variables are configured
- Unified platform management
- Cost-effective for your use case
- Automatic deployments from Git

The enhanced document processing system with database storage is ready for production deployment! 🚀