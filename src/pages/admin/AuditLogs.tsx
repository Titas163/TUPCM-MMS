import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { AuditLog, User } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { History, Search, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { formatDate } from '../../lib/utils';
import { useAppStore } from '../../store';

export function AuditLogs() {
  const { t } = useTranslation();
  const { language } = useAppStore();
  const [logs, setLogs] = useState<(AuditLog & { userName?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetchLogs() {
      try {
        const [usersSnap, logsSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(100)))
        ]);
        
        const users = usersSnap.docs.map(d => ({ ...d.data(), uid: d.id } as User));
        
        const data = logsSnap.docs.map(doc => {
          const l = { ...doc.data(), logId: doc.id } as AuditLog;
          const user = users.find(u => u.uid === l.userId);
          return { ...l, userName: user?.fullName || 'System/Unknown' };
        });
        
        setLogs(data);
      } catch (error) {
        console.error("Error fetching logs:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(l => 
    l.userName?.toLowerCase().includes(search.toLowerCase()) || 
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.module.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t.auditLogs || 'Audit Logs'}
          </h1>
          <p className="text-sm text-slate-500">Review system activities and changes (showing last 100 entries)</p>
        </div>
      </div>

      <Card className="border-none shadow-md dark:bg-slate-900">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search by user, action, or module..." 
              className="pl-9 bg-slate-50 dark:bg-slate-950"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Timestamp</th>
                  <th className="px-6 py-4 font-medium">User</th>
                  <th className="px-6 py-4 font-medium">Module</th>
                  <th className="px-6 py-4 font-medium">Action</th>
                  <th className="px-6 py-4 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      Loading logs...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500 flex flex-col items-center">
                      <History className="w-8 h-8 text-slate-300 mb-2" />
                      No audit logs found.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.logId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                        {formatDate(log.timestamp, language, true)}
                      </td>
                      <td className="px-6 py-4 font-medium">
                        {log.userName}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {log.module}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                        {log.action}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-500">
                        {log.oldValue && (
                          <div className="truncate max-w-xs cursor-help" title={JSON.stringify(log.oldValue)}>
                            Old: {JSON.stringify(log.oldValue)}
                          </div>
                        )}
                        {log.newValue && (
                          <div className="truncate max-w-xs cursor-help" title={JSON.stringify(log.newValue)}>
                            New: {JSON.stringify(log.newValue)}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
