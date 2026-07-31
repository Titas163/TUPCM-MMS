import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Donor, Teacher, DonorAmountHistory } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DeleteButton } from '../../components/ui/DeleteButton';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Search, Plus, Edit2, Eye } from 'lucide-react';
import { DonorDetailsView } from '../../components/admin/DonorDetailsView';
import { formatCurrency } from '../../lib/utils';
import { useAppStore } from '../../store';
import { getCurrentMonthStr } from '../../lib/donationUtils';

export function Donors() {
  const { t } = useTranslation();
  const { language } = useAppStore();
  const [donors, setDonors] = useState<(Donor & { teacherName?: string })[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDonorForDetails, setSelectedDonorForDetails] = useState<(Donor & { teacherName?: string }) | null>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDonor, setEditingDonor] = useState<Donor | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    donorName: '',
    donorNameBn: '',
    mobile: '',
    address: '',
    monthlyDonation: 0,
    assignedTeacher: '',
    status: 'active' as 'active' | 'inactive',
    effectiveFromMonth: getCurrentMonthStr(), // For new donors, it starts now
    joinMonth: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const teacherSnapshot = await getDocs(query(collection(db, 'teachers')));
      const teacherData = teacherSnapshot.docs.map(doc => ({ ...doc.data(), teacherId: doc.id } as Teacher));
      setTeachers(teacherData);

      const q = query(collection(db, 'donors'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => {
        const d = { ...doc.data(), donorId: doc.id } as Donor;
        const teacher = teacherData.find(t => t.teacherId === d.assignedTeacher);
        return { ...d, teacherName: teacher?.teacherName || 'Unassigned' };
      });
      setDonors(data);
    } catch (error) {
      console.error("Error fetching data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (d?: Donor & { teacherName?: string }) => {
    if (d) {
      setEditingDonor(d);
      setFormData({
        donorName: d.donorName,
        donorNameBn: (d as any).donorNameBn || '',
        mobile: d.mobile || '',
        address: d.address || '',
        monthlyDonation: d.monthlyDonation,
        assignedTeacher: d.assignedTeacher,
        status: d.status,
        effectiveFromMonth: getCurrentMonthStr(),
        joinMonth: d.joinMonth || ''
      });
    } else {
      setEditingDonor(null);
      setFormData({
        donorName: '',
        donorNameBn: '',
        mobile: '',
        address: '',
        monthlyDonation: 0,
        assignedTeacher: teachers.length > 0 ? teachers[0].teacherId : '',
        status: 'active',
        effectiveFromMonth: getCurrentMonthStr(),
        joinMonth: getCurrentMonthStr()
      });
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'donors', id));
      fetchData();
    } catch (error) {
      console.error("Error deleting donor", error);
      alert('An error occurred while deleting the donor.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const numAmount = Number(formData.monthlyDonation);
      if (editingDonor) {
        let newHistory = editingDonor.amountHistory || [];
        // If amount changed, add to history
        if (editingDonor.monthlyDonation !== numAmount) {
          // Check if there is already an entry for this month
          const existingIdx = newHistory.findIndex(h => h.effectiveFromMonth === formData.effectiveFromMonth);
          if (existingIdx >= 0) {
            newHistory[existingIdx].amount = numAmount;
          } else {
            newHistory.push({
              amount: numAmount,
              effectiveFromMonth: formData.effectiveFromMonth
            });
          }
        }
        
        await updateDoc(doc(db, 'donors', editingDonor.donorId), {
          donorName: formData.donorName,
          donorNameBn: formData.donorNameBn,
          mobile: formData.mobile,
          address: formData.address,
          monthlyDonation: numAmount,
          joinMonth: formData.joinMonth || editingDonor.joinMonth,
          assignedTeacher: formData.assignedTeacher,
          status: formData.status,
          amountHistory: newHistory,
          updatedAt: Date.now()
        });
      } else {
        const newDonor = {
          donorName: formData.donorName,
          donorNameBn: formData.donorNameBn,
          mobile: formData.mobile,
          address: formData.address,
          monthlyDonation: numAmount,
          assignedTeacher: formData.assignedTeacher,
          status: formData.status,
          joinMonth: formData.effectiveFromMonth,
          amountHistory: [{
            amount: numAmount,
            effectiveFromMonth: formData.effectiveFromMonth
          }],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        await addDoc(collection(db, 'donors'), newDonor);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error saving donor", error);
    }
  };

  const filteredDonors = donors.filter(d => 
    d.donorName.toLowerCase().includes(search.toLowerCase()) || 
    (d.mobile && d.mobile.includes(search))
  );

  if (selectedDonorForDetails) {
    return <DonorDetailsView donor={selectedDonorForDetails} onBack={() => setSelectedDonorForDetails(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {t.donors || 'Donors'}
        </h1>
        <Button onClick={() => handleOpenModal()} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
          <Plus className="w-4 h-4" />
          {t.add || 'Add Donor'}
        </Button>
      </div>

      <Card className="border-none shadow-md dark:bg-slate-900">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder={t.search || 'Search donors...'} 
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
                  <th className="px-6 py-4 font-medium">{t.name || 'Name'}</th>
                  <th className="px-6 py-4 font-medium">{t.mobile || 'Mobile'}</th>
                  <th className="px-6 py-4 font-medium">{t.teachers || 'Assigned Teacher'}</th>
                  <th className="px-6 py-4 font-medium">{t.amount || 'Monthly Donation'}</th>
                  <th className="px-6 py-4 font-medium">{t.status || 'Status'}</th>
                  <th className="px-6 py-4 font-medium text-right">{t.action || 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                      Loading...
                    </td>
                  </tr>
                ) : filteredDonors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                      No donors found
                    </td>
                  </tr>
                ) : (
                  filteredDonors.map((d) => (
                    <tr key={d.donorId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        {language === 'bn' && (d as any).donorNameBn ? (d as any).donorNameBn : d.donorName}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {d.mobile || '-'}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {d.teacherName}
                      </td>
                      <td className="px-6 py-4 text-slate-900 dark:text-white font-medium">
                        {formatCurrency(d.monthlyDonation, language)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          d.status === 'active' 
                             ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {d.status === 'active' ? t.active || 'Active' : t.inactive || 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenModal(d)} title="Edit">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setSelectedDonorForDetails(d)} title="View Details">
                            <Eye className="w-4 h-4 text-indigo-500" />
                          </Button>
                          <DeleteButton onConfirm={() => handleDelete(d.donorId)} />
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-xl border-none">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800">
              <CardTitle>{editingDonor ? 'Edit Donor' : 'Add New Donor'}</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t.name || 'Donor Name'} <span className="text-red-500">*</span></label>
                    <Input 
                      required 
                      value={formData.donorName}
                      onChange={e => setFormData({...formData, donorName: e.target.value})}
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Name (Bangla)</label>
                    <Input 
                      value={formData.donorNameBn}
                      onChange={e => setFormData({...formData, donorNameBn: e.target.value})}
                      placeholder="উদাঃ জন ডো"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t.mobile || 'Mobile'}</label>
                    <Input 
                      value={formData.mobile}
                      onChange={e => setFormData({...formData, mobile: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t.amount || 'Monthly Donation'} <span className="text-red-500">*</span></label>
                    <Input 
                      type="number"
                      required
                      min="0"
                      value={formData.monthlyDonation}
                      onChange={e => setFormData({...formData, monthlyDonation: Number(e.target.value)})}
                    />
                  </div>
                </div>
                
                {/* Only show Effective From if editing amount or adding new */}
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Starting Month (YYYY-MM) <span className="text-red-500">*</span></label>
                    <Input 
                      type="month"
                      required
                      value={formData.joinMonth}
                      onChange={e => setFormData({...formData, joinMonth: e.target.value})}
                    />
                    <p className="text-xs text-slate-500">When the donor started.</p>
                  </div>
                  {(!editingDonor || editingDonor.monthlyDonation !== Number(formData.monthlyDonation)) && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-indigo-600 dark:text-indigo-400">New Amount Effective Month</label>
                      <Input 
                        type="month"
                        required
                        value={formData.effectiveFromMonth}
                        onChange={e => setFormData({...formData, effectiveFromMonth: e.target.value})}
                      />
                      <p className="text-xs text-slate-500">Only affects future.</p>
                    </div>
                  )}
                </div>


                <div className="space-y-2">
                  <label className="text-sm font-medium">{t.teachers || 'Assigned Teacher'} <span className="text-red-500">*</span></label>
                  <Select 
                    required 
                    value={formData.assignedTeacher}
                    onChange={e => setFormData({...formData, assignedTeacher: e.target.value})}
                  >
                    <option value="" disabled>Select Teacher</option>
                    {teachers.map(t => (
                      <option key={t.teacherId} value={t.teacherId}>{t.teacherName}</option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t.status || 'Status'}</label>
                  <Select 
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value as any})}
                  >
                    <option value="active">{t.active || 'Active'}</option>
                    <option value="inactive">{t.inactive || 'Inactive'}</option>
                  </Select>
                </div>

                <div className="pt-4 flex gap-3 justify-end">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                    {t.cancel || 'Cancel'}
                  </Button>
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    {t.save || 'Save'}
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
