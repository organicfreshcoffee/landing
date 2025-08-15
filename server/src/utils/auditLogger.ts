import { getDatabase } from '../config/database';

export interface AuditLogEntry {
  userId: string;
  email: string;
  action: 'DATA_VIEW' | 'DATA_EXPORT' | 'DATA_DELETE';
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const db = getDatabase();
    const auditLogsCollection = db.collection('audit_logs');
    
    const auditEntry = {
      ...entry,
      timestamp: new Date(),
      _id: undefined // Let MongoDB generate the ID
    };
    
    await auditLogsCollection.insertOne(auditEntry);
    console.log(`Audit log created for user ${entry.userId}: ${entry.action}`);
  } catch (error) {
    console.error('Error creating audit log:', error);
    // Don't throw error - audit logging should not break the main functionality
  }
}

export async function getAuditLogsForUser(userId: string): Promise<AuditLogEntry[]> {
  try {
    const db = getDatabase();
    const auditLogsCollection = db.collection('audit_logs');
    
    const auditLogs = await auditLogsCollection
      .find({ userId })
      .sort({ timestamp: -1 }) // Most recent first
      .toArray();
    
    return auditLogs.map(log => ({
      userId: log.userId,
      email: log.email,
      action: log.action,
      timestamp: log.timestamp,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      metadata: log.metadata
    }));
  } catch (error) {
    console.error('Error retrieving audit logs:', error);
    return [];
  }
}
