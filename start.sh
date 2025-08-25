#!/bin/bash

# Build and start all services
echo "Starting Organic Fresh Coffee Landing Page..."
echo "Building and starting services with Docker Compose..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please copy .env.example to .env and configure your service URLs."
    echo "   cp .env.example .env"
    echo "   Then edit .env with your actual service configuration."
    exit 1
fi

# Load environment variables from .env file
export $(grep -v '^#' .env | xargs)

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
