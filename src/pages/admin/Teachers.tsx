import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, orderBy, limit } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, auth, firebaseConfig } from '../../lib/firebase';
import { Teacher, User } from '../../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { DeleteButton } from '../../components/ui/DeleteButton';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Search, Plus, Edit2, KeyRound, Check, Copy, Trash2 } from 'lucide-react';
import { useAppStore } from '../../store';
import { auditService } from '../../services/auditService';

function generateSecurePassword() {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const num = '0123456789';
  const special = '!@#$%^&*()_+~';
  const all = upper + lower + num + special;
  
  let password = '';
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += num[Math.floor(Math.random() * num.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  for (let i = 0; i < 4; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}

export function Teachers() {
  const { t } = useTranslation();
  const { user } = useAppStore();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    teacherName: '',
    mobile: '',
    email: '',
    status: 'active' as 'active' | 'inactive',
    passwordOption: 'manual' as 'manual' | 'auto',
    password: ''
  });

  const [resetData, setResetData] = useState({
    teacherId: '',
    passwordOption: 'manual' as 'manual' | 'auto',
    password: ''
  });

  const [generatedPassword, setGeneratedPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'teachers'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ ...doc.data(), teacherId: doc.id } as Teacher));
      setTeachers(data);
    } catch (error) {
      console.error("Error fetching teachers", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const getNextTeacherId = async () => {
    const q = query(collection(db, 'teachers'), orderBy('teacherId', 'desc'), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return 'TCH-0001';
    
    const lastId = snapshot.docs[0].id;
    if (lastId.startsWith('TCH-')) {
      const num = parseInt(lastId.substring(4), 10);
      return `TCH-${(num + 1).toString().padStart(4, '0')}`;
    }
    return `TCH-${Date.now().toString().slice(-4)}`;
  };

  const handleOpenModal = (teacher?: Teacher) => {
    setError('');
    setGeneratedPassword('');
    if (teacher) {
      setEditingId(teacher.teacherId);
      setFormData({
        teacherName: teacher.teacherName,
        mobile: teacher.mobile,
        email: teacher.email || '',
        status: teacher.status,
        passwordOption: 'manual',
        password: ''
      });
    } else {
      setEditingId(null);
      setFormData({
        teacherName: '',
        mobile: '',
        email: '',
        status: 'active',
        passwordOption: 'manual',
        password: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenResetModal = (teacher: Teacher) => {
    setError('');
    setGeneratedPassword('');
    setResetData({
      teacherId: teacher.teacherId,
      passwordOption: 'manual',
      password: ''
    });
    setIsResetModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (editingId) {
        // Just update teacher basic info
        await updateDoc(doc(db, 'teachers', editingId), {
          teacherName: formData.teacherName,
          mobile: formData.mobile,
          email: formData.email,
          status: formData.status,
          updatedAt: Date.now()
        });
        
        // Also update users collection
        await updateDoc(doc(db, 'users', editingId), {
          fullName: formData.teacherName,
          mobile: formData.mobile,
          email: formData.email,
          active: formData.status === 'active',
          updatedAt: Date.now()
        });
        
        await auditService.log(user?.uid || 'admin', 'UPDATE_TEACHER', 'TEACHERS', { teacherId: editingId });
        
        setIsModalOpen(false);
        fetchTeachers();
      } else {
        // Create new teacher
        const passwordToUse = formData.passwordOption === 'auto' ? generateSecurePassword() : formData.password;
        
        if (!passwordToUse || passwordToUse.length < 8) {
          throw new Error("Password must be at least 8 characters");
        }
        
        const authEmail = `${formData.mobile}@madrasa.local`;
        
        // Use Secondary Firebase App to avoid signing out the Admin
        const secondaryApp = getApps().find(app => app.name === 'Secondary') || initializeApp(firebaseConfig, 'Secondary');
        const secondaryAuth = getAuth(secondaryApp);
        
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, authEmail, passwordToUse);
        const newUid = userCredential.user.uid;
        
        await signOut(secondaryAuth);
        
        const nextTeacherId = await getNextTeacherId();

        // Create User Doc
        const newUser: User = {
          uid: newUid,
          email: formData.email || authEmail,
          fullName: formData.teacherName,
          mobile: formData.mobile,
          role: 'teacher',
          language: 'en',
          theme: 'light',
          active: formData.status === 'active',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          requirePasswordChange: false
        };
        await setDoc(doc(db, 'users', newUid), newUser);
        
        // Create Teacher Doc (using UID as doc ID to match user)
        const newTeacher: Omit<Teacher, 'teacherId'> & { teacherId: string } = {
          teacherId: nextTeacherId, // the visual string ID
          teacherName: formData.teacherName,
          mobile: formData.mobile,
          email: formData.email,
          status: formData.status,
          assignedDonors: [],
          assignedSubjects: [],
          assignedClasses: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        await setDoc(doc(db, 'teachers', newUid), newTeacher);
        
        await auditService.log(user?.uid || 'admin', 'CREATE_TEACHER', 'TEACHERS', { teacherId: nextTeacherId });
        
        setGeneratedPassword(passwordToUse);
        // We don't close modal yet so admin can see the password
        fetchTeachers();
      }
    } catch (err: any) {
      console.error("Error saving teacher", err);
      setError(err.message || 'An error occurred while creating the teacher.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (teacher: Teacher) => {
    

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");

      const response = await fetch('/api/auth/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ uid: teacher.teacherId })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user.');
      }

      await deleteDoc(doc(db, 'teachers', teacher.teacherId));
      
      await auditService.log(user?.uid || 'admin', 'DELETE_TEACHER', 'TEACHERS', { teacherId: teacher.teacherId });
      fetchTeachers();
    } catch (err: any) {
      console.error("Error deleting teacher", err);
      alert(err.message || 'An error occurred while deleting the teacher.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const passwordToUse = resetData.passwordOption === 'auto' ? generateSecurePassword() : resetData.password;
      if (!passwordToUse || passwordToUse.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }

      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");

      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          uid: resetData.teacherId, // The doc ID is the UID
          newPassword: passwordToUse
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password. Please ensure FIREBASE_SERVICE_ACCOUNT is configured in Settings.');
      }

      setGeneratedPassword(passwordToUse);
    } catch (err: any) {
      console.error("Error resetting password", err);
      setError(err.message || 'An error occurred while resetting the password.');
    } finally {
      setSaving(false);
    }
  };

  const filteredTeachers = teachers.filter(t => 
    t.teacherName.toLowerCase().includes(search.toLowerCase()) || 
    t.mobile.includes(search) ||
    t.teacherId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t.teachers}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage your teaching staff
          </p>
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
                  <th className="px-6 py-4 font-medium">ID</th>
                  <th className="px-6 py-4 font-medium">{t.name}</th>
                  <th className="px-6 py-4 font-medium">{t.mobile}</th>
                  <th className="px-6 py-4 font-medium">{t.status}</th>
                  <th className="px-6 py-4 font-medium text-right">{t.action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      <div className="flex justify-center"><div className="w-6 h-6 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div></div>
                    </td>
                  </tr>
                ) : filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      {t.noData}
                    </td>
                  </tr>
                ) : (
                  filteredTeachers.map((teacher) => (
                    <tr key={teacher.teacherId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                        {teacher.teacherId}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        {teacher.teacherName}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {teacher.mobile}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          teacher.status === 'active' 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {teacher.status === 'active' ? t.active : t.inactive}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                           <button 
                            onClick={() => handleOpenResetModal(teacher)}
                            className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors dark:hover:bg-orange-900/30 dark:hover:text-orange-400"
                            title="Reset Password"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleOpenModal(teacher)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors dark:hover:bg-blue-900/30 dark:hover:text-blue-400"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <DeleteButton onConfirm={() => handleDelete(teacher)} />
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

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-xl border-none">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <CardTitle>{editingId ? t.edit : t.add}</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {generatedPassword ? (
                <div className="space-y-6 text-center">
                   <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto">
                     <Check className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                   </div>
                   <div className="space-y-2">
                     <h3 className="text-xl font-bold">Account Created!</h3>
                     <p className="text-sm text-slate-500 dark:text-slate-400">
                       Please share these credentials securely. The user will be required to change their password on first login.
                     </p>
                   </div>
                   
                   <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl space-y-3 text-left">
                     <div>
                       <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Login ID (Mobile)</label>
                       <p className="font-medium">{formData.mobile}</p>
                     </div>
                     <div>
                       <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Temporary Password</label>
                       <div className="flex items-center justify-between">
                         <p className="font-mono font-bold text-lg text-indigo-600 dark:text-indigo-400">{generatedPassword}</p>
                         <button 
                           onClick={() => navigator.clipboard.writeText(generatedPassword)}
                           className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                           title="Copy Password"
                         >
                           <Copy className="w-4 h-4" />
                         </button>
                       </div>
                     </div>
                   </div>

                   <Button className="w-full" onClick={() => setIsModalOpen(false)}>
                     Done
                   </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg dark:bg-red-950/50 dark:text-red-400">
                      {error}
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t.name} <span className="text-red-500">*</span></label>
                    <Input 
                      required 
                      value={formData.teacherName}
                      onChange={e => setFormData({...formData, teacherName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t.mobile} <span className="text-red-500">*</span></label>
                    <Input 
                      required 
                      type="tel"
                      value={formData.mobile}
                      onChange={e => setFormData({...formData, mobile: e.target.value.replace(/\D/g, '')})}
                      placeholder="e.g. 01712345678"
                    />
                    <p className="text-xs text-slate-500">This will be used as the Login ID</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email (Optional)</label>
                    <Input 
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t.status}</label>
                    <select 
                      className="flex h-12 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value as any})}
                    >
                      <option value="active">{t.active}</option>
                      <option value="inactive">{t.inactive}</option>
                    </select>
                  </div>

                  {!editingId && (
                    <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <label className="text-sm font-medium">Password Option</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input 
                            type="radio" 
                            name="passOpt" 
                            checked={formData.passwordOption === 'manual'} 
                            onChange={() => setFormData({...formData, passwordOption: 'manual'})}
                            className="text-indigo-600 focus:ring-indigo-600"
                          />
                          Manual Set
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input 
                            type="radio" 
                            name="passOpt" 
                            checked={formData.passwordOption === 'auto'} 
                            onChange={() => setFormData({...formData, passwordOption: 'auto', password: ''})}
                            className="text-indigo-600 focus:ring-indigo-600"
                          />
                          Auto Generate
                        </label>
                      </div>
                      
                      {formData.passwordOption === 'manual' && (
                        <div className="space-y-1 mt-2">
                          <Input 
                            required 
                            type="text"
                            placeholder="Min 8 chars, 1 upper, 1 lower, 1 num, 1 special"
                            value={formData.password}
                            onChange={e => setFormData({...formData, password: e.target.value})}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-4 flex gap-3 justify-end">
                    <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={saving}>
                      {t.cancel}
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? "Saving..." : t.save}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Password Reset Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-xl border-none">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <CardTitle>Reset Password</CardTitle>
              <CardDescription>
                A temporary password will be created. The user will be required to change it on their next login.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {generatedPassword ? (
                 <div className="space-y-6 text-center">
                   <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto">
                     <Check className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                   </div>
                   <div className="space-y-2">
                     <h3 className="text-xl font-bold">Password Reset Successful!</h3>
                   </div>
                   
                   <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl space-y-3 text-left">
                     <div>
                       <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Temporary Password</label>
                       <div className="flex items-center justify-between">
                         <p className="font-mono font-bold text-lg text-indigo-600 dark:text-indigo-400">{generatedPassword}</p>
                         <button 
                           onClick={() => navigator.clipboard.writeText(generatedPassword)}
                           className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                           title="Copy Password"
                         >
                           <Copy className="w-4 h-4" />
                         </button>
                       </div>
                     </div>
                   </div>

                   <Button className="w-full" onClick={() => setIsResetModalOpen(false)}>
                     Done
                   </Button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  {error && (
                    <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg dark:bg-red-950/50 dark:text-red-400 border border-red-200 dark:border-red-900">
                      {error}
                    </div>
                  )}

                  <div className="space-y-3">
                    <label className="text-sm font-medium">Password Option</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input 
                          type="radio" 
                          name="resetPassOpt" 
                          checked={resetData.passwordOption === 'manual'} 
                          onChange={() => setResetData({...resetData, passwordOption: 'manual'})}
                          className="text-indigo-600 focus:ring-indigo-600"
                        />
                        Manual Set
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input 
                          type="radio" 
                          name="resetPassOpt" 
                          checked={resetData.passwordOption === 'auto'} 
                          onChange={() => setResetData({...resetData, passwordOption: 'auto', password: ''})}
                          className="text-indigo-600 focus:ring-indigo-600"
                        />
                        Auto Generate
                      </label>
                    </div>
                    
                    {resetData.passwordOption === 'manual' && (
                      <div className="space-y-1 mt-2">
                        <Input 
                          required 
                          type="text"
                          placeholder="Min 8 chars, 1 upper, 1 lower, 1 num, 1 special"
                          value={resetData.password}
                          onChange={e => setResetData({...resetData, password: e.target.value})}
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="pt-4 flex gap-3 justify-end">
                    <Button type="button" variant="outline" onClick={() => setIsResetModalOpen(false)} disabled={saving}>
                      {t.cancel}
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? "Resetting..." : "Reset Password"}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
