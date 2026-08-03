import { Donor, DonationCollection, DonationAllocation } from '../types';

export interface MonthLedger {
  month: string; // YYYY-MM
  expected: number;
  paid: number;
  status: 'Paid' | 'Partial' | 'Due' | 'Advance';
}

export function getCurrentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

export function getExpectedAmount(donor: Donor, month: string) {
  const history = [...(donor.amountHistory || [])].sort((a, b) => a.effectiveFromMonth.localeCompare(b.effectiveFromMonth));
  if (history.length > 0) {
    const applicable = history.slice().reverse().find(h => h.effectiveFromMonth <= month);
    if (applicable) return applicable.amount;
    // If month is before the first recorded history entry, assume the earliest known amount
    return history[0].amount;
  }
  return donor.monthlyDonation;
}

export function calculateAllocation(
  donor: Donor,
  amountToAllocate: number,
  existingCollections: DonationCollection[]
): DonationAllocation[] {
  const currentMonthStr = getCurrentMonthStr();
  const startMonth = donor.joinMonth || currentMonthStr;
  
  const approvedCols = existingCollections.filter(c => c.status === 'Approved' && !c.isDeleted);
  
  const paidPerMonth: Record<string, number> = {};
  for (const col of approvedCols) {
    if (col.allocations) {
      for (const alloc of col.allocations) {
        paidPerMonth[alloc.month] = (paidPerMonth[alloc.month] || 0) + alloc.amount;
      }
    } else if (col.coveredMonths) { // Legacy fallback
       const amt = col.paymentAmount / col.coveredMonths.length;
       for (const m of col.coveredMonths) {
         paidPerMonth[m] = (paidPerMonth[m] || 0) + amt;
       }
    }
  }
  
  const allocations: DonationAllocation[] = [];
  let remainingAmount = amountToAllocate;
  
  let curr = startMonth;
  let safetyCount = 0;
  while (remainingAmount > 0) {
    safetyCount++;
    if (safetyCount > 100) {
       // fallback dump remaining to last month to prevent infinite loop
       if (allocations.length > 0) {
           allocations[allocations.length-1].amount += remainingAmount;
       } else {
           allocations.push({ month: curr, amount: remainingAmount });
       }
       break;
    }
    const expected = getExpectedAmount(donor, curr);
    const alreadyPaid = paidPerMonth[curr] || 0;
    const needed = Math.max(0, expected - alreadyPaid);
    
    if (needed > 0) {
      const allocate = Math.min(needed, remainingAmount);
      allocations.push({ month: curr, amount: allocate });
      remainingAmount -= allocate;
    }
    
    let [y, m] = curr.split('-').map(Number);
    m++;
    if (m > 12) { m = 1; y++; }
    curr = `${y}-${m.toString().padStart(2, '0')}`;
  }
  
  return allocations;
}

export function generateLedger(
  donor: Donor,
  collections: DonationCollection[],
  startMonth: string,
  endMonth: string
): MonthLedger[] {
  const paidPerMonth: Record<string, number> = {};
  
  collections.filter(c => c.status === 'Approved' && !c.isDeleted).forEach(col => {
    if (col.allocations) {
      for (const alloc of col.allocations) {
        paidPerMonth[alloc.month] = (paidPerMonth[alloc.month] || 0) + alloc.amount;
      }
    } else if (col.coveredMonths) { // Legacy
      const amt = col.paymentAmount / col.coveredMonths.length;
      for (const m of col.coveredMonths) {
        paidPerMonth[m] = (paidPerMonth[m] || 0) + amt;
      }
    }
  });

  const ledger: MonthLedger[] = [];
  let curr = startMonth;
  while (curr <= endMonth) {
    const expected = getExpectedAmount(donor, curr);
    const paid = paidPerMonth[curr] || 0;
    
    let status: 'Paid' | 'Partial' | 'Due' | 'Advance' = 'Due';
    if (paid > expected) {
      status = 'Advance';
    } else if (paid === expected) {
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
    
    let [y, m] = curr.split('-').map(Number);
    m++;
    if (m > 12) { m = 1; y++; }
    curr = `${y}-${m.toString().padStart(2, '0')}`;
  }
  return ledger;
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
  
  let maxMonth = currentMonthStr;
  collections.filter(c => c.status === 'Approved' && !c.isDeleted).forEach(col => {
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
  
  const approvedCols = collections.filter(c => c.status === 'Approved' && !c.isDeleted);
  const pendingCols = collections.filter(c => c.status === 'Pending' && !c.isDeleted);
  
  const fullLedger = generateLedger(donor, approvedCols, startMonth, endMonth);
  
  let totalDue = 0;
  let totalAdvance = 0;
  let totalPaid = 0;
  
  fullLedger.forEach(l => {
    totalPaid += l.paid;
    if (l.expected > l.paid) {
      totalDue += (l.expected - l.paid);
    }
    
    // Advance is strictly the amount paid BEYOND the expected amount for ANY month
    if (l.paid > l.expected) {
      totalAdvance += (l.paid - l.expected);
    }
  });
  
  let totalPending = pendingCols.reduce((sum, c) => sum + c.paymentAmount, 0);
  
  // Do NOT subtract pending payments from actual due amounts
  let displayDue = totalDue;
  
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
