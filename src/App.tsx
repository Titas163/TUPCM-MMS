import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthInit } from './hooks/useAuthInit';
import { MainLayout } from './components/layout/MainLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Login } from './pages/auth/Login';
import { useAppStore } from './store';

import { SetupAdmin } from './pages/auth/SetupAdmin';
import { ForcePasswordChange } from './pages/auth/ForcePasswordChange';

import { AdminDashboard } from './pages/admin/AdminDashboard';
import { Teachers as AdminTeachers } from './pages/admin/Teachers';
import { Classes as AdminClasses } from './pages/admin/Classes';
import { AcademicSessions as AdminSessions } from './pages/admin/AcademicSessions';
import { Students as AdminStudents } from './pages/admin/Students';
import { Subjects as AdminSubjects } from './pages/admin/Subjects';
import { Exams as AdminExams } from './pages/admin/Exams';
import { Donors as AdminDonors } from './pages/admin/Donors';
import { AdminDonations } from './pages/admin/Donations';
import { AdminResults } from './pages/admin/AdminResults';
import { Reports as AdminReports } from './pages/admin/Reports';
import { Settings as AdminSettings } from './pages/admin/Settings';
import { AuditLogs as AdminAuditLogs } from './pages/admin/AuditLogs';
import { FundManagement as AdminFundManagement } from './pages/admin/FundManagement';

import { TeacherDashboard } from './pages/teacher/TeacherDashboard';
import { TeacherDonations } from './pages/teacher/TeacherDonations';
import { TeacherResults } from './pages/teacher/TeacherResults';

export default function App() {
  useAuthInit();
  const { theme } = useAppStore();

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/setup" element={<SetupAdmin />} />
        <Route path="/force-password-change" element={<ForcePasswordChange />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route element={<MainLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="teachers" element={<AdminTeachers />} />
            <Route path="students" element={<AdminStudents />} />
            <Route path="donors" element={<AdminDonors />} />
            <Route path="donations" element={<AdminDonations />} />
            <Route path="results" element={<AdminResults />} />
            <Route path="classes" element={<AdminClasses />} />
            <Route path="sessions" element={<AdminSessions />} />
            <Route path="subjects" element={<AdminSubjects />} />
            <Route path="exams" element={<AdminExams />} />
            <Route path="funds" element={<AdminFundManagement />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="audit-logs" element={<AdminAuditLogs />} />
            {/* Add more admin routes here */}
          </Route>
        </Route>

        {/* Teacher Routes */}
        <Route path="/teacher" element={<ProtectedRoute allowedRoles={['teacher']} />}>
          <Route element={<MainLayout />}>
            <Route index element={<TeacherDashboard />} />
            <Route path="donations" element={<TeacherDonations />} />
            <Route path="results" element={<TeacherResults />} />
            {/* Add more teacher routes here */}
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
