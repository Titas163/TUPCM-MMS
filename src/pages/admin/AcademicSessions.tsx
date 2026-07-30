import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { AcademicSession } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DeleteButton } from '../../components/ui/DeleteButton';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Search, Plus, Edit2, Trash2 } from 'lucide-react';

export function AcademicSessions() {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    sessionName: '',
    sessionNameBn: '',
    isDefault: false,
    status: 'active' as 'active' | 'inactive'
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'academicSessions'), orderBy('sessionName', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ ...doc.data(), sessionId: doc.id } as AcademicSession));
      setSessions(data);
    } catch (error) {
      console.error("Error fetching sessions", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (session?: AcademicSession) => {
    if (session) {
      setEditingId(session.sessionId);
      setFormData({
        sessionName: session.sessionName,
        isDefault: session.isDefault,
        status: session.status
      });
    } else {
      setEditingId(null);
      setFormData({
        sessionName: '',
    sessionNameBn: '',
        isDefault: sessions.length === 0, // make default if first
        status: 'active'
      });
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    
    try {
      await deleteDoc(doc(db, 'academicSessions', id));
      fetchData();
    } catch (error) {
      console.error("Error deleting session", error);
      alert('An error occurred while deleting the session.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      
      // If setting this one as default, unset others (simplified approach for now)
      if (formData.isDefault) {
          const currentDefault = sessions.find(s => s.isDefault && s.sessionId !== editingId);
          if (currentDefault) {
              await updateDoc(doc(db, 'academicSessions', currentDefault.sessionId), { isDefault: false });
          }
      }

      if (editingId) {
        await updateDoc(doc(db, 'academicSessions', editingId), formData);
      } else {
        await addDoc(collection(db, 'academicSessions'), formData);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error saving session", error);
    }
  };

  const filteredSessions = sessions.filter(s => 
    s.sessionName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t.academicSessions}
          </h1>
        </div>
        <Button onClick={() => handleOpenModal()} className="gap-2">
          <Plus className="w-4 h-4" />
          {t.add}
        </Button>
      </div>

      <Card className="border-none shadow-md dark:bg-slate-900">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder={t.search} 
              className="pl-9 bg-slate-50 dark:bg-slate-950"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-medium">{t.name}</th>
                  <th className="px-6 py-4 font-medium">Default</th>
                  <th className="px-6 py-4 font-medium">{t.status}</th>
                  <th className="px-6 py-4 font-medium text-right">{t.action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      <div className="flex justify-center"><div className="w-6 h-6 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div></div>
                    </td>
                  </tr>
                ) : filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      {t.noData}
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((session) => (
                    <tr key={session.sessionId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        {session.sessionName} {(session as any).sessionNameBn ? `(${ (session as any).sessionNameBn })` : ""}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {session.isDefault ? 'Yes' : 'No'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          session.status === 'active' 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {session.status === 'active' ? t.active : t.inactive}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenModal(session)} title="Edit">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <DeleteButton onConfirm={() => handleDelete(session.sessionId)} />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-xl border-none">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800">
              <CardTitle>{editingId ? t.edit : t.add}</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t.name}</label>
                  <Input 
                    required 
                    value={formData.sessionName}
                    onChange={e => setFormData({...formData, sessionName: e.target.value})}
                    placeholder="e.g. 2026-2027"
                  />
                </div>
                <div className="flex items-center gap-2 mt-4 mb-2">
                    <input 
                        type="checkbox" 
                        id="isDefault" 
                        checked={formData.isDefault}
                        onChange={e => setFormData({...formData, isDefault: e.target.checked})}
                        className="w-4 h-4"
                    />
                    <label htmlFor="isDefault" className="text-sm font-medium">Set as Default Session</label>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t.status}</label>
                  <Select 
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value as any})}
                  >
                    <option value="active">{t.active}</option>
                    <option value="inactive">{t.inactive}</option>
                  </Select>
                </div>
                <div className="pt-4 flex gap-3 justify-end">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                    {t.cancel}
                  </Button>
                  <Button type="submit">
                    {t.save}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
