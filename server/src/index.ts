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

// Middleware - Allow multiple client ports for development
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.CLIENT_URL 
    : [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3003',
        'http://localhost:3004',
        'http://localhost:3005'
      ],
  credentials: true
}));
app.use(express.json());

// Initialize Firebase Admin SDK
initializeFirebaseAdmin().catch(console.error);

// Connect to Database
connectToDatabase().catch(console.error);

// Routes
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
