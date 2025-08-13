#!/bin/bash

# Setup script for local environment variables
# This script helps you create a .env file for local testing

echo "🔧 Setting up local environment for Tax & Law AI Expert"
echo ""

# Check if .env already exists
if [ -f .env ]; then
    echo "⚠️  .env file already exists"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Setup cancelled"
        exit 1
    fi
fi

echo "📝 Creating .env file..."

# Create .env file
cat > .env << 'EOF'
# Environment Variables for Tax & Law AI Expert
# Copy your actual tokens from Vercel Dashboard

# OpenAI API Key (required for AI document analysis)
OPENAI_API_KEY=your-openai-api-key-here

# Tavily API Key (optional - for enhanced tax research)
TAVILY_API_KEY=your-tavily-api-key-here

# Vercel Blob Storage (required for file uploads)
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token-here

# Development Settings
NODE_ENV=development
PORT=56534
EOF

echo "✅ .env file created successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Edit the .env file and replace the placeholder values with your actual tokens"
echo "2. Get your tokens from:"
echo "   - OpenAI API: https://platform.openai.com/api-keys"
echo "   - Tavily API: https://tavily.com"
echo "   - Vercel Blob: https://vercel.com/dashboard/stores"
echo "3. Your Vercel environment variables are already configured:"
echo "   ✅ BLOB_READ_WRITE_TOKEN (added 2h ago)"
echo "   ✅ OPENAI_API_KEY (added 11h ago)"
echo "   ✅ TAVILY_API_KEY (added 11h ago)"
echo "4. Run 'npm run server' to start the application"
echo ""
echo "💡 Tip: You can copy the token values from your Vercel Dashboard"
echo "   and paste them into the .env file for local testing"