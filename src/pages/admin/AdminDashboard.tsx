import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { 
  Users, UserSquare, HandCoins, Wallet, 
  Clock, CheckCircle, FileText, GraduationCap 
} from 'lucide-react';
import { collection, getDocs, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { formatCurrency, toBnNum } from '../../lib/utils';
import { useAppStore } from '../../store';
import { Donor, DonationCollection } from '../../types';
import { calculateDonorSummary } from '../../lib/donationUtils';

export function AdminDashboard() {
  const { t } = useTranslation();
  const { language } = useAppStore();
  
  const [stats, setStats] = useState({
    teachers: 0,
    students: 0,
    donors: 0,
    currentMonthCollection: 0,
    pendingCollections: 0,
    approvedCollections: 0,
    pendingResults: 0,
    totalDue: 0,
    fundBalance: 0,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    
    
    async function fetchStats() {
      try {
        const [
          teachersCount,
          studentsCount,
          donorsSnap,
          colSnap,
          pendingResCount,
          txSnap
        ] = await Promise.all([
          getCountFromServer(collection(db, 'teachers')),
          getCountFromServer(collection(db, 'students')),
          getDocs(collection(db, 'donors')),
          getDocs(collection(db, 'donationCollections')),
          getCountFromServer(query(collection(db, 'marks'), where('submitted', '==', true), where('draft', '==', false))),
          getDocs(collection(db, 'transactions'))
        ]);
        
        const donors = donorsSnap.docs.map(d => ({ ...d.data(), donorId: d.id } as Donor));
        const allCols = colSnap.docs.map(c => ({ ...c.data(), collectionId: c.id } as DonationCollection)).filter(c => !c.isDeleted);
        
        const approvedCols = allCols.filter(c => c.status === 'Approved');
        const pendingColsCount = allCols.filter(c => c.status === 'Pending').length;
        
        // 1. Current Month Collection
        const date = new Date();
        const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
        const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
        
        const currMonthTotal = approvedCols
          .filter(c => c.paymentDate >= startOfMonth && c.paymentDate <= endOfMonth)
          .reduce((sum, c) => sum + (c.paymentAmount || 0), 0);
          
        
        // 2. Total Due (All Donors)
        let totalDue = 0;
        donors.forEach(donor => {
          const dCols = allCols.filter(c => c.donorId === donor.donorId);
          const summary = calculateDonorSummary(donor, dCols);
          totalDue += summary.totalDue;
        });

        
        // 3. Fund Balance
        const manualTx = txSnap.docs.map(d => d.data());
        let income = 0;
        let expense = 0;
        manualTx.forEach(t => {
          if (t.type === 'income') income += t.amount;
          else expense += t.amount;
        });
        // Add approved donations to income
        const donationIncome = approvedCols.reduce((sum, c) => sum + c.paymentAmount, 0);
        income += donationIncome;
        const fundBalance = income - expense;

        setStats({
          teachers: teachersCount.data().count,
          students: studentsCount.data().count,
          donors: donors.length,
          currentMonthCollection: currMonthTotal,
          pendingCollections: pendingColsCount,
          approvedCollections: approvedCols.length,
          pendingResults: pendingResCount.data().count,
          totalDue,
          fundBalance
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const statCards = [
    { title: t.totalTeachers, value: toBnNum(stats.teachers, language), icon: UserSquare, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    { title: t.totalStudents, value: toBnNum(stats.students, language), icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    { title: t.totalDonors, value: toBnNum(stats.donors, language), icon: HandCoins, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    { title: t.currentMonthCollection, value: formatCurrency(stats.currentMonthCollection, language), icon: Wallet, color: 'text-violet-500', bg: 'bg-violet-100 dark:bg-violet-900/30' },
    { title: t.pendingCollections, value: toBnNum(stats.pendingCollections, language), icon: Clock, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' },
    { title: t.approvedCollections, value: toBnNum(stats.approvedCollections, language), icon: CheckCircle, color: 'text-teal-500', bg: 'bg-teal-100 dark:bg-teal-900/30' },
    { title: t.pendingResults, value: toBnNum(stats.pendingResults, language), icon: GraduationCap, color: 'text-pink-500', bg: 'bg-pink-100 dark:bg-pink-900/30' },
    { title: t.recentActivities, value: toBnNum(12, language), icon: FileText, color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
  ];

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin dark:border-slate-800 dark:border-t-white"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {t.adminDashboard}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          Overview of your institution's activities
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="border-none shadow-md overflow-hidden dark:bg-slate-900">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
                      {stat.title}
                    </p>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {stat.value}
                    </h3>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
