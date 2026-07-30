import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store';
import { useTranslation } from '../../hooks/useTranslation';
import { authService } from '../../services/authService';
import { 
  LayoutDashboard, Users, UserSquare, HandCoins, 
  Wallet, CalendarDays, BookOpen, BookMarked, 
  FileText, GraduationCap, Settings, History, 
  LogOut, Menu, X, Globe, Moon, Sun
} from 'lucide-react';
import { cn } from '../../lib/utils';

export function MainLayout() {
  const { user, theme, setTheme, language, setLanguage } = useAppStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isAdmin = user?.role === 'admin';

  const adminGroups = [
    {
      title: 'Overview',
      links: [
        { to: '/admin', icon: LayoutDashboard, label: t.adminDashboard },
      ]
    },
    {
      title: 'People',
      links: [
        { to: '/admin/teachers', icon: UserSquare, label: t.teachers },
        { to: '/admin/students', icon: Users, label: t.students },
        { to: '/admin/donors', icon: HandCoins, label: t.donors },
      ]
    },
    {
      title: 'Finance',
      links: [
        { to: '/admin/donations', icon: Wallet, label: t.donations },
        { to: '/admin/funds', icon: Wallet, label: t.fundManagement },
      ]
    },
    {
      title: 'Academics',
      links: [
        { to: '/admin/sessions', icon: CalendarDays, label: t.academicSessions },
        { to: '/admin/classes', icon: BookOpen, label: t.classes },
        { to: '/admin/subjects', icon: BookMarked, label: t.subjects },
        { to: '/admin/exams', icon: FileText, label: t.exams },
        { to: '/admin/results', icon: GraduationCap, label: t.results },
      ]
    },
    {
      title: 'System',
      links: [
        { to: '/admin/reports', icon: FileText, label: t.reports },
        { to: '/admin/settings', icon: Settings, label: t.settings },
        { to: '/admin/audit-logs', icon: History, label: t.auditLogs },
      ]
    }
  ];

  const teacherGroups = [
    {
      title: 'Overview',
      links: [
        { to: '/teacher', icon: LayoutDashboard, label: t.teacherDashboard },
      ]
    },
    {
      title: 'Academics',
      links: [
        { to: '/teacher/results', icon: GraduationCap, label: t.results },
      ]
    },
    {
      title: 'Finance',
      links: [
        { to: '/teacher/donations', icon: Wallet, label: t.donations },
      ]
    }
  ];

  const groups = isAdmin ? adminGroups : teacherGroups;

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'bn' : 'en');
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  return (
    <div className={cn("min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200")}>
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "print:hidden",
        "fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-200 ease-in-out lg:translate-x-0 flex flex-col",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800">
          <span className="font-bold text-lg dark:text-white">Madrasa Pro</span>
          <button className="lg:hidden dark:text-white" onClick={() => setIsMobileMenuOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {groups.map((group) => (
            <div key={group.title}>
              <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 dark:text-slate-400">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.links.map((link) => {
                  const Icon = link.icon;
                  return (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      end={link.to === '/admin' || link.to === '/teacher'}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={({ isActive }) => cn(
                        "flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors",
                        isActive 
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" 
                          : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                      )}
                    >
                      <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {link.label}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <NavLink
            to={isAdmin ? '/admin/profile' : '/teacher/profile'}
            className={({ isActive }) => cn(
              "flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors mb-2",
              isActive 
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" 
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            )}
          >
            <UserSquare className="w-5 h-5 mr-3" />
            {t.profile}
          </NavLink>
          <button
            onClick={handleLogout}
            className="flex w-full items-center px-3 py-2.5 text-sm font-medium rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50 transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            {t.logout}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-64 print:pl-0 flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="h-16 print:hidden bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-6 z-10 sticky top-0">
          <button 
            className="lg:hidden p-2 -ml-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-white"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex-1 flex justify-end items-center space-x-2 sm:space-x-4">
            <button
              onClick={toggleLanguage}
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              title="Toggle Language"
            >
              <Globe className="w-5 h-5" />
              <span className="sr-only">Toggle Language</span>
            </button>
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              title="Toggle Theme"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              <span className="sr-only">Toggle Theme</span>
            </button>
            <div className="flex items-center ml-2 border-l border-slate-200 dark:border-slate-800 pl-4">
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt={user.fullName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    {user?.fullName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="ml-3 hidden sm:block">
                <p className="text-sm font-medium text-slate-900 dark:text-white">{user?.fullName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user?.role}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
