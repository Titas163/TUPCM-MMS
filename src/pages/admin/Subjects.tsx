import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { toBnNum } from '../../lib/utils';
import { useAppStore } from '../../store';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Subject, ClassData, Teacher } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { DeleteButton } from '../../components/ui/DeleteButton';
import { Search, Plus, Edit2, BookOpen } from 'lucide-react';

export function Subjects() {
  const { t } = useTranslation();
  const { language } = useAppStore();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    subjectName: '',
    subjectNameBn: '',
    classId: '',
    assignedTeacher: '',
    status: 'active'
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [classSnapshot, teacherSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'classes'))),
        getDocs(query(collection(db, 'teachers')))
      ]);
      const teacherData = teacherSnapshot.docs.map(doc => ({ ...doc.data(), teacherId: doc.id } as Teacher));
      setTeachers(teacherData);
      const classData = classSnapshot.docs.map(doc => ({ ...doc.data(), classId: doc.id } as ClassData));
      setClasses(classData);

      const q = query(collection(db, 'subjects'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => {
        const sub = { ...doc.data(), subjectId: doc.id } as Subject;
        const cls = classData.find(c => c.classId === sub.classId);
        const teacher = teacherData.find(t => t.teacherId === sub.assignedTeacher);
        return { ...sub, className: cls?.className || 'Unknown', teacherName: teacher?.teacherName || 'Unassigned' };
      });
      setSubjects(data);
    } catch (error) {
      console.error("Error fetching data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (sub?: Subject, defaultClassId?: string) => {
    if (sub) {
      setEditingId(sub.subjectId);
      setFormData({
        subjectName: sub.subjectName,
        subjectNameBn: (sub as any).subjectNameBn || '',
        classId: sub.classId,
        assignedTeacher: sub.assignedTeacher || '',
        status: sub.status
      });
    } else {
      setEditingId(null);
      setFormData({
        subjectName: '',
    subjectNameBn: '',
        classId: defaultClassId || (classes.length > 0 ? classes[0].classId : ''),
        assignedTeacher: '',
        status: 'active'
      });
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'subjects', id));
      fetchData();
    } catch (error) {
      console.error("Error deleting subject", error);
      alert('An error occurred while deleting the subject.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'subjects', editingId), formData);
      } else {
        await addDoc(collection(db, 'subjects'), formData);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error saving subject", error);
    }
  };

  const filteredClasses = classes.filter(cls => {
    const classMatches = cls.className.toLowerCase().includes(search.toLowerCase());
    const hasMatchingSubject = subjects.some(s => s.classId === cls.classId && s.subjectName.toLowerCase().includes(search.toLowerCase()));
    return classMatches || hasMatchingSubject;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t.subjects}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage subjects grouped by classes</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="gap-2">
          <Plus className="w-4 h-4" />
          {t.add} Subject
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input 
          placeholder={t.search} 
          className="pl-9 bg-white dark:bg-slate-900"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div>
        </div>
      ) : filteredClasses.length === 0 ? (
        <Card className="border-none shadow-md bg-white dark:bg-slate-900">
          <CardContent className="py-12 text-center text-slate-500">
            {t.noData || "No classes or subjects found."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {filteredClasses.map(cls => {
            const classSubjects = subjects.filter(s => s.classId === cls.classId && (search === '' || s.subjectName.toLowerCase().includes(search.toLowerCase())));
            
            return (
              <Card key={cls.classId} className="border-none shadow-md bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 py-4 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{language === 'bn' && (cls as any).classNameBn ? (cls as any).classNameBn : cls.className}</CardTitle>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{toBnNum(classSubjects.length, language)} Subjects</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleOpenModal(undefined, cls.classId)} className="h-8 gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </Button>
                </CardHeader>
                <CardContent className="p-0 flex-1">
                  {classSubjects.length === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-500">
                      No subjects added yet.
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                      {classSubjects.map(sub => (
                        <li key={sub.subjectId} className="flex items-center justify-between p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-3">
                              <span className={`w-2 h-2 rounded-full ${sub.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} title={sub.status}></span>
                              <span className="font-medium text-slate-900 dark:text-white">{language === 'bn' && (sub as any).subjectNameBn ? (sub as any).subjectNameBn : sub.subjectName}</span>
                            </div>
                            <span className="text-xs text-slate-500 ml-5 mt-1">Teacher: {(sub as any).teacherName || 'Unassigned'}</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenModal(sub)} title="Edit">
                              <Edit2 className="w-4 h-4 text-slate-400 hover:text-indigo-600" />
                            </Button>
                            <DeleteButton onConfirm={() => handleDelete(sub.subjectId)} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
                  <div className="grid grid-cols-2 gap-2">
                    <Input 
                      required 
                      value={formData.subjectName}
                      onChange={e => setFormData({...formData, subjectName: e.target.value})}
                      placeholder="English"
                    />
                    <Input 
                      value={formData.subjectNameBn}
                      onChange={e => setFormData({...formData, subjectNameBn: e.target.value})}
                      placeholder="বাংলা"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t.classes}</label>
                  <Select 
                    required 
                    value={formData.classId}
                    onChange={e => setFormData({...formData, classId: e.target.value})}
                  >
                    {classes.map(c => (
                      <option key={c.classId} value={c.classId}>{language === 'bn' && (c as any).classNameBn ? (c as any).classNameBn : c.className}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t.teachers || 'Assigned Teacher'}</label>
                  <Select 
                    value={formData.assignedTeacher}
                    onChange={e => setFormData({...formData, assignedTeacher: e.target.value})}
                  >
                    <option value="">-- Unassigned --</option>
                    {teachers.map(t => (
                      <option key={t.teacherId} value={t.teacherId}>{t.teacherName}</option>
                    ))}
                  </Select>
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
