import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { Card, CardContent } from '../../components/ui/Card';
import { HandCoins, Wallet, Clock, FileText, Calendar as CalendarIcon, Users, ArrowUpRight, AlertCircle, BookOpen } from 'lucide-react';
import { useAppStore } from '../../store';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Donor, DonationCollection } from '../../types';
import { formatCurrency, toBnNum } from '../../lib/utils';
import { calculateDonorSummary } from '../../lib/donationUtils';

export function TeacherDashboard() {
  const { t } = useTranslation();
  const { user, language } = useAppStore();
  const [loading, setLoading] = useState(true);
  
  const [stats, setStats] = useState({
    assignedDonors: 0,
    assignedSubjects: 0,
    todaysCollection: 0,
    currentMonthCollection: 0,
    dueDonors: 0,
    partialDonors: 0,
    advanceDonors: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      if (!user) return;
      try {
        const teacherSnapshot = await getDocs(query(collection(db, 'teachers'), where('email', '==', user.email)));
        if (teacherSnapshot.empty) {
          setLoading(false);
          return;
        }
        const tId = teacherSnapshot.docs[0].id;

        // Fetch assigned donors
        const dQuery = query(collection(db, 'donors'), where('assignedTeacher', '==', tId));
        const dSnap = await getDocs(dQuery);
        const donorsData = dSnap.docs.map(d => ({ ...d.data(), donorId: d.id } as Donor));
        
        // Fetch assigned subjects
        const sQuery = query(collection(db, 'subjects'), where('assignedTeacher', '==', tId));
        const sSnap = await getDocs(sQuery);
        const subjectsCount = sSnap.size;
        
        // Fetch all non-void collections for this teacher
        const cQuery = query(collection(db, 'donationCollections'), where('teacherId', '==', tId));
        const cSnap = await getDocs(cQuery);
        const collectionsData = cSnap.docs.map(c => ({ ...c.data(), collectionId: c.id } as DonationCollection)).filter(c => c.status !== 'Void' && !c.isDeleted);
        
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
        
        
        let todaysColl = 0;
        let monthColl = 0;
        
        collectionsData.forEach(c => {
          if (c.paymentDate >= startOfDay && c.paymentDate <= endOfDay) {
            todaysColl += c.paymentAmount;
          }
          if (c.paymentDate >= startOfMonth && c.paymentDate <= endOfMonth) {
            monthColl += c.paymentAmount;
          }
        });

        let dueCount = 0;
        let partialCount = 0;
        let advanceCount = 0;
        
        donorsData.forEach(donor => {
          const dCols = collectionsData.filter(c => c.donorId === donor.donorId);
          const summary = calculateDonorSummary(donor, dCols);
          
          if (summary.status === 'Due') dueCount++;
          if (summary.status === 'Partial') partialCount++;
          if (summary.status === 'Advance') advanceCount++;
        });

        setStats({

          assignedDonors: donorsData.length,
          assignedSubjects: subjectsCount,
          todaysCollection: todaysColl,
          currentMonthCollection: monthColl,
          dueDonors: dueCount,
          partialDonors: partialCount,
          advanceDonors: advanceCount
        });

      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [user]);

  const statCards = [
    { title: 'Assigned Donors', value: toBnNum(stats.assignedDonors, language), icon: Users, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    { title: 'Assigned Subjects', value: toBnNum(stats.assignedSubjects, language), icon: BookOpen, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    { title: "Today's Collection", value: formatCurrency(stats.todaysCollection, language), icon: Wallet, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    { title: 'Current Month Collection', value: formatCurrency(stats.currentMonthCollection, language), icon: CalendarIcon, color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
    { title: 'Due Donors', value: toBnNum(stats.dueDonors, language), icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
    { title: 'Partial Donors', value: toBnNum(stats.partialDonors, language), icon: Clock, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    { title: 'Advance Donors', value: toBnNum(stats.advanceDonors, language), icon: ArrowUpRight, color: 'text-teal-500', bg: 'bg-teal-100 dark:bg-teal-900/30' },
  ];

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Teacher Dashboard
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          Welcome back, {user?.fullName}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {stat.value}
                    </h2>
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
