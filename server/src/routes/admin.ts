import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { getDatabase } from '../config/database';
import { ObjectId } from 'mongodb';

const router = Router();

// Middleware to check if user is admin
const requireAdmin = async (req: AuthenticatedRequest, res: Response, next: Function) => {
  try {
    if (!req.user?.email) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const db = getDatabase();
    const adminsCollection = db.collection('admins');
    
    const admin = await adminsCollection.findOne({ email: req.user.email });
    
    if (!admin) {
      return res.status(403).json({ error: 'Admin privileges required' });
    }
    
    next();
  } catch (error) {
    console.error('Error checking admin status:', error);
    res.status(500).json({ error: 'Failed to verify admin status' });
  }
};

// Check if user is admin
router.get('/check', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.email) {
      return res.json({ isAdmin: false });
    }

    const db = getDatabase();
    const adminsCollection = db.collection('admins');
    
    const admin = await adminsCollection.findOne({ email: req.user.email });
    
    res.json({ isAdmin: !!admin });
  } catch (error) {
    console.error('Error checking admin status:', error);
    res.status(500).json({ error: 'Failed to check admin status' });
  }
});

// Get all servers (admin only)
router.get('/servers', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDatabase();
    const serversCollection = db.collection('servers');

    const servers = await serversCollection
      .find({})
      .sort({ server_name: 1 })
      .toArray();

    res.json(servers);
  } catch (error) {
    console.error('Error fetching servers for admin:', error);
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

// Add new server (admin only)
router.post('/servers', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { server_name, server_address, is_official, is_third_party } = req.body;

    if (!server_name || !server_address) {
      return res.status(400).json({ error: 'Server name and address are required' });
    }

    const db = getDatabase();
    const serversCollection = db.collection('servers');

    // Check if server with same name already exists
    const existingServer = await serversCollection.findOne({ server_name });
    if (existingServer) {
      return res.status(409).json({ error: 'Server with this name already exists' });
    }

    const newServer = {
      server_name,
      server_address,
      is_official: !!is_official,
      is_third_party: !!is_third_party,
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await serversCollection.insertOne(newServer);
    
    res.status(201).json({ 
      message: 'Server added successfully',
      serverId: result.insertedId 
    });
  } catch (error) {
    console.error('Error adding server:', error);
    res.status(500).json({ error: 'Failed to add server' });
  }
});

// Update server (admin only)
router.put('/servers/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { server_name, server_address, is_official, is_third_party } = req.body;

    if (!server_name || !server_address) {
      return res.status(400).json({ error: 'Server name and address are required' });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid server ID' });
    }

    const db = getDatabase();
    const serversCollection = db.collection('servers');

    // Check if another server with the same name exists (excluding current server)
    const existingServer = await serversCollection.findOne({ 
      server_name, 
      _id: { $ne: new ObjectId(id) } 
    });
    
    if (existingServer) {
      return res.status(409).json({ error: 'Server with this name already exists' });
    }

    const updateData = {
      server_name,
      server_address,
      is_official: !!is_official,
      is_third_party: !!is_third_party,
      updated_at: new Date()
    };

    const result = await serversCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    res.json({ message: 'Server updated successfully' });
  } catch (error) {
    console.error('Error updating server:', error);
    res.status(500).json({ error: 'Failed to update server' });
  }
});

// Delete server (admin only)
router.delete('/servers/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid server ID' });
    }

    const db = getDatabase();
    const serversCollection = db.collection('servers');

    const result = await serversCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    res.json({ message: 'Server deleted successfully' });
  } catch (error) {
    console.error('Error deleting server:', error);
    res.status(500).json({ error: 'Failed to delete server' });
  }
});

export default router;
