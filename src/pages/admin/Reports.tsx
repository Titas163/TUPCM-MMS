import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { useAppStore } from '../../store';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Printer, FileText, Download, Wallet } from 'lucide-react';
import { AcademicSession, ClassData, Exam, Subject, Student, Mark, Donor, DonationCollection, Teacher } from '../../types';
import { calculateDonorSummary } from '../../lib/donationUtils';
import { format } from 'date-fns';
import { toBnNum } from '../../lib/utils';

export function Reports() {
  const { settings, language } = useAppStore();
  const [reportLang, setReportLang] = useState<'en'|'bn'>(language || 'bn');
  const { t } = useTranslation();
  
  const [activeTab, setActiveTab] = useState<'results' | 'financial'>('results');

  // For Results
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [reportData, setReportData] = useState<any>(null);

  // For Financial
  const [transactions, setTransactions] = useState<any[]>([]);
  const [finMonth, setFinMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [finReportData, setFinReportData] = useState<any>(null);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchInitData = async () => {
      try {
        const [sessSnap, clsSnap] = await Promise.all([
          getDocs(query(collection(db, 'academicSessions'))),
          getDocs(query(collection(db, 'classes')))
        ]);
        setSessions(sessSnap.docs.map(d => ({ ...d.data(), sessionId: d.id } as AcademicSession)));
        setClasses(clsSnap.docs.map(d => ({ ...d.data(), classId: d.id } as ClassData)));
      } catch (error) {
        console.error("Error fetching init data", error);
      }
    };
    fetchInitData();
  }, []);

  useEffect(() => {
    const fetchExams = async () => {
      if (!selectedSession) {
        setExams([]);
        return;
      }
      try {
        const exSnap = await getDocs(query(collection(db, 'exams'), where('sessionId', '==', selectedSession)));
        setExams(exSnap.docs.map(d => ({ ...d.data(), examId: d.id } as Exam)));
      } catch (error) {
        console.error("Error fetching exams", error);
      }
    };
    fetchExams();
  }, [selectedSession]);

  const generateResultReport = async () => {
    if (!selectedSession || !selectedExam) return;
    
    setLoading(true);
    try {
      let subjectsQuery = query(collection(db, 'subjects'));
      let studentsQuery = query(collection(db, 'students'), where('status', '==', 'active'));
      let marksQuery = query(collection(db, 'marks'), where('examId', '==', selectedExam));

      const [subSnap, stuSnap, markSnap] = await Promise.all([
        getDocs(subjectsQuery),
        getDocs(studentsQuery),
        getDocs(marksQuery)
      ]);

      const subjects = subSnap.docs.map(d => ({ ...d.data(), subjectId: d.id } as Subject));
      const students = stuSnap.docs.map(d => ({ ...d.data(), studentId: d.id } as Student));
      const marks = markSnap.docs.map(d => ({ ...d.data(), markId: d.id } as Mark));

      const classesToProcess = selectedClass === 'all' ? classes : classes.filter(c => c.classId === selectedClass);
      
      const processedClasses = classesToProcess.map(cls => {
        const classSubjects = subjects.filter(s => s.classId === cls.classId);
        const classStudents = students.filter(s => s.classId === cls.classId);
        const classMarks = marks.filter(m => m.classId === cls.classId);

        const studentResults = classStudents.map(student => {
          const studentMarks = classSubjects.map(sub => {
            const markObj = classMarks.find(m => m.studentId === student.studentId && m.subjectId === sub.subjectId);
            const obtained = markObj ? Number(markObj.obtainedMarks) || 0 : 0;
            return { subjectId: sub.subjectId, obtained, ...getGrade(obtained) };
          });

          const totalMarks = studentMarks.reduce((sum, m) => sum + m.obtained, 0);
          const isFailed = studentMarks.some(m => m.grade === 'F');
          
          let totalGpa = 0;
          let finalGrade = 'F';
          
          if (!isFailed && studentMarks.length > 0) {
            totalGpa = studentMarks.reduce((sum, m) => sum + m.gpa, 0) / studentMarks.length;
            finalGrade = getFinalGradeFromGpa(totalGpa);
          }

          const marksMap: Record<string, number> = {};
          studentMarks.forEach(m => { marksMap[m.subjectId] = m.obtained; });
          return {
            studentId: student.studentId,
            studentName: student.studentName,
            studentNameBn: (student as any).studentNameBn,
            rollNumber: student.rollNumber || '-',
            marks: marksMap,
            totalMarks,
            gpa: isFailed ? 0 : Number(totalGpa.toFixed(2)),
            grade: isFailed ? 'F' : finalGrade
          };
        });

        studentResults.sort((a, b) => {
          if (a.gpa !== b.gpa) return b.gpa - a.gpa;
          return b.totalMarks - a.totalMarks;
        });

        return {
          classInfo: cls,
          subjects: classSubjects,
          results: studentResults.map((r, i) => ({ ...r, rank: i + 1 }))
        };
      });

      const sessionInfo = sessions.find(s => s.sessionId === selectedSession);
      const examInfo = exams.find(e => e.examId === selectedExam);

      setReportData({
        sessionInfo,
        examInfo,
        classes: processedClasses
      });
      setFinReportData(null);
    } catch (error) {
      console.error("Error generating report", error);
    } finally {
      setLoading(false);
    }
  };

  
  const generateFinancialReport = async () => {
    if (!finMonth) return;
    setLoading(true);
    try {
      const [year, month] = finMonth.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1).getTime();
      const endDate = new Date(year, month, 1).getTime() - 1;
      
      const [donorsSnap, teachersSnap, colSnap] = await Promise.all([
        getDocs(query(collection(db, 'donors'))),
        getDocs(query(collection(db, 'teachers'))),
        getDocs(query(collection(db, 'donationCollections'), where('status', '==', 'Approved')))
      ]);
      
      const donors = donorsSnap.docs.map(d => ({ ...d.data(), donorId: d.id } as Donor));
      const teachers = teachersSnap.docs.map(t => ({ ...t.data(), teacherId: t.id } as Teacher));
      const cols = colSnap.docs.map(c => ({ ...c.data(), collectionId: c.id } as DonationCollection)).filter(c => !c.isDeleted);
      
      // Calculate current month cash collection (based on paymentDate)
      const currentMonthCols = cols.filter(c => c.paymentDate >= startDate && c.paymentDate <= endDate);
      const currentMonthCash = currentMonthCols.reduce((sum, c) => sum + c.paymentAmount, 0);
      
      let dueAmount = 0;
      let advanceAmount = 0;
      let partialAmount = 0;
      
      const teacherStats: Record<string, number> = {};
      const donorStats: Record<string, { collected: number, due: number, status: string }> = {};
      
      donors.forEach(donor => {
        const dCols = cols.filter(c => c.donorId === donor.donorId);
        const summary = calculateDonorSummary(donor, dCols);
        
        dueAmount += summary.totalDue;
        advanceAmount += summary.totalAdvance;
        if (summary.status === 'Partial') {
            partialAmount += summary.totalDue; 
        }
        
        // Let's just track this month's collection
        const colThisMonth = currentMonthCols.filter(c => c.donorId === donor.donorId).reduce((s,c)=>s+c.paymentAmount,0);
        
        donorStats[donor.donorName] = {
          collected: colThisMonth,
          due: summary.totalDue,
          status: summary.status
        };
      });
      
      currentMonthCols.forEach(c => {
        const tName = teachers.find(t => t.teacherId === c.teacherId)?.teacherName || 'Unknown';
        teacherStats[tName] = (teacherStats[tName] || 0) + c.paymentAmount;
      });
      
      setFinReportData({
        month: finMonth,
        currentMonthCash,
        dueAmount,
        advanceAmount,
        partialAmount,
        teacherStats,
        donorStats
      });
      
      setReportData(null);
    } catch (error) {
      console.error("Error fetching financial data", error);
    } finally {
      setLoading(false);
    }
  };


  const handlePrint = () => {
    window.print();
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return;
    
    // Get headers
    const headers = Object.keys(data[0]);
    
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          let cell = row[header] === null || row[header] === undefined ? '' : row[header];
          cell = String(cell).replace(/"/g, '""');
          return '"' + cell + '"';
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename + '.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportResultCSV = () => {
    if (!reportData) return;
    
    let allData: any[] = [];
    reportData.classes.forEach((clsData: any) => {
      clsData.results.forEach((res: any) => {
        const rowData: any = {
          'Class Name': clsData.classInfo.className,
          'Roll Number': res.rollNumber || res.rank,
          'Student Name': res.studentName,
          'Total Marks': res.totalMarks,
          'GPA': res.gpa.toFixed(2),
          'Grade': res.grade,
          'Rank': res.rank
        };
        
        clsData.subjects.forEach((sub: any) => {
          const m = res.marks.find((mark: any) => mark.subjectId === sub.subjectId);
          rowData[sub.subjectName] = m ? m.obtained : 0;
        });
        
        allData.push(rowData);
      });
    });

    exportToCSV(allData, 'Results_Report_' + (reportData.sessionInfo?.sessionName || ''));
  };

  
  const handleExportFinCSV = () => {
    if (!finReportData) return;
    
    const formattedData = Object.entries(finReportData.donorStats).map(([name, stat]: [string, any]) => ({
      'Donor Name': name,
      'Current Month Collected': stat.collected,
      'Due Amount': stat.due,
      'Status': stat.status
    }));
    
    exportToCSV(formattedData, 'Donation_Report_' + finReportData.month);
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {t.reports || 'Reports & Results'}
        </h1>
        <div className="flex gap-2">
          {(reportData || finReportData) && (
            <div className="flex items-center gap-2">
              <select 
                value={reportLang}
                onChange={e => setReportLang(e.target.value as 'en'|'bn')}
                className="h-10 px-3 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="bn">বাংলা (Bengali)</option>
                <option value="en">English</option>
              </select>
              <Button onClick={handlePrint} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                <Printer className="w-4 h-4" />
                Print / Save PDF
              </Button>
            </div>
          )}
          {reportData && (
            <Button onClick={handleExportResultCSV} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Export Results CSV
            </Button>
          )}
          {finReportData && (
            <Button onClick={handleExportFinCSV} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Export Financial CSV
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-px print:hidden">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'results' 
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
          onClick={() => { setActiveTab('results'); setFinReportData(null); }}
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Result Reports
          </div>
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'financial' 
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
          onClick={() => { setActiveTab('financial'); setReportData(null); }}
        >
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            Financial Reports
          </div>
        </button>
      </div>

      <Card className="border-none shadow-md dark:bg-slate-900 print:hidden">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <CardTitle className="flex items-center gap-2">
            {activeTab === 'results' ? <FileText className="w-5 h-5 text-indigo-500" /> : <Wallet className="w-5 h-5 text-indigo-500" />}
            {activeTab === 'results' ? 'Generate Result Report' : 'Generate Financial Report'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {activeTab === 'results' ? (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
              <div className="space-y-2">
                <label className="text-sm font-medium">Session</label>
                <Select value={selectedSession} onChange={e => { setSelectedSession(e.target.value); setSelectedExam(''); }}>
                  <option value="">Select Session</option>
                  {sessions.map(s => <option key={s.sessionId} value={s.sessionId}>{s.sessionName}</option>)}
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Exam</label>
                <Select value={selectedExam} onChange={e => setSelectedExam(e.target.value)} disabled={!selectedSession}>
                  <option value="">Select Exam</option>
                  {exams.map(e => <option key={e.examId} value={e.examId}>{e.examName}</option>)}
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Class</label>
                <Select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                  <option value="all">All Classes</option>
                  {classes.map(c => <option key={c.classId} value={c.classId}>{c.className}</option>)}
                </Select>
              </div>
              <Button onClick={generateResultReport} disabled={!selectedSession || !selectedExam || loading} className="w-full">
                {loading ? 'Generating...' : 'Generate Result'}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
              <div className="space-y-2">
                <label className="text-sm font-medium">Month</label>
                <input 
                  type="month" 
                  value={finMonth}
                  onChange={(e) => setFinMonth(e.target.value)}
                  className="w-full h-10 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <Button onClick={generateFinancialReport} disabled={!finMonth || loading} className="w-full">
                {loading ? 'Generating...' : 'Generate Report'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Printable Result Report */}
      {activeTab === 'results' && reportData && (
        <div className="print-area ">
          {reportData.classes.map((clsData: any, idx: number) => {
            if (clsData.subjects.length === 0 || clsData.results.length === 0) return null;
            
            return (
              <div key={clsData.classInfo.classId} className={"bg-white text-black p-8 print:p-0 shadow-sm print:shadow-none border border-slate-200 print:border-none " + (idx > 0 ? "print:break-before-page mb-8" : "mb-8")}>
                {/* Standard Header */}
                <div className="text-center mb-6 border-b-2 border-black pb-4">
                  <div className="flex justify-center items-center gap-3 mb-2">
                    {settings?.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="w-12 h-12 object-contain" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border-2 border-black">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                      </div>
                    )}
                    <h1 className="text-3xl font-bold">{reportLang === "bn" ? (settings?.madrasaNameBn || settings?.madrasaName || "মাদ্রাসাতুল মদিনা") : (settings?.madrasaName || "Madrasatul Madina")}</h1>
                  </div>
                  <p className="text-sm mb-1">{reportLang === "bn" ? (settings?.addressBn || settings?.address || "ঢাকা, বাংলাদেশ") : (settings?.address || "Dhaka, Bangladesh")}</p>
                  {(settings?.phone || settings?.email) && (
                    <p className="text-xs mb-3">{settings?.phone} {settings?.phone && settings?.email ? '|' : ''} {settings?.email}</p>
                  )}
                  
                  <h2 className="text-xl font-semibold bg-gray-200 inline-block px-6 py-1 rounded-full border border-gray-400">
                    {reportLang === "en" ? "Result Report" : "ফলাফল বিবরণী"}
                  </h2>
                  
                  <div className="flex justify-between items-end mt-6 font-medium text-sm">
                    <div className="text-left">
                      <p><strong>{reportLang === "en" ? "Class:" : "শ্রেণী:"}</strong> {reportLang === "bn" ? (clsData.classInfo.classNameBn || clsData.classInfo.className) : clsData.classInfo.className}</p>
                    </div>
                    <div className="text-center">
                      <p><strong>{reportLang === "en" ? "Exam:" : "পরীক্ষা:"}</strong> {reportLang === "bn" ? (reportData.examInfo.examNameBn || reportData.examInfo.examName) : reportData.examInfo.examName}</p>
                    </div>
                    <div className="text-right">
                      <p><strong>{reportLang === "en" ? "Session:" : "শিক্ষাবর্ষ:"}</strong> {toBnNum(reportLang === "bn" ? (reportData.sessionInfo.sessionNameBn || reportData.sessionInfo.sessionName) : reportData.sessionInfo.sessionName, reportLang)}</p>
                    </div>
                  </div>
                </div>
                
                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-center border-collapse border border-black text-xs md:text-sm print:text-[11px]">
                    <thead>
                      <tr className="bg-gray-100 print:bg-transparent">
                        <th className="border border-black p-1 w-12">{reportLang === "en" ? "Roll" : "রোল"}</th>
                        <th className="border border-black p-1 text-left px-2">{reportLang === "en" ? "Student Name" : "শিক্ষার্থীর নাম"}</th>
                        {clsData.subjects.map((s: any) => (
                          <th key={s.subjectId} className="border border-black p-1 min-w-[40px] max-w-[80px] break-words">
                            {reportLang === "bn" ? (s.subjectNameBn || s.subjectName) : s.subjectName}
                          </th>
                        ))}
                        <th className="border border-black p-1">{reportLang === "en" ? "Total Marks" : "মোট নম্বর"}</th>
                        <th className="border border-black p-1">{reportLang === "en" ? "GPA" : "জিপিএ"}</th>
                        <th className="border border-black p-1">{reportLang === "en" ? "Grade" : "গ্রেড"}</th>
                        <th className="border border-black p-1">{reportLang === "en" ? "Rank" : "মেধা স্থান"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clsData.results.map((res: any) => (
                        <tr key={res.studentId}>
                          <td className="border border-black p-1">{toBnNum(res.rollNumber, reportLang)}</td>
                          <td className="border border-black p-1 text-left px-2">{(reportLang === "bn" ? (res.studentNameBn || res.studentName) : res.studentName)}</td>
                          {clsData.subjects.map((s: any) => {
                            const mark = res.marks[s.subjectId];
                            return (
                              <td key={s.subjectId} className={"border border-black p-1 " + (mark && mark < 33 ? 'text-red-600 print:text-black font-bold' : '')}>
                                {mark !== undefined ? toBnNum(mark, reportLang) : "-"}
                              </td>
                            );
                          })}
                          <td className="border border-black p-1 font-bold">{toBnNum(res.totalMarks, reportLang)}</td>
                          <td className="border border-black p-1 font-bold">{toBnNum(res.gpa.toFixed(2), reportLang)}</td>
                          <td className={"border border-black p-1 font-bold " + (res.grade === 'F' ? 'text-red-600 print:text-black' : '')}>
                            {res.grade}
                          </td>
                          <td className="border border-black p-1 font-bold">{toBnNum(res.rank, reportLang)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Footer Signatures */}
                <div className="mt-12 flex justify-between px-8 text-sm break-inside-avoid">
                  <div className="text-center">
                    <div className="border-t border-black w-32 mx-auto pt-1">{reportLang === "en" ? "Class Teacher" : "শ্রেণী শিক্ষক"}</div>
                  </div>
                  <div className="text-center">
                    <div className="border-t border-black w-32 mx-auto pt-1">{reportLang === "en" ? "Principal" : "অধ্যক্ষ"}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Printable Financial Report */}
      {activeTab === 'financial' && finReportData && (
        <div className="print-area ">
          <div className="bg-white text-black p-8 print:p-0 shadow-sm print:shadow-none border border-slate-200 print:border-none">
            {/* Standard Header */}
            <div className="text-center mb-6 border-b-2 border-black pb-4">
              <div className="flex justify-center items-center gap-3 mb-2">
                {settings?.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className="w-12 h-12 object-contain" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border-2 border-black">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                  </div>
                )}
                <h1 className="text-3xl font-bold">{reportLang === "bn" ? (settings?.madrasaNameBn || settings?.madrasaName || "মাদ্রাসাতুল মদিনা") : (settings?.madrasaName || "Madrasatul Madina")}</h1>
              </div>
              <p className="text-sm mb-1">{reportLang === "bn" ? (settings?.addressBn || settings?.address || "ঢাকা, বাংলাদেশ") : (settings?.address || "Dhaka, Bangladesh")}</p>
              {(settings?.phone || settings?.email) && (
                <p className="text-xs mb-3">{settings?.phone} {settings?.phone && settings?.email ? '|' : ''} {settings?.email}</p>
              )}
              
              <h2 className="text-xl font-semibold bg-gray-200 inline-block px-6 py-1 rounded-full border border-gray-400">
                {reportLang === "en" ? "Donation Report" : "চাঁদা রিপোর্ট"}
              </h2>
              
              <div className="mt-4 font-medium text-sm text-center">
                <p><strong>{reportLang === "en" ? "Month:" : "মাস:"}</strong> {new Intl.DateTimeFormat(reportLang === 'bn' ? 'bn-BD' : 'en-US', { month: 'long', year: 'numeric' }).format(new Date(finReportData.month + '-01'))}</p>
              </div>
            </div>
            
            {/* Summary Cards for Print */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="border border-black p-3 text-center rounded-lg bg-emerald-50 print:bg-transparent">
                <p className="text-sm font-medium">{reportLang === "en" ? "Cash Collection" : "নগদ আদায়"}</p>
                <p className="text-xl font-bold text-emerald-700 print:text-black mt-1">৳ {toBnNum(finReportData.currentMonthCash.toLocaleString(), reportLang)}</p>
              </div>
              <div className="border border-black p-3 text-center rounded-lg bg-red-50 print:bg-transparent">
                <p className="text-sm font-medium">{reportLang === "en" ? "Due Amount" : "বকেয়া"}</p>
                <p className="text-xl font-bold text-red-700 print:text-black mt-1">৳ {toBnNum(finReportData.dueAmount.toLocaleString(), reportLang)}</p>
              </div>
              <div className="border border-black p-3 text-center rounded-lg bg-amber-50 print:bg-transparent">
                <p className="text-sm font-medium">{reportLang === "en" ? "Partial Due" : "আংশিক বকেয়া"}</p>
                <p className="text-xl font-bold text-amber-700 print:text-black mt-1">৳ {toBnNum(finReportData.partialAmount.toLocaleString(), reportLang)}</p>
              </div>
              <div className="border border-black p-3 text-center rounded-lg bg-indigo-50 print:bg-transparent">
                <p className="text-sm font-medium">{reportLang === "en" ? "Advance Paid" : "অগ্রিম প্রদান"}</p>
                <p className="text-xl font-bold text-indigo-700 print:text-black mt-1">৳ {toBnNum(finReportData.advanceAmount.toLocaleString(), reportLang)}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-8 mb-6">
              {/* Teacher-wise */}
              <div>
                <h3 className="font-bold text-lg mb-2 border-b border-black pb-1">{reportLang === "en" ? "Teacher-wise Collection" : "শিক্ষক অনুযায়ী আদায়"}</h3>
                <table className="w-full text-left border-collapse border border-black text-sm">
                  <thead>
                    <tr className="bg-gray-100 print:bg-transparent">
                      <th className="border border-black p-2">{reportLang === "en" ? "Teacher Name" : "শিক্ষকের নাম"}</th>
                      <th className="border border-black p-2 text-right">{reportLang === "en" ? "Collection (৳)" : "আদায় (৳)"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(finReportData.teacherStats).length === 0 ? (
                      <tr><td colSpan={2} className="border border-black p-2 text-center">No collections</td></tr>
                    ) : Object.entries(finReportData.teacherStats).map(([name, amount]: [string, any]) => (
                      <tr key={name}>
                        <td className="border border-black p-2">{name}</td>
                        <td className="border border-black p-2 text-right font-medium">{toBnNum(amount.toLocaleString(), reportLang)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Donor-wise Summary */}
              <div>
                <h3 className="font-bold text-lg mb-2 border-b border-black pb-1">{reportLang === "en" ? "Donor Summary" : "দাতা সারাংশ"}</h3>
                <table className="w-full text-left border-collapse border border-black text-sm">
                  <thead>
                    <tr className="bg-gray-100 print:bg-transparent">
                      <th className="border border-black p-2">{reportLang === "en" ? "Donor Name" : "দাতার নাম"}</th>
                      <th className="border border-black p-2">{reportLang === "en" ? "Status" : "স্ট্যাটাস"}</th>
                      <th className="border border-black p-2 text-right">{reportLang === "en" ? "Due (৳)" : "বকেয়া (৳)"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(finReportData.donorStats).slice(0, 15).map(([name, stat]: [string, any]) => (
                      <tr key={name}>
                        <td className="border border-black p-2">{name}</td>
                        <td className="border border-black p-2">{stat.status}</td>
                        <td className="border border-black p-2 text-right">{stat.due > 0 ? toBnNum(stat.due.toLocaleString(), reportLang) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {Object.keys(finReportData.donorStats).length > 15 && (
                  <p className="text-xs text-slate-500 mt-2">* Showing top 15 donors. Export for full list.</p>
                )}
              </div>
            </div>
            
            {/* Footer Signatures */}
            <div className="mt-16 flex justify-between px-8 text-sm">
              <div className="text-center">
                <div className="border-t border-black w-32 mx-auto pt-1">{reportLang === "en" ? "Accountant" : "হিসাবরক্ষক"}</div>
              </div>
              <div className="text-center">
                <div className="border-t border-black w-32 mx-auto pt-1">{reportLang === "en" ? "Principal" : "অধ্যক্ষ"}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helpers
function getGrade(marks: number) {
  if (marks >= 80) return { grade: 'A+', gpa: 5.00 };
  if (marks >= 70) return { grade: 'A', gpa: 4.00 };
  if (marks >= 60) return { grade: 'A-', gpa: 3.50 };
  if (marks >= 50) return { grade: 'B', gpa: 3.00 };
  if (marks >= 40) return { grade: 'C', gpa: 2.00 };
  if (marks >= 33) return { grade: 'D', gpa: 1.00 };
  return { grade: 'F', gpa: 0.00 };
}

function getFinalGradeFromGpa(gpa: number) {
  if (gpa >= 5.00) return 'A+';
  if (gpa >= 4.00) return 'A';
  if (gpa >= 3.50) return 'A-';
  if (gpa >= 3.00) return 'B';
  if (gpa >= 2.00) return 'C';
  if (gpa >= 1.00) return 'D';
  return 'F';
}
