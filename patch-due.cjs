const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/lib/donationUtils.ts');
let content = fs.readFileSync(file, 'utf8');

const targetSummary = `  fullLedger.forEach(l => {
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
const replacementSummary = `  fullLedger.forEach(l => {
    totalPaid += l.paid;
    if (l.expected > l.paid) {
      totalDue += (l.expected - l.paid);
    }
    
    // Advance is strictly the amount paid BEYOND the expected amount for ANY month
    if (l.paid > l.expected) {
      totalAdvance += (l.paid - l.expected);
    }
  });`;

content = content.replace(targetSummary, replacementSummary);

fs.writeFileSync(file, content);
