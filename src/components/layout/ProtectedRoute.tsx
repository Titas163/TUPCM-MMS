import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store';

interface ProtectedRouteProps {
  allowedRoles: Array<'admin' | 'teacher'>;
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading } = useAppStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin dark:border-slate-800 dark:border-t-white"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.requirePasswordChange) {
    return <Navigate to="/force-password-change" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    // Redirect to their respective dashboard if they try to access wrong role route
    return <Navigate to={user.role === 'admin' ? '/admin' : '/teacher'} replace />;
  }

  return <Outlet />;
}
