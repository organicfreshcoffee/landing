import { getDatabase } from '../config/database';
import { createHash } from 'crypto';

export interface AuditLogEntry {
  userId: string;
  action: 'DATA_VIEW' | 'DATA_EXPORT' | 'DATA_DELETE' | 'DATA_PSEUDONYMIZED';
  timestamp: Date;
  metadata?: Record<string, any>;
}

export async function pseudonymizeUserAuditLogs(userId: string, email: string): Promise<number> {
  try {
    const db = getDatabase();
    const auditLogsCollection = db.collection('audit_logs');
    
    // Create a deterministic but anonymized identifier
    const anonymizedUserId = createHash('sha256').update(`deleted_user_${userId}`).digest('hex').substring(0, 16);
    
    // Update all existing audit logs for this user
    const updateResult = await auditLogsCollection.updateMany(
      { userId: userId },
      {
        $set: {
          userId: `DELETED_${anonymizedUserId}`,
          pseudonymizedDate: new Date(),
          originalDeletionRequest: true
        }
      }
    );

    // Create a final audit log entry for the pseudonymization action
    await createMinimalAuditLog(
      `DELETED_${anonymizedUserId}`,
      'DATA_PSEUDONYMIZED',
      {
        originalUserId: 'REDACTED',
        originalEmail: 'REDACTED',
        recordsPseudonymized: updateResult.modifiedCount,
        reason: 'GDPR Article 17 - Right to Erasure',
        retentionNote: 'Audit logs pseudonymized for compliance purposes'
      }
    );

    console.log(`Pseudonymized ${updateResult.modifiedCount} audit log entries for user ${userId}`);
    return updateResult.modifiedCount;
  } catch (error) {
    console.error('Error pseudonymizing audit logs:', error);
    return 0;
  }
}

export async function createMinimalAuditLog(
  userId: string, 
  action: 'DATA_VIEW' | 'DATA_EXPORT' | 'DATA_DELETE' | 'DATA_PSEUDONYMIZED',
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const db = getDatabase();
    const auditLogsCollection = db.collection('audit_logs');
    
    // Only store essential information for compliance
    const auditEntry = {
      userId: userId, // Keep user ID for linking to other systems if needed
      action: action,
      timestamp: new Date(),
      metadata: {
        ...metadata,
        dataMinimized: true,
        complianceNote: 'Personal data minimized per GDPR Article 5(1)(c)'
      },
      _id: undefined
    };
    
    await auditLogsCollection.insertOne(auditEntry);
    console.log(`Minimal audit log created for user ${userId}: ${action}`);
  } catch (error) {
    console.error('Error creating minimal audit log:', error);
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
      action: log.action,
      timestamp: log.timestamp,
      metadata: log.metadata
    }));
  } catch (error) {
    console.error('Error retrieving audit logs:', error);
    return [];
  }
}
