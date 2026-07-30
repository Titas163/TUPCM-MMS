import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { updatePassword as updateFirebasePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { useAppStore } from '../../store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ShieldAlert, Eye, EyeOff, Check, X } from 'lucide-react';
import { auditService } from '../../services/auditService';

export function ForcePasswordChange() {
  const navigate = useNavigate();
  const { user } = useAppStore();
  const [oldPassword, setOldPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const rules = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const allRulesMet = Object.values(rules).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!oldPassword) {
      setError('Please enter your current password.');
      return;
    }

    if (!allRulesMet) {
      setError('Please ensure your new password meets all requirements.');
      return;
    }

    if (password !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    if (!auth.currentUser || !user) {
      setError('You must be logged in to change your password.');
      return;
    }

    setLoading(true);

    try {
      // Re-authenticate first to prevent auth/requires-recent-login
      const { EmailAuthProvider, reauthenticateWithCredential } = await import('firebase/auth');
      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);

      await updateFirebasePassword(auth.currentUser, password);
      
      // Update Firestore to remove flag
      await updateDoc(doc(db, 'users', user.uid), {
        requirePasswordChange: false
      });
      
      // Update local state so ProtectedRoute doesn't bounce us back
      useAppStore.getState().setUser({ ...user, requirePasswordChange: false });
      
      // Log audit
      await auditService.log(user.uid, 'PASSWORD_CHANGE', 'AUTH');
      
      // Navigate to dashboard
      navigate(user.role === 'admin' ? '/admin' : '/teacher', { replace: true });
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential') {
        setError('Incorrect current password. Please try again.');
      } else if (err.code === 'auth/requires-recent-login') {
        setError('For security reasons, please log out and log in again to change your password.');
      } else {
        setError(err.message || 'Failed to update password.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      useAppStore.getState().setUser(null);
      navigate('/login');
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const RuleIndicator = ({ met, text }: { met: boolean; text: string }) => (
    <div className={`flex items-center text-sm ${met ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
      {met ? <Check className="w-4 h-4 mr-2" /> : <X className="w-4 h-4 mr-2 opacity-50" />}
      {text}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-900">
      <Card className="w-full max-w-md border-none shadow-xl">
        <CardHeader className="text-center space-y-4 pt-8">
          <div className="mx-auto w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold tracking-tight">Security Required</CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400 text-sm max-w-xs mx-auto">
              You must set a new secure password before you can access your dashboard.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg dark:bg-red-950/50 dark:text-red-400 border border-red-200 dark:border-red-900">
                {error}
              </div>
            )}
            
            <div className="space-y-4">
              <div className="space-y-2 relative">
                <label className="text-sm font-medium text-slate-900 dark:text-slate-200">
                  Current Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter current password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2 relative">
                <label className="text-sm font-medium text-slate-900 dark:text-slate-200">
                  New Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 space-y-2 border border-slate-100 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">Password Requirements</p>
                <RuleIndicator met={rules.length} text="Minimum 8 characters" />
                <RuleIndicator met={rules.upper} text="At least one uppercase letter" />
                <RuleIndicator met={rules.lower} text="At least one lowercase letter" />
                <RuleIndicator met={rules.number} text="At least one number" />
                <RuleIndicator met={rules.special} text="At least one special character" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900 dark:text-slate-200">
                  Confirm Password
                </label>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="outline" className="w-1/3 h-11" onClick={handleLogout} disabled={loading}>
                Log Out
              </Button>
              <Button type="submit" className="w-2/3 h-11" disabled={loading || !allRulesMet || password !== confirmPassword}>
                {loading ? "Updating..." : "Set New Password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
