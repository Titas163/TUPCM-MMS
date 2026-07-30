import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AuditLog } from '../types';

export const auditService = {
  log: async (userId: string, action: string, module: string, details?: any) => {
    try {
      const logData: Omit<AuditLog, 'logId'> = {
        userId,
        action,
        module,
        timestamp: Date.now(),
        ...(details ? { newValue: details } : {})
      };
      await addDoc(collection(db, 'auditLogs'), logData);
    } catch (error) {
      console.error("Failed to write audit log:", error);
    }
  }
};
