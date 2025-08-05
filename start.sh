#!/bin/bash

# Build and start all services
echo "Starting Organic Fresh Coffee Landing Page..."
echo "Building and starting services with Docker Compose..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please copy .env.example to .env and configure your Firebase credentials."
    echo "   cp .env.example .env"
    echo "   Then edit .env with your actual Firebase configuration."
    exit 1
fi

# Load environment variables from .env file
export $(grep -v '^#' .env | xargs)

# Check if Firebase service account key exists
if [ ! -f "${GOOGLE_APPLICATION_CREDENTIALS}" ]; then
    echo "❌ Firebase service account key not found at: ${GOOGLE_APPLICATION_CREDENTIALS}"
    echo "   Please download your Firebase service account key and update the GOOGLE_APPLICATION_CREDENTIALS path in .env"
    exit 1
fi

# Start services
docker-compose up --build -d

echo "✅ Services starting up..."
echo ""
echo "🔗 Available services:"
echo "   📱 Client (Next.js):     http://localhost:3000"
echo "   🚀 Server (Express):     http://localhost:3001"
echo "   📊 MongoDB:              mongodb://localhost:27017"
echo ""
echo "📋 To view logs:"
echo "   docker-compose logs -f"
echo ""
echo "🛑 To stop services:"
echo "   docker-compose down"
