import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { collection, getDocs, addDoc, updateDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Donor, DonationCollection } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Search, Plus, Calendar as CalendarIcon, CheckCircle, Clock, Edit2, XCircle, Printer } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/utils';
import { useAppStore } from '../../store';
import { generateLedger, MonthLedger, calculateDonorSummary, DonorSummary } from '../../lib/donationUtils';

// Helper to generate a sequential or random receipt number
const generateReceiptNumber = () => {
  return `REC-${new Date().getFullYear()}${(new Date().getMonth()+1).toString().padStart(2,'0')}-${Math.floor(Math.random() * 9000 + 1000)}`;
};

export function TeacherDonations() {
  const { t } = useTranslation();
  const { language, user, settings } = useAppStore();
  const [donors, setDonors] = useState<Donor[]>([]);
  const [collectionsData, setCollectionsData] = useState<DonationCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [teacherId, setTeacherId] = useState<string>('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDonor, setSelectedDonor] = useState<string>('');
  const [editingCollection, setEditingCollection] = useState<DonationCollection | null>(null);
  
  // Receipt Modal state
  const [receiptModal, setReceiptModal] = useState<DonationCollection | null>(null);
  const [receiptLang, setReceiptLang] = useState<'en'|'bn'>(language || 'bn');
  const [donorMap, setDonorMap] = useState<Record<string, Donor>>({});

  // Ledger state for selected donor
  const [donorLedger, setDonorLedger] = useState<MonthLedger[]>([]);
  const [donorSummary, setDonorSummary] = useState<DonorSummary | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    paymentAmount: 0,
    coveredMonths: [] as string[],
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'Cash',
    note: ''
  });

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const teacherSnapshot = await getDocs(query(collection(db, 'teachers'), where('email', '==', user.email)));
      if (teacherSnapshot.empty) {
        setLoading(false);
        return;
      }
      const tId = teacherSnapshot.docs[0].id;
      setTeacherId(tId);

      const dQuery = query(collection(db, 'donors'), where('assignedTeacher', '==', tId));
      const dSnapshot = await getDocs(dQuery);
      const dData = dSnapshot.docs.map(d => ({ ...d.data(), donorId: d.id } as Donor));
      setDonors(dData);

      const dMap: Record<string, Donor> = {};
      dData.forEach(d => dMap[d.donorId] = d);
      setDonorMap(dMap);

      const cQuery = query(collection(db, 'donationCollections'), where('teacherId', '==', tId));
      const cSnapshot = await getDocs(cQuery);
      const cData = cSnapshot.docs.map(c => ({ ...c.data(), collectionId: c.id } as DonationCollection));
      // Sort locally by date descending
      cData.sort((a,b) => b.paymentDate - a.paymentDate);
      setCollectionsData(cData);
      
    } catch (error) {
      console.error("Error fetching data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  
  useEffect(() => {
    if (selectedDonor) {
      const donor = donors.find(d => d.donorId === selectedDonor);
      if (donor) {
        const dCols = collectionsData.filter(c => c.donorId === selectedDonor);
        const start = donor.joinMonth || `${new Date().getFullYear()}-01`;
        let endYear = new Date().getFullYear();
        if (editingCollection) {
          editingCollection.coveredMonths.forEach(m => {
            const y = parseInt(m.split('-')[0]);
            if (y > endYear) endYear = y;
          });
        } else {
           endYear += 1;
        }
        const end = `${endYear}-12`;
        
        const activeCols = editingCollection 
          ? dCols.filter(c => c.collectionId !== editingCollection.collectionId)
          : dCols;

        const ledger = generateLedger(donor, activeCols, start, end);
        setDonorLedger(ledger);
        setDonorSummary(calculateDonorSummary(donor, activeCols));
      }
    } else {
      setDonorLedger([]);
      setDonorSummary(null);
    }
  }, [selectedDonor, donors, collectionsData, editingCollection]);


  const handleOpenModal = (col?: DonationCollection) => {
    if (col) {
      setEditingCollection(col);
      setSelectedDonor(col.donorId);
      setFormData({
        paymentAmount: col.paymentAmount,
        coveredMonths: col.coveredMonths || [],
        paymentDate: new Date(col.paymentDate).toISOString().split('T')[0],
        paymentMethod: col.paymentMethod || 'Cash',
        note: col.note || ''
      });
    } else {
      setEditingCollection(null);
      setSelectedDonor('');
      setFormData({
        paymentAmount: 0,
        coveredMonths: [],
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'Cash',
        note: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleToggleMonth = (month: string) => {
    setFormData(prev => {
      const current = prev.coveredMonths;
      let newMonths;
      if (current.includes(month)) {
        newMonths = current.filter(m => m !== month);
      } else {
        newMonths = [...current, month].sort();
      }
      
      let sum = 0;
      newMonths.forEach(m => {
        const item = donorLedger.find(l => l.month === m);
        if (item) {
          sum += Math.max(0, item.expected - item.paid);
        }
      });

      return { 
        ...prev, 
        coveredMonths: newMonths,
        paymentAmount: sum > 0 || newMonths.length > 0 ? sum : 0
      };
    });
  };
  
  const handleSelectAllDue = () => {
    const dueMonths = donorLedger.filter(l => l.status === 'Due' || l.status === 'Partial');
    let sum = 0;
    const months = dueMonths.map(l => {
      sum += Math.max(0, l.expected - l.paid);
      return l.month;
    });
    setFormData(prev => ({
      ...prev,
      coveredMonths: months,
      paymentAmount: sum
    }));
  };

  const handleVoid = async (col: DonationCollection) => {
    if (col.status === 'Approved') {
      alert("Cannot void an approved collection.");
      return;
    }
    {
      try {
        await updateDoc(doc(db, 'donationCollections', col.collectionId), {
          status: 'Void',
          isDeleted: true,
          updatedAt: Date.now()
        });
        fetchData();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDonor) return;
    
    // Duplicate check
    const isDuplicate = collectionsData.some(c => 
      c.donorId === selectedDonor &&
      c.paymentAmount === formData.paymentAmount &&
      new Date(c.paymentDate).toISOString().split('T')[0] === formData.paymentDate &&
      c.status !== 'Void' && !c.isDeleted &&
      c.collectionId !== (editingCollection?.collectionId || '')
    );

    if (isDuplicate) {
      
    }

    try {
      const paymentDateNum = new Date(formData.paymentDate).getTime();
      
      if (editingCollection) {
        await updateDoc(doc(db, 'donationCollections', editingCollection.collectionId), {
          ...formData,
          paymentDate: paymentDateNum,
          updatedAt: Date.now()
        });
      } else {
        const newCol: Omit<DonationCollection, 'collectionId'> = {
          receiptNumber: generateReceiptNumber(),
          teacherId,
          donorId: selectedDonor,
          paymentAmount: Number(formData.paymentAmount),
          coveredMonths: formData.coveredMonths,
          paymentDate: paymentDateNum,
          paymentMethod: formData.paymentMethod,
          note: formData.note,
          status: 'Pending',
          submittedAt: Date.now(),
          createdAt: Date.now()
        };
        await addDoc(collection(db, 'donationCollections'), newCol);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error saving donation", error);
    }
  };

  const filteredCols = collectionsData.filter(c => !c.isDeleted);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          My Collections
        </h1>
        <Button onClick={() => handleOpenModal()} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
          <Plus className="w-4 h-4" />
          Record Payment
        </Button>
      </div>

      <Card className="border-none shadow-md dark:bg-slate-900">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Receipt</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Donor</th>
                  <th className="px-6 py-4 font-medium">Amount</th>
                  <th className="px-6 py-4 font-medium">Covered Months</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                      Loading...
                    </td>
                  </tr>
                ) : filteredCols.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                      No collections recorded yet.
                    </td>
                  </tr>
                ) : (
                  filteredCols.map((c) => (
                    <tr key={c.collectionId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        {c.receiptNumber}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {formatDate(c.paymentDate, language)}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        {donorMap[c.donorId]?.donorName || 'Unknown Donor'}
                      </td>
                      <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-bold">
                        {formatCurrency(c.paymentAmount, language)}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {c.coveredMonths?.join(', ') || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          c.status === 'Approved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                          c.status === 'Void' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}>
                          {c.status === 'Approved' && <CheckCircle className="w-3.5 h-3.5" />}
                          {c.status === 'Pending' && <Clock className="w-3.5 h-3.5" />}
                          {c.status === 'Void' && <XCircle className="w-3.5 h-3.5" />}
                          {c.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => setReceiptModal(c)} title="Print Receipt">
                            <Printer className="w-4 h-4 text-slate-500" />
                          </Button>
                          {c.status !== 'Approved' && c.status !== 'Void' && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => handleOpenModal(c)} title="Edit">
                                <Edit2 className="w-4 h-4 text-indigo-500" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleVoid(c)} title="Void">
                                <XCircle className="w-4 h-4 text-red-500" />
                              </Button>
                            </>
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

      {/* Record Payment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <Card className="w-full max-w-2xl shadow-xl border-none my-8">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 sticky top-0 z-10">
              <CardTitle>{editingCollection ? 'Edit Payment' : 'Record Payment'}</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: Form Fields */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Select Donor <span className="text-red-500">*</span></label>
                      <Select 
                        required 
                        value={selectedDonor}
                        onChange={e => setSelectedDonor(e.target.value)}
                        disabled={!!editingCollection}
                      >
                        <option value="" disabled>Select a donor</option>
                        {donors.map(d => (
                          <option key={d.donorId} value={d.donorId}>{d.donorName} ({formatCurrency(d.monthlyDonation, language)}/mo)</option>
                        ))}
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Payment Date <span className="text-red-500">*</span></label>
                      <Input 
                        type="date"
                        required 
                        value={formData.paymentDate}
                        onChange={e => setFormData({...formData, paymentDate: e.target.value})}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Amount Received <span className="text-red-500">*</span></label>
                      <Input 
                        type="number"
                        min="0"
                        required 
                        value={formData.paymentAmount}
                        onChange={e => setFormData({...formData, paymentAmount: Number(e.target.value)})}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Payment Method</label>
                      <Select 
                        value={formData.paymentMethod}
                        onChange={e => setFormData({...formData, paymentMethod: e.target.value})}
                      >
                        <option value="Cash">Cash</option>
                        <option value="Bkash">Bkash</option>
                        <option value="Bank">Bank Transfer</option>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Note</label>
                      <Input 
                        value={formData.note}
                        onChange={e => setFormData({...formData, note: e.target.value})}
                        placeholder="Optional note"
                      />
                    </div>
                  </div>
                  
                  {/* Right Column: Ledger Preview & Month Selection */}
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-800 flex flex-col h-full">
                    {selectedDonor && donorSummary && (
                      <div className="mb-4 bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                        <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-sm font-medium text-slate-500">Current Status</span>
                          <span className={`text-xs font-bold px-2 py-1 rounded ${donorSummary.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : donorSummary.status === 'Advance' ? 'bg-indigo-100 text-indigo-800' : 'bg-red-100 text-red-800'}`}>
                            {donorSummary.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded">
                            <div className="text-xs text-red-600 dark:text-red-400 font-medium">Total Due</div>
                            <div className="text-lg font-bold text-red-700 dark:text-red-300">৳ {donorSummary.totalDue}</div>
                          </div>
                          <div className="bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                            <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">Pending</div>
                            <div className="text-lg font-bold text-amber-700 dark:text-amber-300">৳ {donorSummary.totalPending}</div>
                          </div>
                          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded">
                            <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Advance</div>
                            <div className="text-lg font-bold text-indigo-700 dark:text-indigo-300">৳ {donorSummary.totalAdvance}</div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Ledger / Months</h3>
                      <Button type="button" variant="outline" size="sm" onClick={handleSelectAllDue} className="h-7 text-xs">Select All Due</Button>
                    </div>
                    {selectedDonor ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                        {donorLedger.map((l) => (
                          <div key={l.month} className="flex items-center justify-between bg-white dark:bg-slate-950 p-2 rounded border border-slate-100 dark:border-slate-800">
                            <label className="flex items-center gap-2 cursor-pointer flex-1">
                              <input 
                                type="checkbox" 
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                                checked={formData.coveredMonths.includes(l.month)}
                                onChange={() => handleToggleMonth(l.month)}
                              />
                              <span className="text-sm font-medium">{l.month}</span>
                            </label>
                            <div className="text-right flex items-center gap-2">
                              <span className="text-xs text-slate-500">{l.paid}/{l.expected}</span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                l.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                                l.status === 'Partial' ? 'bg-amber-100 text-amber-800' :
                                'bg-red-100 text-red-800'
                              }`}>{l.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-8">Select a donor to view their ledger.</p>
                    )}
                  </div>
                </div>

                <div className="pt-4 flex gap-3 justify-end border-t border-slate-100 dark:border-slate-800">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    {editingCollection ? 'Update Payment' : 'Save Payment'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

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
                  <h1 className="text-3xl font-bold">{settings?.madrasaName || 'Madrasa Name'}</h1>
                </div>
                <p className="text-sm mb-1">{settings?.address}</p>
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
                  <span className="font-medium">{donorMap[receiptModal.donorId]?.donorName}</span>
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
                  <span className="font-medium">{receiptModal.coveredMonths?.join(', ') || '-'}</span>
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
                    // Simple print logic
                    const printContents = document.getElementById('printable-receipt')?.innerHTML;
                    const originalContents = document.body.innerHTML;
                    if(printContents) {
                      document.body.innerHTML = `<div class="p-8 max-w-md mx-auto">${printContents}</div>`;
                      window.print();
                      document.body.innerHTML = originalContents;
                      window.location.reload(); // Quick restore hack for SPA
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
    </div>
  );
}
