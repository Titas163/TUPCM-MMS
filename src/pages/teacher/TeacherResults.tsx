import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { collection, getDocs, doc, setDoc, query, where, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Mark, Student, ClassData, Subject, Exam, AcademicSession, Teacher } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Save, Send } from 'lucide-react';
import { useAppStore } from '../../store';
import { generateId } from '../../lib/utils';

export function TeacherResults() {
  const { t } = useTranslation();
  const { user, language } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [teacherId, setTeacherId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  
  // Lookups
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  
  // Form Selections
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  // Marks data
  const [marksData, setMarksData] = useState<{ [studentId: string]: Mark }>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!user) return;
      try {
        const teacherSnapshot = await getDocs(query(collection(db, 'teachers'), where('email', '==', user.email)));
        let tId = '';
        if (!teacherSnapshot.empty) {
          tId = teacherSnapshot.docs[0].id;
          setTeacherId(tId);
        }
        const sessionSnap = await getDocs(query(collection(db, 'academicSessions')));
        const sessions = sessionSnap.docs.map(d => ({ ...d.data(), sessionId: d.id } as AcademicSession));
        setSessions(sessions);
        if (sessions.length > 0) setSelectedSession(sessions.find(s => s.isDefault)?.sessionId || sessions[0].sessionId);

        const classSnap = await getDocs(query(collection(db, 'classes')));
        setClasses(classSnap.docs.map(d => ({ ...d.data(), classId: d.id } as ClassData)));
        
        setLoading(false);
      } catch (error) {
        console.error("Error fetching init data", error);
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  // Update exams when session changes
  useEffect(() => {
    if (!selectedSession) return;
    getDocs(query(collection(db, 'exams'), where('sessionId', '==', selectedSession)))
      .then(snap => setExams(snap.docs.map(d => ({ ...d.data(), examId: d.id } as Exam))));
  }, [selectedSession]);

  // Update subjects when class changes
  useEffect(() => {
    if (!selectedClass) return;
    getDocs(query(collection(db, 'subjects'), where('classId', '==', selectedClass)))
      .then(snap => {
        const allSubs = snap.docs.map(d => ({ ...d.data(), subjectId: d.id } as Subject));
        setSubjects(allSubs.filter(s => s.assignedTeacher === teacherId));
      });
      
    // Fetch students
    getDocs(query(collection(db, 'students'), where('classId', '==', selectedClass)))
      .then(snap => setStudents(snap.docs.map(d => ({ ...d.data(), studentId: d.id } as Student))));
  }, [selectedClass]);

  // Fetch marks when all selections are made
  useEffect(() => {
    if (!selectedSession || !selectedExam || !selectedClass || !selectedSubject) return;
    
    const fetchMarks = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'marks'), 
          where('examId', '==', selectedExam),
          where('classId', '==', selectedClass),
          where('subjectId', '==', selectedSubject)
        );
        const snap = await getDocs(q);
        
        const marksObj: { [studentId: string]: Mark } = {};
        let submitted = false;
        
        snap.docs.forEach(doc => {
          const m = { ...doc.data(), markId: doc.id } as Mark;
          marksObj[m.studentId] = m;
          if (m.submitted) submitted = true;
        });
        
        setMarksData(marksObj);
        setIsSubmitted(submitted);
      } catch (error) {
        console.error("Error fetching marks", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMarks();
  }, [selectedExam, selectedClass, selectedSubject]);

  const handleMarkChange = (studentId: string, value: string) => {
    const numValue = Number(value);
    if (isNaN(numValue) || numValue < 0 || numValue > 100) return;

    setMarksData(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {
          markId: generateId(),
          studentId,
          classId: selectedClass,
          subjectId: selectedSubject,
          examId: selectedExam,
          teacherId: user?.uid || '',
          draft: true,
          submitted: false,
          createdAt: Date.now()
        }),
        obtainedMarks: numValue,
        updatedAt: Date.now()
      }
    }));
  };

  const handleSave = async (isFinalSubmit: boolean) => {
    if (!user) return;
    setSaving(true);
    try {
      // Find teacher ID
      const teacherSnapshot = await getDocs(query(collection(db, 'teachers'), where('email', '==', user.email)));
      let teacherId = user.uid;
      if (!teacherSnapshot.empty) {
        teacherId = teacherSnapshot.docs[0].id;
      }

      // Batch save would be better, using simple loop for now
      const promises = Object.keys(marksData).map(studentId => {
        const mark = marksData[studentId];
        const m = { ...mark, teacherId, draft: !isFinalSubmit, submitted: isFinalSubmit };
        return setDoc(doc(db, 'marks', m.markId), m);
      });
      
      await Promise.all(promises);
      
      if (isFinalSubmit) setIsSubmitted(true);
    } catch (error) {
      console.error("Error saving marks", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Result Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Enter marks for your assigned subjects
          </p>
        </div>
      </div>

      <Card className="border-none shadow-md dark:bg-slate-900">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Session</label>
              <Select value={selectedSession} onChange={e => setSelectedSession(e.target.value)}>
                <option value="" disabled>Select Session</option>
                {sessions.map(s => <option key={s.sessionId} value={s.sessionId}>{s.sessionName}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Exam</label>
              <Select value={selectedExam} onChange={e => setSelectedExam(e.target.value)} disabled={!selectedSession}>
                <option value="" disabled>Select Exam</option>
                {exams.map(e => <option key={e.examId} value={e.examId}>{e.examName}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Class</label>
              <Select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                <option value="" disabled>Select Class</option>
                {classes.map(c => <option key={c.classId} value={c.classId}>{language === 'bn' && (c as any).classNameBn ? (c as any).classNameBn : c.className}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Subject</label>
              <Select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} disabled={!selectedClass}>
                <option value="" disabled>Select Subject</option>
                {subjects.map(s => <option key={s.subjectId} value={s.subjectId}>{language === 'bn' && (s as any).subjectNameBn ? (s as any).subjectNameBn : s.subjectName}</option>)}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedExam && selectedClass && selectedSubject && (
        <Card className="border-none shadow-md dark:bg-slate-900">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4 flex flex-row items-center justify-between">
            <CardTitle>Students Marks</CardTitle>
            {isSubmitted && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                Final Submitted
              </span>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-slate-500">
                <div className="flex justify-center"><div className="w-6 h-6 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div></div>
              </div>
            ) : students.length === 0 ? (
               <div className="p-8 text-center text-slate-500">No students found in this class.</div>
            ) : (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50 dark:text-slate-400">
                      <tr>
                        <th className="px-6 py-4 font-medium">Student Name</th>
                        <th className="px-6 py-4 font-medium">Roll / ID</th>
                        <th className="px-6 py-4 font-medium w-48">Obtained Marks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {students.map((std) => (
                        <tr key={std.studentId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                            {std.studentName}
                          </td>
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                            {(std as any).rollNumber || "-"}
                          </td>
                          <td className="px-6 py-4">
                            <Input 
                              type="number" 
                              min="0" 
                              max="100" 
                              value={marksData[std.studentId]?.obtainedMarks ?? ''}
                              onChange={(e) => handleMarkChange(std.studentId, e.target.value)}
                              disabled={isSubmitted || saving}
                              className={`w-32 font-medium ${
                                marksData[std.studentId]?.obtainedMarks < 33 ? 'text-red-600 dark:text-red-400 focus-visible:ring-red-500' : ''
                              }`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {!isSubmitted && (
                  <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex gap-4 justify-end">
                    <Button variant="outline" onClick={() => handleSave(false)} disabled={saving} className="gap-2">
                      <Save className="w-4 h-4" />
                      Save Draft
                    </Button>
                    <Button onClick={() => handleSave(true)} disabled={saving} className="gap-2">
                      <Send className="w-4 h-4" />
                      Final Submit
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
