import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { DonationCollection, Donor, Teacher } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Search, CheckCircle, XCircle, Printer } from 'lucide-react';
import { formatCurrency, formatDate, formatMonths } from '../../lib/utils';
import { calculateAllocation } from '../../lib/donationUtils';
import { addDoc } from 'firebase/firestore';
import { useAppStore } from '../../store';

export function AdminDonations() {
  const { t } = useTranslation();
  const { language, user, settings } = useAppStore();
  
  const [collectionsData, setCollectionsData] = useState<(DonationCollection & { donorName?: string, teacherName?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Approved' | 'Void'>('All');

  const [teachersList, setTeachersList] = useState<Teacher[]>([]);
  const [teacherFilter, setTeacherFilter] = useState<string>('All');
  const [monthFilter, setMonthFilter] = useState<string>('All');

  const [receiptModal, setReceiptModal] = useState<(DonationCollection & { donorName?: string, teacherName?: string }) | null>(null);
  const [receiptLang, setReceiptLang] = useState<'en'|'bn'>(language || 'bn');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCol, setEditingCol] = useState<DonationCollection | null>(null);
  const [donorsList, setDonorsList] = useState<Donor[]>([]);
  const [formData, setFormData] = useState({
    donorId: '',
    teacherId: '',
    paymentAmount: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'Cash',
    note: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [donorSnap, teacherSnap] = await Promise.all([
        getDocs(collection(db, 'donors')),
        getDocs(collection(db, 'teachers'))
      ]);
      const donors = donorSnap.docs.map(d => ({ ...d.data(), donorId: d.id } as Donor));
      
      const teachers = teacherSnap.docs.map(t => ({ ...t.data(), teacherId: t.id } as Teacher));
      setTeachersList(teachers);
      setDonorsList(donors);


      const q = query(collection(db, 'donationCollections'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      const data = snapshot.docs.map(doc => {
        const col = { ...doc.data(), collectionId: doc.id } as DonationCollection;
        return {
          ...col,
          donorName: donors.find(d => d.donorId === col.donorId)?.donorName || 'Unknown',
          donorNameBn: donors.find(d => d.donorId === col.donorId)?.donorNameBn || '',
          teacherName: teachers.find(t => t.teacherId === col.teacherId)?.teacherName || 'Unknown'
        };
      });
      setCollectionsData(data);
    } catch (error) {
      console.error("Error fetching collections", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEdit = (c: any) => {
    setEditingCol(c);
    setFormData({
      donorId: c.donorId,
      teacherId: c.teacherId,
      paymentAmount: c.paymentAmount,
      paymentDate: new Date(c.paymentDate).toISOString().split('T')[0],
      paymentMethod: c.paymentMethod,
      note: c.note || ''
    });
    setIsModalOpen(true);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.donorId || formData.paymentAmount <= 0) return;
    try {
      const isDuplicate = collectionsData.some(c =>
        c.donorId === formData.donorId &&
        c.paymentAmount === formData.paymentAmount &&
        new Date(c.paymentDate).toISOString().split('T')[0] === formData.paymentDate &&
        c.status !== 'Void' && !c.isDeleted &&
        c.collectionId !== (editingCol?.collectionId || '')
      );
      if (isDuplicate) {
        if (!window.confirm("Possible Duplicate Payment detected. Proceed?")) {
          return;
        }
      }
      
      const donor = donorsList.find(d => d.donorId === formData.donorId);
      if (!donor) return;
      const alloc = calculateAllocation(donor, Number(formData.paymentAmount), collectionsData.filter(c => c.donorId === formData.donorId));
      
      
      if (editingCol) {
        if (!window.confirm("You are modifying an existing historical transaction. Are you sure you want to correct this? Audit history will be updated.")) return;
        await updateDoc(doc(db, 'donationCollections', editingCol.collectionId), {
          teacherId: formData.teacherId || donor.assignedTeacher,
          donorId: formData.donorId,
          paymentAmount: Number(formData.paymentAmount),
          allocations: alloc,
          paymentDate: new Date(formData.paymentDate).getTime(),
          paymentMethod: formData.paymentMethod,
          note: formData.note,
          updatedAt: Date.now(),
          correctedBy: user?.uid,
          correctedAt: Date.now(),
          previousAmount: editingCol.paymentAmount // Basic audit
        });
      } else {
        const newCol: Omit<DonationCollection, 'collectionId'> = {
            receiptNumber: 'REC-' + new Date().getFullYear() + (new Date().getMonth()+1).toString().padStart(2,'0') + '-' + Math.floor(Math.random() * 9000 + 1000),
            teacherId: formData.teacherId || donor.assignedTeacher,
            donorId: formData.donorId,
            paymentAmount: Number(formData.paymentAmount),
            allocations: alloc,
            paymentDate: new Date(formData.paymentDate).getTime(),
            paymentMethod: formData.paymentMethod,
            note: formData.note,
            status: 'Approved',
            source: 'MANUAL_ADMIN',
            approvedAt: Date.now(),
            approvedBy: user?.uid || 'admin',
            submittedAt: Date.now(),
            createdAt: Date.now()
        };
        await addDoc(collection(db, 'donationCollections'), newCol);
      }
      setIsModalOpen(false); setEditingCol(null);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Error adding entry");
    }
  };

  const handleApprove = async (id: string) => {
      try {
        await updateDoc(doc(db, 'donationCollections', id), {
          status: 'Approved',
          approvedAt: Date.now(),
          approvedBy: user?.uid || 'unknown',
          updatedAt: Date.now()
        });
        fetchData();
      } catch (error: any) { alert("Error approving: " + error.message); console.error(error); }
  };

  const handleVoid = async (id: string) => {
    const reason = prompt("Please enter a reason for voiding this transaction:");
    if (reason === null || reason.trim() === '') {
      alert("Void cancelled. Reason is required.");
      return;
    }
    if (window.confirm("Are you sure you want to VOID this transaction? This action will remove it from Fund Income.")) {
      try {
        await updateDoc(doc(db, 'donationCollections', id), {
          status: 'Void',
          voidReason: reason,
          voidAt: Date.now(),
          voidBy: user?.uid || 'unknown',
          updatedAt: Date.now()
        });
        fetchData();
      } catch (err) {
        console.error(err);
      }
    }
  };

  
  const filtered = collectionsData.filter(c => {
    const matchesSearch = c.donorName?.toLowerCase().includes(search.toLowerCase()) || 
                          c.receiptNumber?.toLowerCase().includes(search.toLowerCase()) ||
                          c.teacherName?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
    const matchesTeacher = teacherFilter === 'All' || c.teacherId === teacherFilter;
    
    let matchesMonth = true;
    if (monthFilter !== 'All') {
      const colMonth = new Date(c.paymentDate).toISOString().slice(0, 7); // YYYY-MM
      matchesMonth = colMonth === monthFilter;
    }
    
    return matchesSearch && matchesStatus && matchesTeacher && matchesMonth && !c.isDeleted;
  });


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t.donations || 'Donations'}
          </h1>
          <p className="text-sm text-slate-500">Manage and approve all donation collections</p>
        </div>
      </div>

      <Card className="border-none shadow-md dark:bg-slate-900">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Search by donor, receipt, or teacher..." 
                className="pl-9 bg-slate-50 dark:bg-slate-950"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full sm:w-40 bg-slate-50 dark:bg-slate-950"
            >
              <option value="All">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Void">Void</option>
            </Select>
            <Select 
              value={teacherFilter} 
              onChange={(e) => setTeacherFilter(e.target.value)}
              className="w-full sm:w-48 bg-slate-50 dark:bg-slate-950"
            >
              <option value="All">All Teachers</option>
              {teachersList.map(t => (
                <option key={t.teacherId} value={t.teacherId}>{t.teacherName}</option>
              ))}
            </Select>
            <Input 
              type="month"
              value={monthFilter === 'All' ? '' : monthFilter}
              onChange={(e) => setMonthFilter(e.target.value || 'All')}
              className="w-full sm:w-40 bg-slate-50 dark:bg-slate-950"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Receipt</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Donor</th>
                  <th className="px-6 py-4 font-medium">Teacher</th>
                  <th className="px-6 py-4 font-medium">Amount</th>
                  <th className="px-6 py-4 font-medium">Months</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                      Loading...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                      No records found
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr key={c.collectionId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        {c.receiptNumber}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {formatDate(c.paymentDate, language)}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        {language === 'bn' && (c as any).donorNameBn ? (c as any).donorNameBn : c.donorName}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {c.teacherName}
                      </td>
                      <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-bold">
                        {formatCurrency(c.paymentAmount, language)}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                         {c.allocations ? c.allocations.map(a => `${a.month} (৳${a.amount})`).join(', ') : formatMonths(c.coveredMonths || [], language)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          c.status === 'Approved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                          c.status === 'Void' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => setReceiptModal(c)} title="Print Receipt">
                            <Printer className="w-4 h-4 text-slate-500" />
                          </Button>
                          {c.status === 'Pending' && (
                            <>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                onClick={() => handleApprove(c.collectionId)}
                              >
                                Approve
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20"
                                onClick={() => handleVoid(c.collectionId)}
                              >
                                Void
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 ml-2"
                                onClick={() => handleEdit(c)}
                              >
                                Edit
                              </Button>
                            </>
                          )}
                          {c.status === 'Approved' && (
                             <Button 
                                variant="outline" 
                                size="sm"
                                className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20"
                                onClick={() => handleVoid(c.collectionId)}
                              >
                                Void
                              </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      {/* Printable Receipt Modal */}
      {receiptModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-2xl border-none">
            <CardContent className="p-8" id="printable-receipt">
              <div className="text-center mb-6">
                <div className="flex justify-center items-center gap-3 mb-2">
                  {settings?.logoUrl ? (
                    <img src={settings.logoUrl} alt="Logo" className="w-12 h-12 object-contain" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border-2 border-slate-900">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                    </div>
                  )}
                  <h1 className="text-3xl font-bold">{receiptLang === "bn" ? (settings?.madrasaNameBn || settings?.madrasaName || "মাদ্রাসাতুল মদিনা") : (settings?.madrasaName || "Madrasa Name")}</h1>
                </div>
                <p className="text-sm mb-1">{receiptLang === "bn" ? (settings?.addressBn || settings?.address || "ঢাকা, বাংলাদেশ") : (settings?.address || "Address")}</p>
                {(settings?.phone || settings?.email) && (
                  <p className="text-xs mb-3">{settings?.phone} {settings?.phone && settings?.email ? '|' : ''} {settings?.email}</p>
                )}
                
                <h2 className="text-xl font-bold text-slate-900 mt-4 border-t-2 border-dashed pt-4">{receiptLang === "en" ? "Donation Receipt" : "মানি রসিদ"}</h2>
                <p className="text-slate-500">{receiptLang === "en" ? "Thank you for your generous contribution." : "আপনার দানের জন্য জাযাকাল্লাহ।"}</p>
              </div>
              
              <div className="space-y-4 text-sm">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500">{receiptLang === "en" ? "Receipt No:" : "রসিদ নং:"}</span>
                  <span className="font-medium">{receiptModal.receiptNumber}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500">{receiptLang === "en" ? "Date:" : "তারিখ:"}</span>
                  <span className="font-medium">{formatDate(receiptModal.paymentDate, language)}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500">{receiptLang === "en" ? "Donor Name:" : "দাতার নাম:"}</span>
                  <span className="font-medium">{receiptLang === "bn" && (receiptModal as any).donorNameBn ? (receiptModal as any).donorNameBn : receiptModal.donorName}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500">{receiptLang === "en" ? "Amount Received:" : "জমা পরিমাণ:"}</span>
                  <span className="font-bold text-lg">{formatCurrency(receiptModal.paymentAmount, language)}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500">{receiptLang === "en" ? "Payment Method:" : "পেমেন্ট মাধ্যম:"}</span>
                  <span className="font-medium">{receiptModal.paymentMethod}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500">{receiptLang === "en" ? "Covered Months:" : "প্রদত্ত মাস:"}</span>
                  <span className="font-medium">{receiptModal.allocations ? receiptModal.allocations.map(a => `${a.month} (৳${a.amount})`).join(', ') : formatMonths(receiptModal.coveredMonths || [], receiptLang)}</span>
                </div>
              </div>
              
              <div className="mt-8 pt-4 flex gap-3 justify-end items-center hide-on-print">
                <select 
                  value={receiptLang}
                  onChange={e => setReceiptLang(e.target.value as 'en'|'bn')}
                  className="h-10 px-3 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="bn">বাংলা</option>
                  <option value="en">English</option>
                </select>
                <Button type="button" variant="outline" onClick={() => setReceiptModal(null)}>
                  Close
                </Button>
                <Button 
                  onClick={() => {
                    const printContents = document.getElementById('printable-receipt')?.innerHTML;
                    const originalContents = document.body.innerHTML;
                    if(printContents) {
                      document.body.innerHTML = `<div class="p-8 max-w-md mx-auto">${printContents}</div>`;
                      window.print();
                      document.body.innerHTML = originalContents;
                      window.location.reload(); 
                    }
                  }} 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                >
                  <Printer className="w-4 h-4" /> Print
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-2xl border-none">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800">
              <CardTitle>{editingCol ? 'Correct Transaction' : 'Manual Collection Entry'}</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Donor</label>
                  <Select required value={formData.donorId} onChange={e => setFormData({...formData, donorId: e.target.value})}>
                    <option value="">Select Donor</option>
                    {donorsList.map(d => <option key={d.donorId} value={d.donorId}>{d.donorName}</option>)}
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Amount (৳)</label>
                  <Input required type="number" min="1" value={formData.paymentAmount || ''} onChange={e => setFormData({...formData, paymentAmount: Number(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date</label>
                  <Input required type="date" value={formData.paymentDate} onChange={e => setFormData({...formData, paymentDate: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Payment Method</label>
                  <Select required value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})}>
                    <option value="Cash">Cash</option>
                    <option value="Bkash">Bkash</option>
                    <option value="Bank">Bank Transfer</option>
                  </Select>
                </div>
                <div className="pt-4 flex gap-3 justify-end">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">{editingCol ? 'Confirm Correction' : 'Save Approved Entry'}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
