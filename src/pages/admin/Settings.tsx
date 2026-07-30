import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Settings as SettingsType } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Settings as SettingsIcon, Save } from 'lucide-react';
import { useAppStore } from '../../store';

export function Settings() {
  const { t } = useTranslation();
  const { setSettings: setGlobalSettings } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState<SettingsType>({
    madrasaName: '',
    madrasaNameBn: '',
    logoUrl: '',
    address: '',
    addressBn: '',
    phone: '',
    email: '',
    principalName: '',
    principalNameBn: '',
    reportHeader: '',
    reportFooter: '',
    defaultLanguage: 'bn',
    defaultTheme: 'light',
    donationMode: 'approval'
  });

  useEffect(() => {
    async function fetchSettings() {
      try {
        const docRef = doc(db, 'settings', 'global');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setFormData(docSnap.data() as SettingsType);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const docRef = doc(db, 'settings', 'global');
      await setDoc(docRef, formData);
      setGlobalSettings(formData);
      alert('Settings saved successfully!');
    } catch (error) {
      console.error("Error saving settings:", error);
      alert('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t.settings || 'System Settings'}
          </h1>
          <p className="text-sm text-slate-500">Configure global application preferences</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="border-none shadow-md dark:bg-slate-900">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-indigo-500" />
              General Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Madrasa Name <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  <Input name="madrasaName" value={formData.madrasaName} onChange={handleChange} required placeholder="English" />
                  <Input name="madrasaNameBn" value={formData.madrasaNameBn || ''} onChange={handleChange} placeholder="বাংলা" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Principal Name</label>
                <div className="grid grid-cols-2 gap-2">
                  <Input name="principalName" value={formData.principalName} onChange={handleChange} placeholder="English" />
                  <Input name="principalNameBn" value={formData.principalNameBn || ''} onChange={handleChange} placeholder="বাংলা" />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Phone</label>
                <Input 
                  name="phone" 
                  value={formData.phone} 
                  onChange={handleChange} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Email</label>
                <Input 
                  type="email"
                  name="email" 
                  value={formData.email} 
                  onChange={handleChange} 
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Address</label>
                <div className="grid grid-cols-2 gap-2">
                  <Input name="address" value={formData.address} onChange={handleChange} placeholder="English" />
                  <Input name="addressBn" value={formData.addressBn || ''} onChange={handleChange} placeholder="বাংলা" />
                </div>
              </div>
              
                            <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Madrasa Logo (URL or Upload)</label>
                <div className="flex gap-2 items-center">
                  <Input 
                    name="logoUrl" 
                    value={formData.logoUrl || ''} 
                    onChange={handleChange} 
                    placeholder="https://example.com/logo.png"
                    className="flex-1"
                  />
                  <div className="relative">
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 1024 * 1024) { // 1MB limit for firestore document size safety
                            alert('Image size should be less than 1MB');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setFormData(prev => ({ ...prev, logoUrl: reader.result as string }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <Button type="button" variant="outline" className="gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                      Upload
                    </Button>
                  </div>
                </div>
                {formData.logoUrl && (
                  <div className="mt-2 w-20 h-20 border rounded overflow-hidden">
                    <img src={formData.logoUrl} alt="Logo preview" className="w-full h-full object-contain" />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Report Header Text</label>
                <textarea 
                  name="reportHeader" 
                  value={formData.reportHeader} 
                  onChange={handleChange} 
                  className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:placeholder:text-slate-400 dark:focus:ring-indigo-400"
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Report Footer Text</label>
                <textarea 
                  name="reportFooter" 
                  value={formData.reportFooter} 
                  onChange={handleChange} 
                  className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:placeholder:text-slate-400 dark:focus:ring-indigo-400"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Default Language</label>
                <Select name="defaultLanguage" value={formData.defaultLanguage} onChange={handleChange}>
                  <option value="bn">Bengali (বাংলা)</option>
                  <option value="en">English</option>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Default Theme</label>
                <Select name="defaultTheme" value={formData.defaultTheme} onChange={handleChange}>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Donation Mode</label>
                <Select name="donationMode" value={formData.donationMode} onChange={handleChange}>
                  <option value="approval">Approval Required (Teachers submit, Admins approve)</option>
                  <option value="instant">Instant (Teachers collections are instantly approved)</option>
                </Select>
                <p className="text-xs text-slate-500 mt-1">If set to 'Instant', collections submitted by teachers will bypass the Pending state.</p>
              </div>

            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
