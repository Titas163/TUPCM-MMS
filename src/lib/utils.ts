import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function formatDate(timestamp: number, language: 'en' | 'bn' = 'en') {
  const date = new Date(timestamp);
  // Basic formatting, could be expanded
  return new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

export function formatCurrency(amount: number, language: 'en' | 'bn' = 'en') {
  return new Intl.NumberFormat(language === 'bn' ? 'bn-BD' : 'en-US', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 0,
  }).format(amount);
}

export const toBnNum = (num: number | string | undefined | null, lang: 'en' | 'bn'): string => {
  if (num === undefined || num === null) return '';
  if (lang === 'en') return String(num);
  return String(num).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d as any]);
};
