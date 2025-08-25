#!/bin/bash

# Setup script for Organic Fresh Coffee Landing Page
set -e

echo "🚀 Setting up Organic Fresh Coffee Landing Page..."
echo ""

# Check if required tools are installed
echo "📋 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ required. Current version: $(node -v)"
    exit 1
fi
echo "✅ Node.js $(node -v)"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker from https://www.docker.com/get-started"
    exit 1
fi
echo "✅ Docker $(docker --version)"

echo "✅ Docker Compose $(docker-compose --version)"

echo ""

# Setup environment file
echo "🔧 Setting up environment configuration..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created .env file from template"
    echo "⚠️  Please edit .env with your database and service URLs"
else
    echo "✅ .env file already exists"
fi

echo ""
# Install client dependencies
echo "📦 Installing client dependencies..."
cd client
if [ ! -d node_modules ]; then
    npm install
    echo "✅ Client dependencies installed"
else
    echo "✅ Client dependencies already installed"
fi
cd ..

# Install server dependencies
echo ""
echo "📦 Installing server dependencies..."
cd server
if [ ! -d node_modules ]; then
    npm install
    echo "✅ Server dependencies installed"
else
    echo "✅ Server dependencies already installed"
fi
cd ..

echo ""
echo "🎉 Setup complete!"
echo ""
echo "🚀 Ready to start the application:"
echo "   ./start.sh"
echo ""
echo "🌐 The application will be available at:"
echo "   http://localhost:3000"
echo ""
echo "📚 For detailed information, see README.md"
