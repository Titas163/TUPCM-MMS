import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { useAppStore } from '../../store';
import { useTranslation } from '../../hooks/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { BookOpen, Eye, EyeOff, Lock, User as UserIcon } from 'lucide-react';
import { browserLocalPersistence, browserSessionPersistence, setPersistence } from 'firebase/auth';
import { auth } from '../../lib/firebase';

export function Login() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isLoading } = useAppStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center dark:bg-slate-900 bg-slate-50"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div></div>;
  }

  if (user) {
    if (user.requirePasswordChange) {
       return <Navigate to="/force-password-change" replace />;
    }
    return <Navigate to={user.role === 'admin' ? '/admin' : '/teacher'} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!identifier || !password) {
      setError('Please enter both identifier and password');
      return;
    }

    setLoading(true);
    try {
      // Set persistence based on remember me
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      
      const userData = await authService.login(identifier, password);
      
      if (userData.requirePasswordChange) {
        navigate('/force-password-change', { replace: true });
      } else {
        navigate(userData.role === 'admin' ? '/admin' : '/teacher', { replace: true });
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-email') {
        setError('Invalid mobile number or email format.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('Incorrect mobile number, email, or password.');
      } else {
        setError(err.message || 'Invalid credentials provided. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    alert("Please contact the Super Admin to reset your password. If you are the Super Admin, check server configuration.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <Card className="w-full max-w-md border-none shadow-2xl dark:bg-slate-900">
        <CardHeader className="text-center space-y-6 pt-10">
          <div className="mx-auto w-16 h-16 bg-slate-900 dark:bg-white rounded-2xl flex items-center justify-center shadow-lg transform rotate-3">
            <BookOpen className="w-8 h-8 text-white dark:text-slate-900 -rotate-3" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl font-bold tracking-tight">Madrasa Pro</CardTitle>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              Secure Management Portal
            </p>
          </div>
        </CardHeader>
        <CardContent className="px-8 pb-10">
          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            {error && (
              <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl dark:bg-red-950/40 dark:text-red-400 border border-red-100 dark:border-red-900/50 flex items-start">
                <ShieldAlert className="w-5 h-5 mr-3 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            
            <div className="space-y-4">
              <div className="space-y-2 relative">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="identifier">
                  Mobile Number or Email
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    id="identifier"
                    type="text"
                    placeholder="e.g., 01712345678 or admin"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    disabled={loading}
                    className="pl-10 h-12 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="space-y-2 relative">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="password">
                    Password
                  </label>
                  <button type="button" onClick={handleForgotPassword} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="pl-10 pr-10 h-12 bg-white dark:bg-slate-950"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center">
              <input
                id="remember"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 dark:border-slate-700 dark:bg-slate-900"
              />
              <label htmlFor="remember" className="ml-2 text-sm text-slate-600 dark:text-slate-400">
                Keep me signed in
              </label>
            </div>

            <Button type="submit" className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all" disabled={loading}>
              {loading ? "Authenticating..." : "Sign In securely"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// Just adding a quick mockup icon since I didn't import ShieldAlert above
function ShieldAlert(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m12 8-1.5 6h3z" />
      <path d="m12 16 h.01" />
    </svg>
  );
}
