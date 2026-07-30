import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Student, ClassData } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DeleteButton } from '../../components/ui/DeleteButton';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Search, Plus, Edit2, Users } from 'lucide-react';

export function Students() {
  const { t } = useTranslation();
  const { language } = useAppStore();
  
  const [students, setStudents] = useState<(Student & { className?: string })[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    studentName: '',
    studentNameBn: '',
    mobile: '',
    classId: '',
    rollNumber: '',
    status: 'active' as 'active' | 'inactive'
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const classSnapshot = await getDocs(query(collection(db, 'classes')));
      const classData = classSnapshot.docs.map(doc => ({ ...doc.data(), classId: doc.id } as ClassData));
      
      // Optionally sort classes by some logic if needed, here just by name or order
      setClasses(classData);

      const q = query(collection(db, 'students'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => {
        const std = { ...doc.data(), studentId: doc.id } as Student;
        const cls = classData.find(c => c.classId === std.classId);
        return { ...std, className: cls?.className || 'Unknown' };
      });
      setStudents(data);
    } catch (error) {
      console.error("Error fetching data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (std?: Student & { className?: string }) => {
    if (std) {
      setEditingId(std.studentId);
      setFormData({
        studentName: std.studentName,
        studentNameBn: (std as any).studentNameBn || '',
        mobile: std.mobile || '',
        classId: std.classId,
        rollNumber: (std as any).rollNumber || '',
        status: std.status
      });
    } else {
      setEditingId(null);
      setFormData({
        studentName: '',
    studentNameBn: '',
        mobile: '',
        classId: selectedClassFilter !== 'all' ? selectedClassFilter : (classes.length > 0 ? classes[0].classId : ''),
        rollNumber: '',
        status: 'active'
      });
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'students', id));
      fetchData();
    } catch (error) {
      console.error("Error deleting student", error);
      alert('An error occurred while deleting the student.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'students', editingId), {
          ...formData,
          updatedAt: Date.now()
        });
      } else {
        const newStudent = {
          ...formData,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        await addDoc(collection(db, 'students'), newStudent);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error saving student", error);
    }
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.studentName.toLowerCase().includes(search.toLowerCase()) || 
                          (s.mobile && s.mobile.includes(search)) || 
                          ((s as any).rollNumber && String((s as any).rollNumber).includes(search));
    const matchesClass = selectedClassFilter === 'all' || s.classId === selectedClassFilter;
    return matchesSearch && matchesClass;
  });

  // Sort students by roll number if available, then by name
  filteredStudents.sort((a, b) => {
    const rollA = parseInt((a as any).rollNumber) || 999999;
    const rollB = parseInt((b as any).rollNumber) || 999999;
    if (rollA !== rollB) return rollA - rollB;
    return a.studentName.localeCompare(b.studentName);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-500" />
            {t.students || 'Students'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage students class-wise</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
          <Plus className="w-4 h-4" />
          {selectedClassFilter !== 'all' 
            ? `Add to ${classes.find(c => c.classId === selectedClassFilter)?.className || 'Class'}` 
            : t.add || 'Add Student'}
        </Button>
      </div>

      <Card className="border-none shadow-md dark:bg-slate-900 overflow-hidden">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 pt-2">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder={t.search || 'Search students...'} 
                className="pl-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            {/* Quick Stats */}
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Total Students: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{filteredStudents.length}</span>
            </div>
          </div>
          
          {/* Class Tabs */}
          <div className="flex overflow-x-auto gap-2 pb-px mt-4" style={{ scrollbarWidth: 'none' }}>
            <button
              className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                selectedClassFilter === 'all' 
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' 
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300'
              }`}
              onClick={() => setSelectedClassFilter('all')}
            >
              All Classes
            </button>
            {classes.map(c => (
              <button
                key={c.classId}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  selectedClassFilter === c.classId 
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' 
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300'
                }`}
                onClick={() => setSelectedClassFilter(c.classId)}
              >
                {language === 'bn' && (c as any).classNameBn ? (c as any).classNameBn : c.className}
              </button>
            ))}
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 dark:bg-slate-800/50 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-semibold">Roll</th>
                  <th className="px-6 py-4 font-semibold">{t.name || 'Name'}</th>
                  <th className="px-6 py-4 font-semibold">{t.mobile || 'Mobile'}</th>
                  {selectedClassFilter === 'all' && (
                    <th className="px-6 py-4 font-semibold">{t.classes || 'Class'}</th>
                  )}
                  <th className="px-6 py-4 font-semibold">{t.status || 'Status'}</th>
                  <th className="px-6 py-4 font-semibold text-right">{t.action || 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex justify-center items-center space-x-2">
                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-slate-500">Loading students...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center">
                        <Users className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
                        <p className="text-lg font-medium text-slate-900 dark:text-slate-100">No students found</p>
                        <p className="text-sm mt-1">
                          {selectedClassFilter !== 'all' 
                            ? `No students registered in ${classes.find(c => c.classId === selectedClassFilter)?.className}.`
                            : 'Try adjusting your search or add a new student.'}
                        </p>
                        <Button 
                          onClick={() => handleOpenModal()} 
                          variant="outline" 
                          className="mt-4 gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Add Student Here
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((std) => (
                    <tr key={std.studentId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors group">
                      <td className="px-6 py-3 font-medium text-slate-500">
                        {(std as any).rollNumber || '-'}
                      </td>
                      <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">
                        {std.studentName} {(std as any).studentNameBn ? `(${ (std as any).studentNameBn })` : ""}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                        {std.mobile || '-'}
                      </td>
                      {selectedClassFilter === 'all' && (
                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                          <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-medium">
                            {std.className}
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                          std.status === 'active' 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {std.status === 'active' ? t.active || 'Active' : t.inactive || 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenModal(std)} title="Edit" className="h-8 w-8 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 hover:text-indigo-600 dark:hover:text-indigo-400">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <div className="scale-90">
                            <DeleteButton onConfirm={() => handleDelete(std.studentId)} />
                          </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-2xl border-none animate-in fade-in zoom-in-95 duration-200">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-t-xl">
              <CardTitle className="text-xl">{editingId ? 'Edit Student' : 'Add New Student'}</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {t.name || 'Student Name'} <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input 
                      required 
                      value={formData.studentName}
                      onChange={e => setFormData({...formData, studentName: e.target.value})}
                      placeholder="English Name"
                      className="bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900"
                    />
                    <Input 
                      value={formData.studentNameBn}
                      onChange={e => setFormData({...formData, studentNameBn: e.target.value})}
                      placeholder="বাংলা নাম"
                      className="bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Roll Number
                    </label>
                    <Input 
                      value={formData.rollNumber}
                      onChange={e => setFormData({...formData, rollNumber: e.target.value})}
                      placeholder="e.g. 01"
                      className="bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {t.mobile || 'Mobile'}
                    </label>
                    <Input 
                      value={formData.mobile}
                      onChange={e => setFormData({...formData, mobile: e.target.value})}
                      placeholder="Parent's number"
                      className="bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {t.classes || 'Class'} <span className="text-red-500">*</span>
                  </label>
                  <Select 
                    required 
                    value={formData.classId}
                    onChange={e => setFormData({...formData, classId: e.target.value})}
                    className="bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900"
                  >
                    <option value="" disabled>Select Class</option>
                    {classes.map(c => (
                      <option key={c.classId} value={c.classId}>{language === 'bn' && (c as any).classNameBn ? (c as any).classNameBn : c.className}</option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {t.status || 'Status'}
                  </label>
                  <Select 
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value as any})}
                    className="bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900"
                  >
                    <option value="active">{t.active || 'Active'}</option>
                    <option value="inactive">{t.inactive || 'Inactive'}</option>
                  </Select>
                </div>

                <div className="pt-6 flex gap-3 justify-end">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto">
                    {t.cancel || 'Cancel'}
                  </Button>
                  <Button type="submit" className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white">
                    {t.save || 'Save'}
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
