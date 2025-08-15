import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { getDatabase } from '../config/database';
import { getFirebaseConfig, admin } from '../config/firebase';
import { createAuditLog, getAuditLogsForUser } from '../utils/auditLogger';

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

// Endpoint to view user data (for audit logging purposes)
router.get('/user/view-data', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log(`View data request from user: ${req.user?.uid} (${req.user?.email})`);

    // Create audit log for data viewing
    await createAuditLog({
      userId: req.user?.uid || '',
      email: req.user?.email || '',
      action: 'DATA_VIEW',
      timestamp: new Date(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        endpoint: '/user/view-data',
        method: 'GET'
      }
    });

    const db = getDatabase();
    const userLoginsCollection = db.collection('user_logins');

    // Get all login records for the authenticated user
    const userLogins = await userLoginsCollection
      .find({ userId: req.user?.uid })
      .sort({ loginTime: -1 }) // Most recent first
      .toArray();

    // Get audit logs for the user
    const auditLogs = await getAuditLogsForUser(req.user?.uid || '');

    const viewData = {
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
      auditLogs: auditLogs.map(log => ({
        action: log.action,
        timestamp: log.timestamp,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        metadata: log.metadata
      })),
      viewMetadata: {
        viewDate: new Date().toISOString(),
        totalLoginRecords: userLogins.length,
        totalAuditRecords: auditLogs.length,
        source: 'landing_page_server'
      }
    };

    console.log(`Viewed ${userLogins.length} login records and ${auditLogs.length} audit records for user ${req.user?.uid}`);
    
    res.json({
      success: true,
      data: viewData
    });
  } catch (error) {
    console.error('Error viewing user data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to view user data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Endpoint to export user data
router.get('/user/export-data', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log(`Export data request from user: ${req.user?.uid} (${req.user?.email})`);

    // Create audit log for data export
    await createAuditLog({
      userId: req.user?.uid || '',
      email: req.user?.email || '',
      action: 'DATA_EXPORT',
      timestamp: new Date(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        endpoint: '/user/export-data',
        method: 'GET'
      }
    });

    const db = getDatabase();
    const userLoginsCollection = db.collection('user_logins');

    // Get all login records for the authenticated user
    const userLogins = await userLoginsCollection
      .find({ userId: req.user?.uid })
      .sort({ loginTime: -1 }) // Most recent first
      .toArray();

    // Get audit logs for the user
    const auditLogs = await getAuditLogsForUser(req.user?.uid || '');

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
      auditLogs: auditLogs.map(log => ({
        action: log.action,
        timestamp: log.timestamp,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        metadata: log.metadata
      })),
      exportMetadata: {
        exportDate: new Date().toISOString(),
        totalLoginRecords: userLogins.length,
        totalAuditRecords: auditLogs.length,
        source: 'landing_page_server'
      }
    };

    console.log(`Exported ${userLogins.length} login records and ${auditLogs.length} audit records for user ${req.user?.uid}`);
    
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

// Endpoint to delete user data from landing page
router.delete('/user/delete-data', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log(`Delete data request from user: ${req.user?.uid} (${req.user?.email})`);

    // Create audit log for data deletion BEFORE deleting the data
    await createAuditLog({
      userId: req.user?.uid || '',
      email: req.user?.email || '',
      action: 'DATA_DELETE',
      timestamp: new Date(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        endpoint: '/user/delete-data',
        method: 'DELETE'
      }
    });

    const db = getDatabase();
    const userLoginsCollection = db.collection('user_logins');

    // Delete all login records for the authenticated user
    const deleteResult = await userLoginsCollection.deleteMany({ 
      userId: req.user?.uid 
    });

    // Note: We intentionally do NOT delete audit logs for compliance reasons
    // Audit logs must be retained even after account deletion for legal/compliance purposes

    console.log(`Deleted ${deleteResult.deletedCount} login records for user ${req.user?.uid}`);
    console.log(`Audit logs retained for compliance purposes`);
    
    res.json({
      success: true,
      message: 'User data deleted successfully',
      deletedRecords: deleteResult.deletedCount,
      userId: req.user?.uid,
      note: 'Audit logs retained for compliance purposes'
    });
  } catch (error) {
    console.error('Error deleting user data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete user data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
