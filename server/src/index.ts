import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeFirebaseAdmin } from './config/firebase';
import { connectToDatabase } from './config/database';
import authRoutes from './routes/auth';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware - Configure CORS for both development and production
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? [
      process.env.CLIENT_URL || 'https://organicfreshcoffee.com',
      'https://organicfreshcoffee.com',
      'https://www.organicfreshcoffee.com'
    ]
  : [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:3004',
      'http://localhost:3005'
    ];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());

// Initialize services before starting the server
async function initializeServices() {
  try {
    // Initialize Firebase Admin SDK first
    console.log('Initializing Firebase Admin SDK...');
    await initializeFirebaseAdmin();
    
    // Connect to Database
    console.log('Connecting to database...');
    await connectToDatabase();
    
    console.log('All services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

// Routes (set up after services are initialized)
async function setupServer() {
  await initializeServices();
  
  app.use('/api', authRoutes);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  // Error handling middleware
  app.use(errorHandler);

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Start the server
setupServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
