import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Donor, DonationCollection } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { ArrowLeft, Calendar, CreditCard, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { calculateDonorSummary, generateLedger, getCurrentMonthStr } from '../../lib/donationUtils';
import { formatCurrency, formatDate, formatMonths } from '../../lib/utils';
import { useAppStore } from '../../store';

interface Props {
  donor: Donor & { teacherName?: string };
  onBack: () => void;
  readOnly?: boolean;
}

export function DonorDetailsView({ donor, onBack, readOnly = false }: Props) {
  const { language, user } = useAppStore();
  const { t } = useTranslation();
  const [collections, setCollections] = useState<DonationCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [expandedPayment, setExpandedPayment] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCols() {
      try {
        let q;
        if (user?.role === 'teacher') {
          q = query(collection(db, 'donationCollections'), where('donorId', '==', donor.donorId), where('teacherId', '==', user.uid));
        } else {
          q = query(collection(db, 'donationCollections'), where('donorId', '==', donor.donorId));
        }
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ ...(d.data() as any), collectionId: d.id } as DonationCollection)).filter(c => !c.isDeleted);
        // Sort by paymentDate descending
        data.sort((a, b) => b.paymentDate - a.paymentDate);
        setCollections(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchCols();
  }, [donor.donorId]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading donor details...</div>;
  }

  const summary = calculateDonorSummary(donor, collections);
  
  const currentMonthStr = getCurrentMonthStr();
  let maxMonth = currentMonthStr;
  collections.filter(c => c.status === 'Approved').forEach(col => {
    if (col.allocations) {
      for (const alloc of col.allocations) {
        if (alloc.month > maxMonth) maxMonth = alloc.month;
      }
    } else if (col.coveredMonths) {
       for (const m of col.coveredMonths) {
         if (m > maxMonth) maxMonth = m;
       }
    }
  });
  const endMonth = maxMonth > currentMonthStr ? maxMonth : currentMonthStr;
  
  const ledger = generateLedger(donor, collections.filter(c => c.status === 'Approved'), donor.joinMonth || currentMonthStr, endMonth);
  // Sort ledger descending (newest month first)
  ledger.sort((a, b) => b.month.localeCompare(a.month));

  const totalExpected = ledger.reduce((sum, l) => sum + l.expected, 0);
  const totalActualCash = collections.filter(c => c.status === 'Approved').reduce((sum, c) => sum + c.paymentAmount, 0);

  const StatusBadge = ({ status }: { status: string }) => {
    const colors: Record<string, string> = {
      'Paid': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
      'Partial': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      'Due': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      'Advance': 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
      'Approved': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
      'Pending': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      'Void': 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors['Void']}`}>
        {status}
      </span>
    );
  };

  const getPaymentsForMonth = (month: string) => {
    const pays: { col: DonationCollection, allocatedAmount: number }[] = [];
    collections.filter(c => c.status === 'Approved').forEach(c => {
      if (c.allocations) {
        const alloc = c.allocations.find(a => a.month === month);
        if (alloc) pays.push({ col: c, allocatedAmount: alloc.amount });
      } else if (c.coveredMonths?.includes(month)) {
        pays.push({ col: c, allocatedAmount: c.paymentAmount / c.coveredMonths.length });
      }
    });
    return pays;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack} className="p-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {donor.donorName}
          </h2>
          <p className="text-sm text-slate-500">
            Donor Details & Financial History
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Personal Info Card */}
        <Card className="col-span-1 border-none shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-slate-500">Name:</span>
              <span className="font-medium text-slate-900 dark:text-white">{donor.donorName}</span>
              
              <span className="text-slate-500">Bangla Name:</span>
              <span className="font-medium text-slate-900 dark:text-white">{(donor as any).donorNameBn || '-'}</span>
              
              <span className="text-slate-500">Mobile:</span>
              <span className="font-medium text-slate-900 dark:text-white">{donor.mobile || '-'}</span>
              
              <span className="text-slate-500">Assigned Teacher:</span>
              <span className="font-medium text-slate-900 dark:text-white">{donor.teacherName || 'Unassigned'}</span>
              
              <span className="text-slate-500">Monthly Donation:</span>
              <span className="font-medium text-slate-900 dark:text-white">{formatCurrency(donor.monthlyDonation, language)}</span>
              
              <span className="text-slate-500">Starting Month:</span>
              <span className="font-medium text-slate-900 dark:text-white">{donor.joinMonth || <span className="text-red-500">Not Set</span>}</span>
              
              <span className="text-slate-500">Status:</span>
              <span className="font-medium text-slate-900 dark:text-white">{donor.status}</span>
            </div>
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <Card className="col-span-1 md:col-span-2 border-none shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex justify-between items-center">
              Financial Summary
              <StatusBadge status={summary.status} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500 font-medium mb-1">Total Expected</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalExpected, language)}</p>
              </div>
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-1">Total Paid</p>
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(summary.totalPaid, language)}</p>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
                <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">Total Due</p>
                <p className="text-xl font-bold text-red-700 dark:text-red-400">{formatCurrency(summary.totalDue, language)}</p>
              </div>
              <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30">
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">Pending Unapproved</p>
                <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{formatCurrency(summary.totalPending, language)}</p>
              </div>
              <div className="p-4 bg-teal-50 dark:bg-teal-900/10 rounded-xl border border-teal-100 dark:border-teal-900/30">
                <p className="text-xs text-teal-600 dark:text-teal-400 font-medium mb-1">Total Advance</p>
                <p className="text-xl font-bold text-teal-700 dark:text-teal-400">{formatCurrency(summary.totalAdvance, language)}</p>
              </div>
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mb-1">Total Actual Cash</p>
                <p className="text-xl font-bold text-indigo-700 dark:text-indigo-400">{formatCurrency(totalActualCash, language)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Layout Alternative: Stacking them vertically for better mobile view */}
      
      <div className="space-y-6">
        {/* Ledger Section */}
        <Card className="border-none shadow-md overflow-hidden">
          <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-500" />
              Monthly Ledger
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-medium">Month</th>
                  <th className="px-4 py-3 font-medium">Expected</th>
                  <th className="px-4 py-3 font-medium">Paid</th>
                  <th className="px-4 py-3 font-medium">Remaining</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {ledger.map((l) => (
                  <React.Fragment key={l.month}>
                    <tr 
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                      onClick={() => setExpandedMonth(expandedMonth === l.month ? null : l.month)}
                    >
                      <td className="px-4 py-3 font-medium">{l.month}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatCurrency(l.expected, language)}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatCurrency(l.paid, language)}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatCurrency(Math.max(0, l.expected - l.paid), language)}</td>
                      <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" className="p-0 h-6 w-6">
                          {expandedMonth === l.month ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </Button>
                      </td>
                    </tr>
                    {expandedMonth === l.month && (
                      <tr className="bg-slate-50 dark:bg-slate-900/50">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="pl-4 border-l-2 border-indigo-200 dark:border-indigo-800 space-y-2">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase">Payments satisfying this month</h4>
                            {getPaymentsForMonth(l.month).length > 0 ? (
                              <div className="space-y-2 mt-2">
                                {getPaymentsForMonth(l.month).map((p, idx) => (
                                  <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800 text-sm">
                                    <div className="flex flex-col">
                                      <span className="font-medium text-slate-900 dark:text-white">
                                        Receipt: {p.col.receiptNumber}
                                      </span>
                                      <span className="text-xs text-slate-500">
                                        Paid on {formatDate(p.col.paymentDate, language)}
                                      </span>
                                    </div>
                                    <div className="mt-1 sm:mt-0 flex items-center gap-4">
                                      <span className="text-emerald-600 dark:text-emerald-400 font-medium text-sm">
                                        Allocated: {formatCurrency(p.allocatedAmount, language)}
                                      </span>
                                      <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">
                                        Fund Income: {formatDate(p.col.paymentDate, language)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500 italic">No payments found for this month.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Payment History Section */}
        <Card className="border-none shadow-md overflow-hidden">
          <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-500" />
              Complete Payment History
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Receipt</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {collections.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">No payment history found.</td>
                  </tr>
                ) : (
                  collections.map(c => (
                    <React.Fragment key={c.collectionId}>
                      <tr 
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                        onClick={() => setExpandedPayment(expandedPayment === c.collectionId ? null : c.collectionId)}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(c.paymentDate, language)}</td>
                        <td className="px-4 py-3 font-medium">{c.receiptNumber}</td>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{formatCurrency(c.paymentAmount, language)}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.paymentMethod}</td>
                        <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm" className="p-0 h-6 w-6">
                            {expandedPayment === c.collectionId ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </Button>
                        </td>
                      </tr>
                      {expandedPayment === c.collectionId && (
                        <tr className="bg-slate-50 dark:bg-slate-900/50">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                              <div className="space-y-2">
                                <p><span className="font-medium text-slate-500">Source:</span> {c.source || 'Teacher Entry'}</p>
                                <p><span className="font-medium text-slate-500">Created:</span> {formatDate(c.createdAt, language)}</p>
                                <p><span className="font-medium text-slate-500">Note:</span> {c.note || 'None'}</p>
                                {c.status === 'Void' && (
                                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-100 dark:border-red-900/30">
                                    <p className="text-red-600 dark:text-red-400 font-medium">Void Reason: {c.voidReason || 'Not provided'}</p>
                                  </div>
                                )}
                              </div>
                              <div>
                                <h4 className="font-medium text-slate-900 dark:text-white mb-2">Allocation Breakdown</h4>
                                {c.allocations && c.allocations.length > 0 ? (
                                  <ul className="space-y-1">
                                    {c.allocations.map(a => (
                                      <li key={a.month} className="flex justify-between bg-white dark:bg-slate-800 p-1.5 px-3 rounded border border-slate-100 dark:border-slate-700">
                                        <span className="text-slate-600 dark:text-slate-300">{a.month}</span>
                                        <span className="font-medium">{formatCurrency(a.amount, language)}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : c.coveredMonths && c.coveredMonths.length > 0 ? (
                                  <ul className="space-y-1">
                                    {c.coveredMonths.map(m => (
                                      <li key={m} className="flex justify-between bg-white dark:bg-slate-800 p-1.5 px-3 rounded border border-slate-100 dark:border-slate-700">
                                        <span className="text-slate-600 dark:text-slate-300">{m}</span>
                                        <span className="font-medium">{formatCurrency(c.paymentAmount / (c.coveredMonths?.length || 1), language)}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-slate-500 italic">No allocation data</p>
                                )}
                                <p className="mt-3 text-xs text-slate-500 bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded border border-indigo-100 dark:border-indigo-900/30">
                                  <strong>Fund Income Period:</strong> {formatDate(c.paymentDate, language)}
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
