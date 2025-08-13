#!/bin/bash

# Tax & Law AI Expert - Startup Script
echo "🏛️🤖 Tax & Law AI Expert - Startup"
echo "=================================="

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cp .env.example .env
    echo "📝 Please edit .env file and add your OpenAI API key"
    echo "   Get your API key from: https://platform.openai.com/api-keys"
    echo ""
fi

# Check if API key is configured
if grep -q "your-openai-api-key-here" .env 2>/dev/null; then
    echo "⚠️  OpenAI API key not configured in .env file"
    echo "   Please edit .env and replace 'your-openai-api-key-here' with your actual key"
    echo ""
fi

# Load environment variables
export $(cat .env | grep -v '#' | xargs)

# Check if OpenAI API key is set
if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "your-openai-api-key-here" ]; then
    echo "❌ OpenAI API key not configured"
    echo "   KI-Dokumentenanalyse will use mock data only"
    echo "   To activate AI analysis:"
    echo "   1. Get API key from https://platform.openai.com/api-keys"
    echo "   2. Edit .env file and set OPENAI_API_KEY=your-actual-key"
    echo "   3. Restart the server"
    echo ""
else
    echo "✅ OpenAI API key configured"
    echo "   KI-Dokumentenanalyse is ACTIVE"
    echo ""
fi

# Start the server
echo "🚀 Starting server on port $PORT..."
node server.js
