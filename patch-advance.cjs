const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/lib/donationUtils.ts');
let content = fs.readFileSync(file, 'utf8');

// Patch generateLedger
const targetGenerateLedger = `    let status: 'Paid' | 'Partial' | 'Due' | 'Advance' = 'Due';
    if (paid >= expected) {
      status = curr > getCurrentMonthStr() ? 'Advance' : 'Paid';
    } else if (paid > 0) {
      status = curr > getCurrentMonthStr() ? 'Advance' : 'Partial';
    }`;
const replacementGenerateLedger = `    let status: 'Paid' | 'Partial' | 'Due' | 'Advance' = 'Due';
    if (paid > expected) {
      status = 'Advance';
    } else if (paid === expected) {
      status = 'Paid';
    } else if (paid > 0) {
      status = 'Partial';
    }`;
content = content.replace(targetGenerateLedger, replacementGenerateLedger);

// Patch calculateDonorSummary
const targetSummary = `  fullLedger.forEach(l => {
    totalPaid += l.paid;
    if (l.month <= currentMonthStr) {
      if (l.expected > l.paid) {
        totalDue += (l.expected - l.paid);
      }
    } else {
      totalAdvance += l.paid;
    }
  });`;
const replacementSummary = `  fullLedger.forEach(l => {
    totalPaid += l.paid;
    if (l.month <= currentMonthStr) {
      if (l.expected > l.paid) {
        totalDue += (l.expected - l.paid);
      }
    }
    
    // Advance is strictly the amount paid BEYOND the expected amount for ANY month
    if (l.paid > l.expected) {
      totalAdvance += (l.paid - l.expected);
    }
  });`;
content = content.replace(targetSummary, replacementSummary);

fs.writeFileSync(file, content);
