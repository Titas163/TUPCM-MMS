const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/pages/teacher/TeacherDonations.tsx');
let content = fs.readFileSync(file, 'utf8');

// Replace imports
content = content.replace(
  /import \{ Donor, DonationCollection \} from '\.\.\/\.\.\/types';/,
  "import { Donor, DonationCollection, DonationAllocation } from '../../types';"
);
content = content.replace(
  /import \{ generateLedger, MonthLedger, calculateDonorSummary, DonorSummary \} from '\.\.\/\.\.\/lib\/donationUtils';/,
  "import { generateLedger, MonthLedger, calculateDonorSummary, DonorSummary, calculateAllocation } from '../../lib/donationUtils';"
);

// Form state
content = content.replace(
  /coveredMonths: \[\] as string\[\],/,
  "allocations: [] as DonationAllocation[],"
);

// Toggle functions
content = content.replace(
  /const handleToggleMonth =[\s\S]*?};/,
  "// Removed handleToggleMonth"
);

content = content.replace(
  /const handleSelectAllDue =[\s\S]*?};/,
  "// Removed handleSelectAllDue"
);

// Editing collection populating
content = content.replace(
  /editingCollection\.coveredMonths\.forEach\(m => \{[\s\S]*?\}\);/g,
  ""
);

content = content.replace(
  /coveredMonths: col\.coveredMonths \|\| \[\],/g,
  "allocations: col.allocations || [],"
);

content = content.replace(
  /coveredMonths: \[\],/g,
  "allocations: [],"
);

// Allocation Effect
const allocationEffect = `
  useEffect(() => {
    if (selectedDonor && formData.paymentAmount > 0 && !editingCollection) {
      const donor = donors.find(d => d.donorId === selectedDonor);
      if (donor) {
        const alloc = calculateAllocation(donor, Number(formData.paymentAmount), collectionsData.filter(c => c.donorId === selectedDonor));
        setFormData(prev => ({ ...prev, allocations: alloc }));
      }
    } else if (formData.paymentAmount <= 0) {
      setFormData(prev => ({ ...prev, allocations: [] }));
    }
  }, [formData.paymentAmount, selectedDonor, donors, collectionsData, editingCollection]);
`;
// Insert before handleOpenModal
content = content.replace(/const handleOpenModal =/, allocationEffect + "\n  const handleOpenModal =");

// handleSubmit update
content = content.replace(
  /coveredMonths: formData\.coveredMonths,/g,
  "allocations: formData.allocations,"
);

// Replace Ledger UI
const oldLedgerStart = `<div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Ledger / Months</h3>
                      <Button type="button" variant="outline" size="sm" onClick={handleSelectAllDue} className="h-7 text-xs">Select All Due</Button>
                    </div>`;

const oldLedgerRegex = /<div className="flex justify-between items-center mb-3">[\s\S]*?<\/p>\n                    \)}/;
const newLedgerUI = `
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Automatic Allocation Preview</h3>
                    </div>
                    {selectedDonor ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                        {formData.allocations.length > 0 ? (
                           formData.allocations.map(a => (
                             <div key={a.month} className="flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded border border-indigo-100 dark:border-indigo-800">
                               <span className="font-medium text-indigo-900 dark:text-indigo-200">{a.month}</span>
                               <span className="font-bold text-indigo-700 dark:text-indigo-400">৳ {a.amount}</span>
                             </div>
                           ))
                        ) : (
                           <div className="text-sm text-slate-500 p-2">Enter amount to see allocation.</div>
                        )}
                        {formData.paymentAmount > 0 && formData.allocations.reduce((sum, a) => sum + a.amount, 0) < formData.paymentAmount && (
                            <div className="text-xs text-amber-600 mt-2 bg-amber-50 p-2 rounded">
                              Warning: Amount exceeds future expectations or cannot be fully allocated.
                            </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-8">Select a donor to view allocations.</p>
                    )}`;
content = content.replace(oldLedgerRegex, newLedgerUI);

// Replace formatMonths with allocations print
content = content.replace(
  /\{formatMonths\(c\.coveredMonths \|\| \[\], language\)\}/g,
  "{c.allocations ? c.allocations.map(a => `${a.month} (৳${a.amount})`).join(', ') : formatMonths(c.coveredMonths || [], language)}"
);
content = content.replace(
  /\{formatMonths\(receiptModal\.coveredMonths \|\| \[\], receiptLang\)\}/g,
  "{receiptModal.allocations ? receiptModal.allocations.map(a => `${a.month} (৳${a.amount})`).join(', ') : formatMonths(receiptModal.coveredMonths || [], receiptLang)}"
);

fs.writeFileSync(file, content);
