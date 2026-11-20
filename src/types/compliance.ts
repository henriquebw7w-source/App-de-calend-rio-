export type LicenseStatus = 'Active' | 'Expiring Soon' | 'Expired';

export type LicenseCategory =
  | 'HVAC Contractor License'
  | 'Business Permit'
  | 'Professional Certification'
  | 'Safety Certificate'
  | 'Insurance Policy'
  | 'EPA / Refrigerant Certification'
  | 'Trade / Mechanical Permit'
  | 'Other';

export type DocumentCategory =
  | 'Licenses'
  | 'Certificates'
  | 'Insurance'
  | 'Permits'
  | 'Safety'
  | 'Compliance Reports'
  | 'Other';

export type RequirementStatus = 'Not Started' | 'In Progress' | 'Completed' | 'Overdue';

export type RequirementCategory =
  | 'License Renewal'
  | 'Insurance Update'
  | 'Safety & OSHA'
  | 'Environmental / EPA'
  | 'Tax & Business Filing'
  | 'Inspection'
  | 'Training'
  | 'Other';

export type CalendarEventCategory =
  | 'License Renewal'
  | 'License Expiration'
  | 'Insurance Review'
  | 'Business Permit'
  | 'Compliance Deadline'
  | 'Inspection'
  | 'Certification Check'
  | 'Location Review'
  | 'General';

export type CalendarEventPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export type CalendarEventSource =
  | 'manual'
  | 'auto_license_expiration'
  | 'auto_requirement_deadline';

export type MemberRole = 'Owner' | 'Admin' | 'Compliance Manager' | 'Member';

export interface User {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string;
  phone: string;
  createdAt: string;
}

export interface NotificationPreferences {
  warningThresholdDays: number;
  reminderIntervals: number[];
  inAppEnabled: boolean;
  emailDigestEnabled: boolean;
  emailAddress: string;
  emailIntegrationStatus: 'not_configured' | 'ready';
}

export interface Company {
  id: string;
  name: string;
  legalName: string;
  industry: string;
  ein: string;
  primaryState: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  isDemo: boolean;
  notificationPreferences: NotificationPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyMember {
  id: string;
  companyId: string;
  userId: string | null;
  fullName: string;
  email: string;
  role: MemberRole;
  jobTitle: string;
  phone: string;
  status: 'Active' | 'Invited';
  createdAt: string;
}

export interface BusinessLocation {
  id: string;
  companyId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  isPrimary: boolean;
  createdAt: string;
}

export interface License {
  id: string;
  companyId: string;
  name: string;
  licenseNumber: string;
  category: LicenseCategory;
  issuingAuthority: string;
  stateOrJurisdiction: string;
  locationId: string | null;
  issueDate: string; // YYYY-MM-DD
  expirationDate: string; // YYYY-MM-DD
  status: LicenseStatus; // Calculated dynamically on backend
  daysRemaining: number; // Calculated dynamically
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRecord {
  id: string;
  companyId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  category: DocumentCategory;
  uploadDate: string; // YYYY-MM-DD
  expirationDate: string | null;
  relatedLicenseId: string | null;
  relatedRequirementId: string | null;
  notes: string;
  uploadedByName: string;
  createdAt: string;
}

export interface ComplianceRequirement {
  id: string;
  companyId: string;
  title: string;
  description: string;
  category: RequirementCategory;
  responsibleMemberId: string | null;
  responsibleName: string;
  relatedLicenseId: string | null;
  relatedDocumentId: string | null;
  dueDate: string; // YYYY-MM-DD
  status: RequirementStatus;
  completedAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  companyId: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM (24h) or null
  isAllDay: boolean;
  category: CalendarEventCategory;
  responsibleMemberId: string | null;
  responsibleName: string;
  locationId: string | null;
  relatedLicenseId: string | null;
  relatedDocumentId: string | null;
  relatedRequirementId: string | null;
  priority: CalendarEventPriority;
  isCompleted: boolean;
  completedAt: string | null;
  sourceType: CalendarEventSource;
  sourceEntityId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationRecord {
  id: string;
  companyId: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'urgent' | 'success';
  intervalDays: number | null;
  entityType: 'license' | 'requirement' | 'document' | 'calendar' | 'system';
  entityId: string;
  dedupeKey: string;
  dueDate: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  companyId: string;
  actorName: string;
  action: string;
  entityType: 'license' | 'document' | 'requirement' | 'calendar' | 'company' | 'member' | 'location';
  entityId: string;
  entityTitle: string;
  details: string;
  createdAt: string;
}

export interface DashboardSummary {
  totalLicenses: number;
  activeLicenses: number;
  expiringSoonLicenses: number;
  expiredLicenses: number;
  totalRequirements: number;
  pendingRequirements: number;
  overdueRequirements: number;
  completedRequirements: number;
  totalDocuments: number;
  unreadNotifications: number;
  readinessPercentage: number;
  upcomingDeadlines: Array<{
    id: string;
    type: 'license' | 'requirement';
    title: string;
    subtitle: string;
    date: string;
    daysRemaining: number;
    status: string;
  }>;
  upcomingEvents: CalendarEvent[];
  recentActivity: ActivityLog[];
}

export const LICENSE_CATEGORIES: LicenseCategory[] = [
  'HVAC Contractor License',
  'Business Permit',
  'Professional Certification',
  'Safety Certificate',
  'Insurance Policy',
  'EPA / Refrigerant Certification',
  'Trade / Mechanical Permit',
  'Other',
];

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  'Licenses',
  'Certificates',
  'Insurance',
  'Permits',
  'Safety',
  'Compliance Reports',
  'Other',
];

export const REQUIREMENT_CATEGORIES: RequirementCategory[] = [
  'License Renewal',
  'Insurance Update',
  'Safety & OSHA',
  'Environmental / EPA',
  'Tax & Business Filing',
  'Inspection',
  'Training',
  'Other',
];

export const REQUIREMENT_STATUSES: RequirementStatus[] = [
  'Not Started',
  'In Progress',
  'Completed',
  'Overdue',
];

export const CALENDAR_EVENT_CATEGORIES: CalendarEventCategory[] = [
  'License Renewal',
  'License Expiration',
  'Insurance Review',
  'Business Permit',
  'Compliance Deadline',
  'Inspection',
  'Certification Check',
  'Location Review',
  'General',
];

export const CALENDAR_PRIORITIES: CalendarEventPriority[] = [
  'Low',
  'Medium',
  'High',
  'Urgent',
];
