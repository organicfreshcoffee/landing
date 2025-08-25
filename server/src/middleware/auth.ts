import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Get auth server URL from environment variables
    const authServerUrl = process.env.AUTH_SERVER_URL;
    if (!authServerUrl) {
      console.error('AUTH_SERVER_URL not configured');
      return res.status(503).json({ 
        error: 'Authentication service unavailable',
        details: process.env.NODE_ENV === 'development' ? 'AUTH_SERVER_URL not configured' : undefined
      });
    }

    // Call the external auth server to verify the token
    const response = await fetch(`${authServerUrl}/api/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Token verification failed:', response.status, response.statusText);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    const verificationResult = await response.json() as {
      authenticated: boolean;
      user?: {
        uid: string;
        email: string;
        email_verified: boolean;
      };
    };
    
    if (!verificationResult.authenticated || !verificationResult.user) {
      console.error('Token verification returned invalid result');
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    req.user = verificationResult.user;
    
    console.log(`Token verified for user: ${verificationResult.user.uid} (${verificationResult.user.email})`);
    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    return res.status(503).json({ error: 'Authentication service unavailable' });
  }
}
