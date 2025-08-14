import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { getDatabase } from '../config/database';
import { getFirebaseConfig, admin } from '../config/firebase';

const router = Router();

// Endpoint to get Firebase client configuration
router.get('/firebase-config', async (req: Request, res: Response) => {
  try {
    console.log(`[${new Date().toISOString()}] Firebase config request received`);
    console.log('Request headers:', req.headers);
    console.log('Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT ? 'SET' : 'NOT SET',
      GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'SET' : 'NOT SET'
    });
    
    const config = await getFirebaseConfig();
    console.log('Firebase config retrieved successfully, sending response');
    res.json(config);
  } catch (error) {
    console.error('Error getting Firebase config:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    // Send minimal error information in production for security
    res.status(500).json({ 
      error: 'Failed to get Firebase configuration',
      timestamp: new Date().toISOString()
    });
  }
});

// Debug endpoint to check environment and GCP connectivity
router.get('/debug/environment', async (req: Request, res: Response) => {
  try {
    const envInfo = {
      NODE_ENV: process.env.NODE_ENV,
      GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT ? 'SET' : 'NOT SET',
      GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'SET' : 'NOT SET',
      timestamp: new Date().toISOString(),
      platform: process.platform,
      nodeVersion: process.version
    };
    
    console.log('Debug environment info:', envInfo);
    res.json(envInfo);
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    res.status(500).json({ error: 'Debug endpoint failed' });
  }
});

// Endpoint to record user login
router.post('/login', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();
    const userLoginsCollection = db.collection('user_logins');

    const loginRecord = {
      userId: req.user?.uid,
      email: req.user?.email,
      loginTime: new Date(),
      userAgent: req.headers['user-agent'] || 'Unknown',
      ip: req.ip || req.connection.remoteAddress || 'Unknown'
    };

    await userLoginsCollection.insertOne(loginRecord);

    res.json({ 
      success: true, 
      message: 'Login recorded successfully',
      userId: req.user?.uid 
    });
  } catch (error) {
    console.error('Error recording login:', error);
    res.status(500).json({ error: 'Failed to record login' });
  }
});

// Endpoint to get servers list
router.get('/servers', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log(`Servers request from user: ${req.user?.uid} (${req.user?.email})`);

    const db = getDatabase();
    const serversCollection = db.collection('servers');

    const servers = await serversCollection
      .find({})
      .sort({ server_name: 1 })
      .toArray();

    console.log(`Found ${servers.length} servers`);
    res.json(servers);
  } catch (error) {
    console.error('Error fetching servers:', error);
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

// Endpoint to verify authentication status
router.get('/verify', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    authenticated: true,
    user: {
      uid: req.user?.uid,
      email: req.user?.email,
      emailVerified: req.user?.email_verified
    }
  });
});

// Endpoint to export user data
router.get('/user/export-data', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log(`Export data request from user: ${req.user?.uid} (${req.user?.email})`);

    const db = getDatabase();
    const userLoginsCollection = db.collection('user_logins');

    // Get all login records for the authenticated user
    const userLogins = await userLoginsCollection
      .find({ userId: req.user?.uid })
      .sort({ loginTime: -1 }) // Most recent first
      .toArray();

    const exportData = {
      user: {
        uid: req.user?.uid,
        email: req.user?.email,
        emailVerified: req.user?.email_verified
      },
      loginHistory: userLogins.map(login => ({
        _id: login._id,
        userId: login.userId,
        email: login.email,
        loginTime: login.loginTime,
        userAgent: login.userAgent,
        ip: login.ip
      })),
      exportMetadata: {
        exportDate: new Date().toISOString(),
        totalLoginRecords: userLogins.length,
        source: 'landing_page_server'
      }
    };

    console.log(`Exported ${userLogins.length} login records for user ${req.user?.uid}`);
    
    res.json({
      success: true,
      data: exportData
    });
  } catch (error) {
    console.error('Error exporting user data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to export user data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
