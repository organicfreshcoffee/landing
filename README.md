# Organic Fresh Coffee Landing Page

A full-stack web application built with Next.js, Express.js, and MongoDB. This project demonstrates a complete authentication flow with user login tracking using an external authentication microservice.

## 🏗️ Architecture

- **Frontend**: Next.js 14 with TypeScript
- **Backend**: E## 🤖 Automated Issue Resolution

This repository includes an AI-powered automation system that uses Claude Haiku 3.5 to automatically analyze and fix GitHub issues.

### How It Works

- **Daily Analysis**: Every day at 9:00 AM UTC, Claude analyzes all open issues
- **Smart Selection**: AI determines the easiest and safest issue to fix automatically  
- **Auto-Implementation**: Generates and applies code changes
- **Pull Request**: Creates a PR with the fix for manual review

### Setup Required

To enable this feature, add your Anthropic API key to repository secrets:
1. Go to repository `Settings` → `Secrets and variables` → `Actions`
2. Add `ANTHROPIC_API_KEY` with your Claude API key
3. Ensure workflow permissions allow PR creation

See [docs/AUTO_ISSUE_FIX.md](docs/AUTO_ISSUE_FIX.md) for detailed setup instructions.Script
- **Authentication**: External Auth Microservice (Firebase Auth)
- **Database**: MongoDB
- **Infrastructure**: Docker Compose for local development

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Docker](https://www.docker.com/get-started) and Docker Compose
- [Git](https://git-scm.com/)
- Access to the authentication microservice

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/organicfreshcoffee/landing.git
cd landing
```

### 2. Configure Environment Variables

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` with your service configuration:

```bash
# Environment Configuration
NODE_ENV=development

# URLs Configuration
CLIENT_URL=http://localhost:3000
SERVER_URL=http://localhost:3001
AUTH_SERVER_URL=http://localhost:3002  # Your auth microservice URL

# Production URLs:
# CLIENT_URL=https://organicfreshcoffee.com
# SERVER_URL=https://api.organicfreshcoffee.com
# AUTH_SERVER_URL=https://auth.organicfreshcoffee.com

# Database
MONGODB_URI=mongodb://localhost:27017/organicfreshcoffee
```

**Important**: 
- Replace `AUTH_SERVER_URL` with your actual authentication microservice URL
- Update production URLs as needed for your deployment

### 3. Start the Application

The easiest way to run the entire stack:

```bash
./start.sh
```

Or manually with Docker Compose:

```bash
docker-compose up --build
```

### 4. Access the Application

- **Frontend (Next.js)**: http://localhost:3000
- **Backend (Express)**: http://localhost:3001  
- **MongoDB**: mongodb://localhost:27017
- **Auth Service**: http://localhost:3002 (external service)

### Testing Multiple Clients

Run the client twice locally

In one terminal, start all services:
```
docker-compose up
```

In another terminal, start the second client:
```
cd client
NEXT_PUBLIC_API_URL=http://localhost:3001 NEXT_PUBLIC_AUTH_SERVER_URL=http://localhost:3002 npm run dev
```

## Running the MongoDB Migrations
```
docker build -f migration.Dockerfile -t db-migration .
docker run --rm -e MONGODB_URI="your-mongodb-connection-string-here" db-migration
```

## 📦 Dependencies

### Frontend (`/client`)

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | ^14.0.4 | React framework |
| `react` | ^18 | UI library |
| `react-dom` | ^18 | React DOM renderer |
| `axios` | ^1.6.2 | HTTP client |
| `typescript` | ^5 | Type safety |

### Backend (`/server`)

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^4.18.2 | Web framework |
| `mongodb` | ^6.3.0 | MongoDB driver |
| `cors` | ^2.8.5 | Cross-origin requests |
| `dotenv` | ^16.3.1 | Environment variables |
| `typescript` | ^5.3.3 | Type safety |

## 🔧 Development

### Running Individual Services

**Client only:**
```bash
cd client
npm install
npm run dev
```

**Server only:**
```bash
cd server
npm install
npm run dev
```

**MongoDB only:**
```bash
docker run -d -p 27017:27017 --name mongodb \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  mongo:7
```

### Available Scripts

**Client:**
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

**Server:**
- `npm run dev` - Start development server with nodemon
- `npm run build` - Compile TypeScript
- `npm run start` - Start production server

## 🔐 Security Features

- **External Authentication Service**: Secure user authentication with JWT tokens handled by microservice
- **JWT Token Verification**: Server-side token validation via auth microservice
- **No Local Secrets**: Authentication credentials managed by external service
- **Database Security**: MongoDB connection security
- **CORS Configuration**: Cross-origin request security

## 🚀 Features

- **User Registration & Login**: Email/password authentication via microservice
- **Protected Routes**: Authentication-required pages
- **Login Tracking**: MongoDB storage of user login events
- **Responsive Design**: Mobile-friendly interface
- **Real-time Updates**: Login history display
- **Docker Support**: Containerized development environment

## 🛠️ Troubleshooting

### Common Issues

1. **Auth Service Connection Error**
   ```
   Error: Authentication service unavailable
   ```
   **Solution**: 
   - Verify `AUTH_SERVER_URL` is correctly set in your `.env` file
   - Ensure the authentication microservice is running and accessible
   - Check network connectivity to the auth service

2. **Token Verification Failed**
   ```
   Error: Invalid or expired token
   ```
   **Solution**: 
   - Ensure the authentication microservice is responding correctly
   - Check that the auth service `/api/verify` endpoint is working
   - Verify token format and expiration

3. **MongoDB Connection Failed**
   ```
   Error connecting to MongoDB
   ```
   **Solution**: Make sure MongoDB is running and the connection string is correct.

4. **Environment Variables Not Set**
   ```
   Error: AUTH_SERVER_URL not configured
   ```
   **Solution**: Ensure your `.env` file has the correct `AUTH_SERVER_URL` value.

5. **MongoDB Initialization Script Not Running**
   ```
   Initial server data not found in database
   ```
   **Solution**: The `init-mongo.js` script only runs when MongoDB creates a fresh database. If you need to rerun it:
   ```bash
   docker-compose down
   docker volume rm landing_mongodb_data
   docker-compose up -d
   ```
   **Note**: This will delete all existing MongoDB data and recreate the database with initial data.

6. **Docker disk is full**
    ```
    Mongodb continually restarts
    ```
    ***Solution***
     - `docker system prune -f`
     - `docker volume prune -f`
     - `docker-compose down`
     - `./start.sh`

### Debug Commands

```bash
# Check running containers
docker-compose ps

# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Clean rebuild
docker-compose down
docker-compose up --build

# Test auth service connectivity
curl -X GET "${AUTH_SERVER_URL}/api/firebase-config"
curl -X GET "${AUTH_SERVER_URL}/api/verify" -H "Authorization: Bearer your-test-token"

# Reset MongoDB and rerun initialization script
docker-compose down
docker volume rm landing_mongodb_data
docker-compose up -d
```

## 🌍 Deployment

### Production Considerations

1. **Environment Variables**: Use production auth service URL
2. **Database**: Use MongoDB Atlas or managed MongoDB
3. **SSL/TLS**: Configure HTTPS
4. **Domain**: Update CORS and redirect URLs
4. **SSL/TLS**: Configure HTTPS
5. **Domain**: Update CORS and redirect URLs

### Docker Production Build

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Start production services
docker-compose -f docker-compose.prod.yml up -d
```

## 🔧 Admin System

This application includes an admin system for managing game servers. See [docs/ADMIN_SYSTEM.md](docs/ADMIN_SYSTEM.md) for complete documentation.

### Quick Admin Setup (Development)

1. Install server dependencies (if not already done):
   ```bash
   cd server && npm install
   ```

2. Start the application:
   ```bash
   docker-compose up
   ```

3. Add yourself as an admin:
   ```bash
   node scripts/add-admin.js your-email@example.com
   ```

4. Log in with your email and access the admin panel via the hamburger menu (☰) → "Admin Panel"

### Admin Features

- **Server Management**: Add, edit, and delete official and third-party game servers
- **Role-based Access**: Only designated admin users can access admin functionality
- **Secure API**: All admin endpoints require authentication and admin privileges

### Production Admin Setup

For production environments, use the same script with a custom MongoDB URI:
```bash
# Add admin user in production
MONGODB_URI=your-production-uri node scripts/add-admin.js admin@example.com
```

## � Automated Issue Resolution

This repository includes an AI-powered automation system that uses Claude Sonnet to automatically analyze and fix GitHub issues.

### How It Works

- **Daily Analysis**: Every day at 9:00 AM UTC, Claude analyzes all open issues
- **Smart Selection**: AI determines the easiest and safest issue to fix automatically  
- **Auto-Implementation**: Generates and applies code changes
- **Pull Request**: Creates a PR with the fix for manual review

### Setup Required

To enable this feature, add your Anthropic API key to repository secrets:
1. Go to repository `Settings` → `Secrets and variables` → `Actions`
2. Add `ANTHROPIC_API_KEY` with your Claude API key
3. Ensure workflow permissions allow PR creation

See [docs/AUTO_ISSUE_FIX.md](docs/AUTO_ISSUE_FIX.md) for detailed setup instructions.

## �🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or need help:

1. Check the [Troubleshooting](#-troubleshooting) section
2. Open an issue on GitHub
3. Check Docker and Docker Compose documentation

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) for the amazing React framework
- [MongoDB](https://www.mongodb.com/) for the database
- [Docker](https://www.docker.com/) for containerization

### last-guardian-sprites

https://opengameart.org/content/700-sprites

CC-BY 3.0 license

By Philipp Lenssen : outer-court.com 
