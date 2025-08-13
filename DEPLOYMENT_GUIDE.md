# Deployment Guide - Tax & Law AI Expert

## 🚀 Vercel Deployment with Blob Storage

Your application is deployed at: **https://0711-steuerberater.vercel.app**

### ✅ Environment Variables Configured

Your Vercel environment variables are already set up:
- ✅ `BLOB_READ_WRITE_TOKEN` (added 2h ago)
- ✅ `OPENAI_API_KEY` (added 11h ago)  
- ✅ `TAVILY_API_KEY` (added 11h ago)

### 🔧 Deployment Configuration

The application uses the following Vercel configuration (`vercel.json`):

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
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
      "dest": "/server.js"
    },
    {
      "src": "/(.*)",
      "dest": "/dist/$1"
    }
  ],
  "functions": {
    "server.js": {
      "maxDuration": 30
    }
  }
}
```

### 📋 Testing Your Deployment

#### 1. Test the Frontend
Visit: https://0711-steuerberater.vercel.app
- ✅ Should load the Tax & Law AI Expert interface
- ✅ Navigate to different tabs (Upload, Analysis, Research, etc.)
- ✅ Check the new "Blob Storage" tab

#### 2. Test the API Endpoints
```bash
# Test blob storage list
curl https://0711-steuerberater.vercel.app/api/blob/list

# Test documents endpoint
curl https://0711-steuerberater.vercel.app/api/documents

# Test migration endpoint
curl -X POST https://0711-steuerberater.vercel.app/api/blob/migrate
```

#### 3. Test File Upload
1. Go to https://0711-steuerberater.vercel.app
2. Navigate to "Dokumente hochladen" tab
3. Upload a test PDF or document
4. Check the "Blob Storage" tab to see if the file appears
5. Verify the file is stored in Vercel Blob Storage

### 🔄 Redeployment Process

To deploy updates:

```bash
# 1. Make your changes
git add .
git commit -m "Your changes"

# 2. Push to main branch (triggers automatic deployment)
git push origin main

# 3. Vercel will automatically deploy the changes
# Check deployment status at: https://vercel.com/dashboard
```

### 🧪 Local Testing with Production Environment

To test locally with your production environment variables:

```bash
# 1. Create local .env file
./setup-local-env.sh

# 2. Copy your actual tokens from Vercel Dashboard
# Edit .env file and replace placeholder values

# 3. Start local server
npm run server

# 4. Test blob storage integration
node test-vercel-integration.js
```

### 📊 Monitoring Your Deployment

#### Vercel Dashboard
- **Deployments**: https://vercel.com/dashboard/deployments
- **Functions**: Monitor API endpoint performance
- **Analytics**: Track usage and performance
- **Logs**: Debug any issues

#### Blob Storage Management
- **Storage Dashboard**: https://vercel.com/dashboard/stores
- **Usage Monitoring**: Track storage usage and costs
- **File Management**: View and manage uploaded files

### 🐛 Troubleshooting

#### Common Issues

1. **API Endpoints Return 404**
   - Check if `server.js` is properly deployed
   - Verify `vercel.json` routing configuration
   - Check Vercel function logs

2. **Blob Storage Errors**
   - Verify `BLOB_READ_WRITE_TOKEN` is set correctly
   - Check Vercel Blob Storage quota
   - Ensure token has read/write permissions

3. **File Upload Fails**
   - Check browser console for errors
   - Verify file size limits (Vercel has limits)
   - Check network connectivity

#### Debug Commands

```bash
# Check deployment status
vercel --version
vercel ls

# View function logs
vercel logs https://0711-steuerberater.vercel.app

# Test specific endpoints
curl -v https://0711-steuerberater.vercel.app/api/documents
```

### 🔒 Security Considerations

- ✅ Environment variables are securely stored in Vercel
- ✅ Blob files are set to public access for AI processing
- ✅ API keys are not exposed in client-side code
- ✅ CORS is properly configured for your domain

### 📈 Performance Optimization

- ✅ Static files served via Vercel CDN
- ✅ API functions have 30-second timeout
- ✅ Blob storage provides global CDN access
- ✅ Efficient file upload using memory storage

### 🎯 Next Steps

1. **Test the deployment** at https://0711-steuerberater.vercel.app
2. **Upload test documents** to verify blob storage integration
3. **Use the migration tool** to move any existing local files
4. **Monitor usage** in Vercel Dashboard
5. **Set up custom domain** if desired

### 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Vercel function logs
3. Test API endpoints individually
4. Verify environment variables are set correctly

---

**Your Tax & Law AI Expert application is now fully deployed with persistent Vercel Blob Storage! 🎉**