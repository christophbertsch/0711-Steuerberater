# Environment Setup Guide

## Required Environment Variables

### Tavily API Integration

For the Tax Editorial Agents system to work with real data, you need to configure the Tavily API key:

#### For Vercel Deployment:
1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add a new environment variable:
   - **Name**: `REACT_APP_TAVILY_API_KEY`
   - **Value**: Your Tavily API key
   - **Environment**: All (Production, Preview, Development)

#### For Local Development:
Create a `.env.local` file in the project root:
```bash
REACT_APP_TAVILY_API_KEY=your_tavily_api_key_here
```

#### Current Status:
- ✅ `TAVILY_API_KEY` is configured in Vercel (server-side)
- ❌ `REACT_APP_TAVILY_API_KEY` is needed for client-side React app

### Alternative: Backend Proxy (Recommended for Production)

For better security, consider creating a backend API endpoint to proxy Tavily requests:

1. Create `/api/tavily-search` endpoint
2. Use server-side `TAVILY_API_KEY` 
3. Update `TavilyService` to call your API instead of Tavily directly

This approach:
- ✅ Keeps API keys secure on the server
- ✅ Allows request filtering and rate limiting
- ✅ Enables caching and optimization
- ✅ Works with existing `TAVILY_API_KEY` in Vercel

## Other Environment Variables

### Database Configuration (Future)
```bash
# PostgreSQL for rule storage
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tax_editorial
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# Vector database for embeddings
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your_qdrant_key
```

### External Services (Future)
```bash
# ELSTER API integration
ELSTER_API_URL=https://api.elster.de
ELSTER_API_KEY=your_elster_key

# ERiC validation library
ERIC_LIBRARY_PATH=/path/to/eric/lib
```

## Quick Fix for Current Issue

To immediately resolve the Tavily API issue:

1. **Option A**: Rename the existing environment variable in Vercel:
   - Change `TAVILY_API_KEY` → `REACT_APP_TAVILY_API_KEY`

2. **Option B**: Create backend proxy endpoint (recommended):
   ```typescript
   // pages/api/tavily-search.ts
   export default async function handler(req, res) {
     const response = await fetch('https://api.tavily.com/search', {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${process.env.TAVILY_API_KEY}`,
         'Content-Type': 'application/json'
       },
       body: JSON.stringify(req.body)
     });
     const data = await response.json();
     res.json(data);
   }
   ```

## Testing Configuration

To test if the Tavily API is working:

1. Open the Editorial System tab in the application
2. Select "Werbungskosten" as the topic
3. Click "Editorial-Ingestion starten"
4. Check the browser console for:
   - ✅ Success: "Tavily search completed"
   - ❌ Fallback: "Tavily API key not configured, using mock data"

## Mock Data Fallback

The system includes comprehensive mock data that works without API keys:
- ✅ German tax authority sources
- ✅ Realistic legal content
- ✅ Proper domain filtering
- ✅ Complete pipeline execution

This allows development and testing without API dependencies.