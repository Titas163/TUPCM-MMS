import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { collection, getDocs, doc, updateDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Mark, Student, ClassData, Subject, Exam, AcademicSession, Teacher } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { CheckCircle, Printer, XCircle, Search } from 'lucide-react';
import { useAppStore } from '../../store';

export function AdminResults() {
  const { t } = useTranslation();
  const { language } = useAppStore();
  
  const [loading, setLoading] = useState(true);
  
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
  const [marksData, setMarksData] = useState<Mark[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const sessionSnap = await getDocs(query(collection(db, 'academicSessions')));
        const sessions = sessionSnap.docs.map(d => ({ ...d.data(), sessionId: d.id } as AcademicSession));
        setSessions(sessions);

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
      .then(snap => setSubjects(snap.docs.map(d => ({ ...d.data(), subjectId: d.id } as Subject))));
      
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
          where('subjectId', '==', selectedSubject),
          where('submitted', '==', true)
        );
        const snap = await getDocs(q);
        
        const marks = snap.docs.map(doc => ({ ...doc.data(), markId: doc.id } as Mark));
        
        setMarksData(marks);
        setIsSubmitted(marks.length > 0);
      } catch (error) {
        console.error("Error fetching marks", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMarks();
  }, [selectedExam, selectedClass, selectedSubject]);

  const handleReturnToDraft = async () => {
    try {
      setLoading(true);
      const promises = marksData.map(mark => 
        updateDoc(doc(db, 'marks', mark.markId), {
          submitted: false,
          draft: true
        })
      );
      
      await Promise.all(promises);
      setMarksData([]); // Clear as they are now drafts
      setIsSubmitted(false);
    } catch (error) {
      console.error("Error returning to draft", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Result Review
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review and approve submitted results
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
            <CardTitle>Submitted Marks</CardTitle>
            <div className="flex gap-2">
              {isSubmitted && (
                <Button variant="outline" size="sm" onClick={handleReturnToDraft} className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-950">
                  <XCircle className="w-4 h-4 mr-2" />
                  Return for Correction
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-slate-500">
                <div className="flex justify-center"><div className="w-6 h-6 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div></div>
              </div>
            ) : marksData.length === 0 ? (
               <div className="p-8 text-center text-slate-500">
                 No submitted results found for this selection. (Teacher may not have submitted yet)
               </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50 dark:text-slate-400">
                    <tr>
                      <th className="px-6 py-4 font-medium">Student Name</th>
                      <th className="px-6 py-4 font-medium">Roll / ID</th>
                      <th className="px-6 py-4 font-medium">Obtained Marks</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {students.filter(std => marksData.some(m => m.studentId === std.studentId)).map((std) => {
                      const mark = marksData.find(m => m.studentId === std.studentId);
                      return (
                        <tr key={std.studentId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                            {std.studentName}
                          </td>
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                            {(std as any).rollNumber || "-"}
                          </td>
                          <td className={`px-6 py-4 font-bold ${
                            (mark?.obtainedMarks || 0) < 33 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {mark?.obtainedMarks}
                          </td>
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                            {(mark?.obtainedMarks || 0) >= 33 ? 'Pass' : 'Fail'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
