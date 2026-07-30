import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAppStore } from '../../store';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { DeleteButton } from '../../components/ui/DeleteButton';
import { Search, Plus, Edit2, Wallet, ArrowDownRight, ArrowUpRight, DollarSign, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { DonationCollection } from '../../types';

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  date: number;
  description: string;
  recordedBy: string;
  isDonation?: boolean; // flag for auto-generated transactions from donations
  receiptNumber?: string;
}

export function FundManagement() {
  const { t } = useTranslation();
  const { user } = useAppStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    type: 'income',
    category: 'Other',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    description: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch manual transactions
      const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
      const snapshot = await getDocs(q);
      const manualData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Transaction));
      
      // 2. Fetch approved donations
      const dq = query(collection(db, 'donationCollections'), where('status', '==', 'Approved'));
      const dSnap = await getDocs(dq);
      const donationsData = dSnap.docs.map(doc => {
        const d = { ...doc.data(), collectionId: doc.id } as DonationCollection;
        return {
          id: d.collectionId,
          type: 'income' as const,
          category: 'Donation',
          amount: d.paymentAmount,
          date: d.paymentDate,
          description: `Donation via ${d.paymentMethod} (Months: ${d.coveredMonths.join(', ') || 'N/A'})`,
          recordedBy: d.teacherId,
          isDonation: true,
          receiptNumber: d.receiptNumber
        };
      });

      // Combine and sort by date descending
      const combined = [...manualData, ...donationsData].sort((a, b) => b.date - a.date);
      setTransactions(combined);
    } catch (error) {
      console.error("Error fetching transactions", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (trx?: Transaction) => {
    if (trx) {
      if (trx.isDonation) return; // Cannot edit donation here
      setEditingId(trx.id);
      setFormData({
        type: trx.type,
        category: trx.category,
        amount: trx.amount.toString(),
        date: format(new Date(trx.date), 'yyyy-MM-dd'),
        description: trx.description
      });
    } else {
      setEditingId(null);
      setFormData({
        type: 'income',
        category: 'Other',
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        description: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, isDonation?: boolean) => {
    if (isDonation) {
      alert("Donations must be voided from the Donations module.");
      return;
    }
    try {
      await deleteDoc(doc(db, 'transactions', id));
      fetchData();
    } catch (error) {
      console.error("Error deleting transaction", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const trxData = {
        type: formData.type,
        category: formData.category,
        amount: Number(formData.amount),
        date: new Date(formData.date).getTime(),
        description: formData.description,
        recordedBy: user?.uid || 'admin',
      };

      if (editingId) {
        await updateDoc(doc(db, 'transactions', editingId), trxData);
      } else {
        await addDoc(collection(db, 'transactions'), trxData);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error saving transaction", error);
    }
  };

  const filtered = transactions.filter(t => 
    t.description.toLowerCase().includes(search.toLowerCase()) || 
    t.category.toLowerCase().includes(search.toLowerCase()) ||
    t.receiptNumber?.toLowerCase().includes(search.toLowerCase())
  );

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const balance = totalIncome - totalExpense;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Fund Management</h1>
          <p className="text-sm text-slate-500">Cash Flow Book (Manual Transactions + Approved Donations)</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
          <Plus className="w-4 h-4" />
          Add Transaction
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Total Income</p>
                <h3 className="text-3xl font-bold text-emerald-700 dark:text-emerald-300 mt-2">৳ {totalIncome}</h3>
              </div>
              <div className="p-3 bg-emerald-100 dark:bg-emerald-800 rounded-full">
                <ArrowDownRight className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-red-600 dark:text-red-400">Total Expense</p>
                <h3 className="text-3xl font-bold text-red-700 dark:text-red-300 mt-2">৳ {totalExpense}</h3>
              </div>
              <div className="p-3 bg-red-100 dark:bg-red-800 rounded-full">
                <ArrowUpRight className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Net Balance</p>
                <h3 className="text-3xl font-bold text-indigo-700 dark:text-indigo-300 mt-2">৳ {balance}</h3>
              </div>
              <div className="p-3 bg-indigo-100 dark:bg-indigo-800 rounded-full">
                <Wallet className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-md dark:bg-slate-900">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search transactions..." 
              className="pl-9 bg-slate-50 dark:bg-slate-950"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Category / Receipt</th>
                  <th className="px-6 py-4 font-medium">Description</th>
                  <th className="px-6 py-4 font-medium">Amount</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">Loading...</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">No transactions found</td>
                  </tr>
                ) : (
                  filtered.map((trx) => (
                    <tr key={trx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        {format(new Date(trx.date), 'dd MMM yyyy')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          trx.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {trx.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {trx.isDonation ? (
                           <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium">
                             <FileText className="w-3.5 h-3.5" />
                             {trx.receiptNumber}
                           </span>
                        ) : (
                          trx.category
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {trx.description}
                      </td>
                      <td className={`px-6 py-4 font-bold ${trx.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {trx.type === 'income' ? '+' : '-'} ৳ {trx.amount}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {!trx.isDonation && (
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenModal(trx)} title="Edit">
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <DeleteButton onConfirm={() => handleDelete(trx.id, trx.isDonation)} />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal for Manual Transactions */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-xl border-none">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800">
              <CardTitle>{editingId ? 'Edit Transaction' : 'Add Manual Transaction'}</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Type</label>
                    <Select 
                      value={formData.type}
                      onChange={e => setFormData({...formData, type: e.target.value as any})}
                    >
                      <option value="income">Income</option>
                      <option value="expense">Expense</option>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date <span className="text-red-500">*</span></label>
                    <Input 
                      type="date"
                      required 
                      value={formData.date}
                      onChange={e => setFormData({...formData, date: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select 
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                  >
                    {formData.type === 'income' ? (
                      <>
                        <option value="Other">Other</option>
                        <option value="Zakat">Zakat</option>
                        <option value="Sadaqah">Sadaqah</option>
                      </>
                    ) : (
                      <>
                        <option value="Salary">Salary</option>
                        <option value="Utility">Utility</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Event">Event</option>
                        <option value="Other">Other</option>
                      </>
                    )}
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Amount <span className="text-red-500">*</span></label>
                  <Input 
                    type="number"
                    required
                    min="1"
                    value={formData.amount}
                    onChange={e => setFormData({...formData, amount: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Input 
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    placeholder="Short details..."
                  />
                </div>

                <div className="pt-4 flex gap-3 justify-end">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    Save
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
