import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { getDatabase } from '../config/database';
import { getFirebaseConfig } from '../config/firebase';

const router = Router();

// Endpoint to get Firebase client configuration
router.get('/firebase-config', async (req: Request, res: Response) => {
  try {
    const config = await getFirebaseConfig();
    res.json(config);
  } catch (error) {
    console.error('Error getting Firebase config:', error);
    res.status(500).json({ error: 'Failed to get Firebase configuration' });
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
    const db = getDatabase();
    const serversCollection = db.collection('servers');

    const servers = await serversCollection
      .find({})
      .sort({ server_name: 1 })
      .toArray();

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

export default router;
