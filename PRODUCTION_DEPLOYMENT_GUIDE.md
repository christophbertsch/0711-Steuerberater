# Production Deployment Guide - Steuerberater Mega Microagent Platform

## 🚀 Production Infrastructure Overview

The platform is designed to work with the following production infrastructure:

- **PostgreSQL Database**: `34.107.63.251:5432` (universe-vm:europe-west3:postgresql-0711-ai)
- **Qdrant Vector Database**: `http://34.40.104.64:6333`
- **PDF2Q Service**: `https://pdf2q.onrender.com`
- **Frontend**: Deployed on Vercel or similar
- **Backend**: Can be deployed on various platforms

## 📋 Pre-Deployment Checklist

### Infrastructure Requirements

- [ ] PostgreSQL database accessible at `34.107.63.251:5432`
- [ ] Database credentials: `postgres` / `<o8-x_@8smbXhI.V`
- [ ] Qdrant vector database accessible at `http://34.40.104.64:6333`
- [ ] PDF2Q service operational at `https://pdf2q.onrender.com`
- [ ] OpenAI API key for AI analysis
- [ ] Tavily API key for tax research

### Environment Setup

1. **Clone the repository**:
```bash
git clone https://github.com/christophbertsch/0711-Steuerberater.git
cd 0711-Steuerberater
git checkout stable-mega-microagent-platform
```

2. **Install dependencies**:
```bash
npm install
```

3. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with production values
```

4. **Run production setup**:
```bash
npm run setup
```

## 🔧 Environment Configuration

### Production .env Configuration

```bash
# PostgreSQL Database (Production)
DB_HOST=34.107.63.251
DB_PORT=5432
DB_NAME=steuerberater
DB_USER=postgres
DB_PASSWORD=<o8-x_@8smbXhI.V

# Qdrant Vector Database (Production)
QDRANT_URL=http://34.40.104.64:6333
QDRANT_API_KEY=
QDRANT_COLLECTION=steuerberater

# PDF Extraction Service (Production)
PDF2Q_SERVICE_URL=https://pdf2q.onrender.com

# AI Services (Required)
OPENAI_API_KEY=your-actual-openai-api-key
TAVILY_API_KEY=your-actual-tavily-api-key

# Application Settings
NODE_ENV=production
PORT=55934
ENABLE_PYTHON_EXTRACTION=false
```

## 🌐 Deployment Options

### Option 1: Vercel Deployment (Recommended)

1. **Prepare for Vercel**:
```bash
npm run build
```

2. **Deploy to Vercel**:
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

3. **Configure Vercel Environment Variables**:
   - Add all environment variables from `.env` to Vercel project settings
   - Ensure `NODE_ENV=production`

### Option 2: Docker Deployment

1. **Create Dockerfile**:
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Build frontend
RUN npm run build

# Expose port
EXPOSE 55934

# Start application
CMD ["npm", "start"]
```

2. **Build and run**:
```bash
docker build -t steuerberater-platform .
docker run -p 55934:55934 --env-file .env steuerberater-platform
```

### Option 3: Traditional Server Deployment

1. **Prepare server** (Ubuntu/Debian):
```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2
```

2. **Deploy application**:
```bash
# Clone and setup
git clone https://github.com/christophbertsch/0711-Steuerberater.git
cd 0711-Steuerberater
git checkout stable-mega-microagent-platform
npm install
npm run build

# Configure environment
cp .env.example .env
# Edit .env with production values

# Start with PM2
pm2 start api/index.js --name "steuerberater-api"
pm2 startup
pm2 save
```

## 🔍 Database Setup

### PostgreSQL Initialization

The production setup script automatically creates the required database schema:

