export type Role = 'admin' | 'teacher';

export interface User {
  uid: string;
  fullName: string;
  mobile: string;
  email: string;
  role: Role;
  photoURL?: string;
  language: 'en' | 'bn';
  theme: 'light' | 'dark';
  active: boolean;
  requirePasswordChange?: boolean;
  createdAt: number;
  updatedAt: number;
  lastLogin?: number;
}

export interface Teacher {
  teacherId: string; // auto
  teacherName: string;
  teacherNameBn?: string;
  mobile: string;
  email: string;
  assignedDonors: string[]; // donorIds
  assignedSubjects: string[]; // subjectIds
  assignedClasses: string[]; // classIds
  status: 'active' | 'inactive';
  createdAt: number;
  updatedAt: number;
}

export interface Student {
  studentId: string;
  studentName: string;
  studentNameBn?: string;
  rollNumber?: string;
  classId: string;
  assignedTeacher?: string;
  mobile: string;
  status: 'active' | 'inactive';
  createdAt: number;
  updatedAt: number;
}





export interface AcademicSession {
  sessionId: string;
  sessionName: string;
  sessionNameBn?: string; // e.g. "2026"
  isDefault: boolean;
  status: 'active' | 'inactive';
}

export interface ClassData {
  classId: string;
  className: string;
  classNameBn?: string;
  sessionId: string;
  status: 'active' | 'inactive';
}

export interface Subject {
  subjectId: string;
  subjectName: string;
  subjectNameBn?: string;
  classId: string;
  assignedTeacher?: string;
  status: 'active' | 'inactive';
}

export interface Exam {
  examId: string;
  examName: string;
  examNameBn?: string;
  sessionId: string;
  status: 'active' | 'inactive';
}

export interface Mark {
  markId: string;
  studentId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  examId: string;
  obtainedMarks: number;
  draft: boolean;
  submitted: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  madrasaName: string;
  madrasaNameBn?: string;
  logoUrl?: string;
  address: string;
  addressBn?: string;
  phone: string;
  email: string;
  principalName: string;
  principalNameBn?: string;
  reportHeader: string;
  reportFooter: string;
  defaultLanguage: 'en' | 'bn';
  defaultTheme: 'light' | 'dark';
  donationMode: 'instant' | 'approval';
}

export interface AuditLog {
  logId: string;
  userId: string;
  action: string;
  module: string;
  oldValue?: any;
  newValue?: any;
  timestamp: number;
}

export interface DonorAmountHistory {
  amount: number;
  effectiveFromMonth: string; // e.g. "2026-07"
}

export interface Donor {
  donorId: string;
  donorName: string;
  donorNameBn?: string;
  mobile: string;
  address: string;
  monthlyDonation: number; // Current amount
  amountHistory?: DonorAmountHistory[]; // Track changes
  joinMonth?: string; // YYYY-MM
  assignedTeacher: string;
  status: 'active' | 'inactive';
  remarks?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DonationAllocation {
  month: string;
  amount: number;
}

export interface DonationCollection {
  collectionId: string;
  receiptNumber?: string;
  paperReceiptNo?: string;
  teacherId: string;
  donorId: string;
  paymentAmount: number;
  coveredMonths?: string[]; // Legacy
  allocations?: DonationAllocation[]; // Replaces coveredMonths
  paymentDate: number; // For cash-flow
  paymentMethod: string;
  note?: string;
  status: 'Pending' | 'Approved' | 'Void';
  submittedAt?: number;
  approvedAt?: number;
  approvedBy?: string;
  createdAt: number;
  updatedAt?: number;
  isDeleted?: boolean; // soft delete
  source?: 'TEACHER_ENTRY' | 'MANUAL_ADMIN';
}