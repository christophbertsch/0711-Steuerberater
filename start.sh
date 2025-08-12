#!/bin/bash

echo "🚀 Starting Tax & Law AI Expert Application"
echo "=========================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the frontend
echo "🔨 Building frontend..."
npm run build

# Check for environment variables
if [ -z "$OPENAI_API_KEY" ]; then
    echo "⚠️  Warning: OPENAI_API_KEY not set. AI features will use mock data."
fi

if [ -z "$TAVILY_API_KEY" ]; then
    echo "⚠️  Warning: TAVILY_API_KEY not set. Tax research will use mock data."
fi

# Start the server
echo "🌐 Starting server on http://localhost:56534"
echo "📱 Frontend will be available at http://localhost:54628"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start both server and frontend development server
npm run server &
SERVER_PID=$!

npm run dev &
DEV_PID=$!

# Function to cleanup processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    kill $SERVER_PID 2>/dev/null
    kill $DEV_PID 2>/dev/null
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Wait for processes
wait