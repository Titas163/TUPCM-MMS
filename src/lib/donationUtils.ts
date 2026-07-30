import { Donor, DonationCollection } from '../types';

export interface MonthLedger {
  month: string; // YYYY-MM
  expected: number;
  paid: number;
  status: 'Paid' | 'Partial' | 'Due' | 'Advance';
}

export function generateLedger(
  donor: Donor,
  collections: DonationCollection[],
  startMonth: string,
  endMonth: string
): MonthLedger[] {
  // Sort amount history
  const history = [...(donor.amountHistory || [])].sort((a, b) => a.effectiveFromMonth.localeCompare(b.effectiveFromMonth));
  
  const getExpectedAmount = (month: string) => {
    let expected = donor.monthlyDonation; // default
    if (history.length > 0) {
      // Find the latest history entry before or equal to this month
      const applicable = history.slice().reverse().find(h => h.effectiveFromMonth <= month);
      if (applicable) expected = applicable.amount;
    }
    return expected;
  };

  // Group payments by month
  const paymentsByMonth: Record<string, number> = {};
  
  // Distribute payments across covered months evenly or just sequentially?
  // If a payment covers ["2026-07", "2026-08"] and amount is 300, how to distribute?
  // A sensible approach: if N months are covered, and amount is X, distribute sequentially based on expected amounts, or divide evenly.
  // Actually, standard practice: we just tally total paid for that month. Wait, the collection HAS a paymentAmount and coveredMonths[].
  // If donor pays 100 but expected is 200, and selects "2026-07", we just put 100 in 2026-07.
  // If donor pays 300 and selects "2026-07" and "2026-08", expected is 200. First month gets 200, second gets 100.
  
  collections.filter(c => c.status !== 'Void' && !c.isDeleted).forEach(col => {
    let remainingAmount = col.paymentAmount;
    const sortedCovered = [...col.coveredMonths].sort();
    
    // First pass: try to fulfill expected amount for each selected month
    for (const m of sortedCovered) {
      if (remainingAmount <= 0) break;
      const expected = getExpectedAmount(m);
      const currentlyPaid = paymentsByMonth[m] || 0;
      const needed = Math.max(0, expected - currentlyPaid);
      
      const allocate = Math.min(needed, remainingAmount);
      if (allocate > 0) {
        paymentsByMonth[m] = (paymentsByMonth[m] || 0) + allocate;
        remainingAmount -= allocate;
      }
    }
    
    // Second pass: if there's still remaining amount, distribute it evenly or just dump it into the last month
    if (remainingAmount > 0 && sortedCovered.length > 0) {
      const lastMonth = sortedCovered[sortedCovered.length - 1];
      paymentsByMonth[lastMonth] = (paymentsByMonth[lastMonth] || 0) + remainingAmount;
    }
  });

  const ledger: MonthLedger[] = [];
  let curr = startMonth;
  while (curr <= endMonth) {
    const expected = getExpectedAmount(curr);
    const paid = paymentsByMonth[curr] || 0;
    
    let status: 'Paid' | 'Partial' | 'Due' | 'Advance' = 'Due';
    if (paid >= expected) {
      // If it's a future month, maybe it's advance?
      // "Future months may be marked as Advance." We can determine that outside based on current actual month,
      // but let's just mark it 'Paid' and let the caller refine to 'Advance' if month > currentMonth.
      status = 'Paid'; 
    } else if (paid > 0) {
      status = 'Partial';
    }

    ledger.push({
      month: curr,
      expected,
      paid,
      status
    });
    
    // Next month
    let [y, m] = curr.split('-').map(Number);
    m++;
    if (m > 12) { m = 1; y++; }
    curr = `${y}-${m.toString().padStart(2, '0')}`;
  }

  return ledger;
}

export function getCurrentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}




export interface DonorSummary {
  totalDue: number;
  totalAdvance: number;
  totalPaid: number;
  totalPending: number;
  status: 'Paid' | 'Due' | 'Partial' | 'Advance';
}

export function calculateDonorSummary(donor: Donor, collections: DonationCollection[]): DonorSummary {
  const currentMonthStr = getCurrentMonthStr();
  const startMonth = donor.joinMonth || currentMonthStr; 
  
  const endYear = (parseInt(currentMonthStr.split('-')[0]) + 1).toString() + '-12';
  
  // We need to treat 'Pending' collections as NOT paid for the core ledger, 
  // but we should tally them to show totalPending.
  const approvedCols = collections.filter(c => c.status === 'Approved');
  const pendingCols = collections.filter(c => c.status === 'Pending');
  
  const fullLedger = generateLedger(donor, approvedCols, startMonth, endYear);
  
  let totalDue = 0;
  let totalAdvance = 0;
  let totalPaid = 0;
  
  fullLedger.forEach(l => {
    totalPaid += l.paid;
    if (l.month <= currentMonthStr) {
      if (l.expected > l.paid) {
        totalDue += (l.expected - l.paid);
      }
    } else {
      totalAdvance += l.paid;
    }
  });
  
  let totalPending = pendingCols.reduce((sum, c) => sum + c.paymentAmount, 0);
  
  
  // Adjust Due if there is pending
  let displayDue = Math.max(0, totalDue - totalPending);

  
  let status: 'Paid' | 'Due' | 'Partial' | 'Advance' = 'Paid';
  if (displayDue > 0) {
    status = 'Due';
  } else if (totalAdvance > 0) {
    status = 'Advance';
  }
  
  return {
    totalDue: displayDue,
    totalAdvance,
    totalPaid,
    totalPending,
    status
  };
}