```sql
-- Documents table
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

-- Tax research cache table
CREATE TABLE IF NOT EXISTS tax_research (
  id SERIAL PRIMARY KEY,
  query TEXT NOT NULL,
  results JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Qdrant Collection Setup

The system automatically creates the required Qdrant collection:

```javascript
// Collection configuration
{
  name: "steuerberater",
  vectors: {
    size: 1536,  // OpenAI ada-002 embedding size
    distance: "Cosine"
  }
}
```

## 🔒 Security Configuration

### SSL/TLS Setup

For production deployment, ensure SSL/TLS is configured:

1. **Nginx reverse proxy** (recommended):
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:55934;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

2. **Environment variables for SSL**:
```bash
# Add to .env for database SSL
DB_SSL=true
```

### API Key Security

- Store API keys securely (use environment variables, not hardcoded)
- Rotate API keys regularly
- Monitor API usage for anomalies
- Implement rate limiting

## 📊 Monitoring Setup

### Health Check Endpoints

The application provides health check endpoints:

- `GET /api/health` - Basic health check
- `GET /api/health/database` - Database connectivity
- `GET /api/health/qdrant` - Qdrant connectivity
- `GET /api/health/services` - External services status

### Monitoring Configuration

1. **Application monitoring**:
```bash
# Add monitoring environment variables
ENABLE_MONITORING=true
MONITORING_ENDPOINT=your-monitoring-service
```

2. **Log aggregation**:
```bash
# Configure log level
LOG_LEVEL=info
LOG_FORMAT=json
```

## 🚀 Performance Optimization

### Production Optimizations

1. **Enable compression**:
```javascript
// Already configured in api/index.js
app.use(compression());
```

2. **Database connection pooling**:
```javascript
// Configured in database/connection.js
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

3. **Caching strategy**:
- API response caching
- Vector search result caching
- Static asset caching

### Scaling Considerations

1. **Horizontal scaling**:
   - Deploy multiple API instances
   - Use load balancer (Nginx, HAProxy)
   - Session management with Redis

2. **Database scaling**:
   - Read replicas for PostgreSQL
   - Qdrant clustering for high availability

3. **CDN integration**:
   - Serve static assets from CDN
   - Cache API responses at edge locations

## 🔄 Backup and Recovery

### Database Backup

1. **PostgreSQL backup**:
```bash
# Daily backup script
pg_dump -h 34.107.63.251 -U postgres -d steuerberater > backup_$(date +%Y%m%d).sql
```

2. **Qdrant backup**:
```bash
# Backup Qdrant collection
curl -X POST "http://34.40.104.64:6333/collections/steuerberater/snapshots"
```

### Recovery Procedures

1. **Database recovery**:
```bash
# Restore PostgreSQL
psql -h 34.107.63.251 -U postgres -d steuerberater < backup_20240815.sql
```

2. **Application recovery**:
```bash
# Restart services
pm2 restart steuerberater-api
```

## 📈 Maintenance

### Regular Maintenance Tasks

1. **Weekly**:
   - Monitor system performance
   - Check error logs
   - Verify backup integrity

2. **Monthly**:
   - Update dependencies
   - Review security logs
   - Performance optimization

3. **Quarterly**:
   - Security audit
   - Capacity planning
   - Disaster recovery testing

### Update Procedures

1. **Application updates**:
```bash
# Pull latest changes
git pull origin stable-mega-microagent-platform

# Install dependencies
npm install

# Build application
npm run build

# Restart services
pm2 restart steuerberater-api
```

2. **Database migrations**:
```bash
# Run migration scripts if needed
npm run migrate
```

## 🆘 Troubleshooting

### Common Issues

1. **Database connection issues**:
   - Check network connectivity to `34.107.63.251:5432`
   - Verify credentials
   - Check SSL configuration

2. **Qdrant connection issues**:
   - Verify Qdrant service at `http://34.40.104.64:6333`
   - Check collection exists
   - Verify network access

3. **PDF2Q service issues**:
   - Test service availability at `https://pdf2q.onrender.com/health`
   - Check for service timeouts
   - Verify fallback mechanisms

### Debug Mode

Enable debug mode for troubleshooting:

```bash
# Add to .env
DEBUG=true
LOG_LEVEL=debug
```

### Support Contacts

- **Infrastructure Issues**: Contact system administrator
- **Application Issues**: Check GitHub issues or create new issue
- **API Issues**: Review API documentation and logs

## ✅ Post-Deployment Verification

### Verification Checklist

- [ ] Application accessible at configured URL
- [ ] Database connectivity confirmed
- [ ] Qdrant vector database operational
- [ ] PDF2Q service integration working
- [ ] Document upload and processing functional
- [ ] AI analysis generating results
- [ ] Tax research returning results
- [ ] All microagents responding correctly
- [ ] Health checks passing
- [ ] Monitoring alerts configured
- [ ] Backup procedures tested

### Performance Benchmarks

Expected performance metrics:
- Document upload: < 5 seconds for 10MB files
- AI analysis: < 30 seconds per document
- Vector search: < 2 seconds for similarity queries
- Tax research: < 10 seconds per query
- API response time: < 500ms for most endpoints

This deployment guide ensures a robust, secure, and scalable production deployment of the Steuerberater Mega Microagent Platform.