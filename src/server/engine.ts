import crypto from 'node:crypto';
import type {
  ActivityLog,
  CalendarEvent,
  ComplianceRequirement,
  DashboardSummary,
  License,
  LicenseStatus,
  NotificationRecord,
  RequirementStatus,
} from '../types/compliance.ts';

export interface CompanyDatabaseSlice {
  companies: Array<import('../types/compliance.ts').Company>;
  users: Array<import('../types/compliance.ts').User & { passwordHash: string }>;
  members: Array<import('../types/compliance.ts').CompanyMember>;
  locations: Array<import('../types/compliance.ts').BusinessLocation>;
  licenses: License[];
  documents: Array<import('../types/compliance.ts').DocumentRecord>;
  requirements: ComplianceRequirement[];
  calendarEvents: CalendarEvent[];
  notifications: NotificationRecord[];
  activityLogs: ActivityLog[];
  sessions: Array<{
    tokenHash: string;
    userId: string;
    expiresAt: string;
  }>;
}

export function getTodayYmd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function diffDaysYmd(fromYmd: string, toYmd: string): number {
  const [fy, fm, fd] = fromYmd.split('-').map(Number);
  const [ty, tm, td] = toYmd.split('-').map(Number);
  const fromUtc = Date.UTC(fy, fm - 1, fd);
  const toUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((toUtc - fromUtc) / (1000 * 60 * 60 * 24));
}

export function calculateLicenseStatus(
  expirationDate: string,
  warningThresholdDays: number,
  todayYmd = getTodayYmd()
): { status: LicenseStatus; daysRemaining: number } {
  const daysRemaining = diffDaysYmd(todayYmd, expirationDate);
  if (daysRemaining < 0) {
    return { status: 'Expired', daysRemaining };
  }
  if (daysRemaining <= warningThresholdDays) {
    return { status: 'Expiring Soon', daysRemaining };
  }
  return { status: 'Active', daysRemaining };
}

export function calculateRequirementStatus(
  currentStatus: RequirementStatus,
  dueDate: string,
  todayYmd = getTodayYmd()
): RequirementStatus {
  if (currentStatus === 'Completed') {
    return 'Completed';
  }
  const days = diffDaysYmd(todayYmd, dueDate);
  if (days < 0) {
    return 'Overdue';
  }
  if (currentStatus === 'Overdue' && days >= 0) {
    return 'Not Started';
  }
  return currentStatus;
}

export function syncCompanyDerivedState(db: CompanyDatabaseSlice, companyId: string): boolean {
  const company = db.companies.find((c) => c.id === companyId);
  if (!company) return false;

  const today = getTodayYmd();
  const threshold = company.notificationPreferences?.warningThresholdDays ?? 60;
  const intervals = company.notificationPreferences?.reminderIntervals ?? [60, 30, 7, 0];
  let changed = false;

  // 1. Recalculate license statuses & days remaining
  const companyLicenses = db.licenses.filter((l) => l.companyId === companyId);
  for (const lic of companyLicenses) {
    const calc = calculateLicenseStatus(lic.expirationDate, threshold, today);
    if (lic.status !== calc.status || lic.daysRemaining !== calc.daysRemaining) {
      lic.status = calc.status;
      lic.daysRemaining = calc.daysRemaining;
      changed = true;
    }
  }

  // 2. Recalculate requirement statuses
  const companyReqs = db.requirements.filter((r) => r.companyId === companyId);
  for (const req of companyReqs) {
    const nextStatus = calculateRequirementStatus(req.status, req.dueDate, today);
    if (req.status !== nextStatus) {
      req.status = nextStatus;
      changed = true;
    }
  }

  // 3. Synchronize auto-generated Calendar Events (no duplicates!)
  const licenseIds = new Set(companyLicenses.map((l) => l.id));
  const reqIds = new Set(companyReqs.map((r) => r.id));

  // Remove orphaned auto events
  const beforeLen = db.calendarEvents.length;
  db.calendarEvents = db.calendarEvents.filter((ev) => {
    if (ev.companyId !== companyId) return true;
    if (ev.sourceType === 'auto_license_expiration') {
      return ev.sourceEntityId !== null && licenseIds.has(ev.sourceEntityId);
    }
    if (ev.sourceType === 'auto_requirement_deadline') {
      return ev.sourceEntityId !== null && reqIds.has(ev.sourceEntityId);
    }
    return true;
  });
  if (db.calendarEvents.length !== beforeLen) changed = true;

  // Upsert auto_license_expiration events
  for (const lic of companyLicenses) {
    const existing = db.calendarEvents.find(
      (ev) =>
        ev.companyId === companyId &&
        ev.sourceType === 'auto_license_expiration' &&
        ev.sourceEntityId === lic.id
    );
    const desiredTitle = `${lic.name} Expiration`;
    const desiredPriority =
      lic.daysRemaining <= 7 ? 'Urgent' : lic.daysRemaining <= threshold ? 'High' : 'Medium';
    const desiredDesc = `Automatic expiration deadline for ${lic.name} (${lic.licenseNumber}) issued by ${lic.issuingAuthority}.`;

    if (existing) {
      if (
        existing.title !== desiredTitle ||
        existing.date !== lic.expirationDate ||
        existing.locationId !== lic.locationId ||
        existing.priority !== desiredPriority ||
        existing.description !== desiredDesc
      ) {
        existing.title = desiredTitle;
        existing.date = lic.expirationDate;
        existing.locationId = lic.locationId;
        existing.priority = desiredPriority;
        existing.description = desiredDesc;
        existing.updatedAt = new Date().toISOString();
        changed = true;
      }
    } else {
      const nowIso = new Date().toISOString();
      db.calendarEvents.push({
        id: `ev_lic_${lic.id}`,
        companyId,
        title: desiredTitle,
        description: desiredDesc,
        date: lic.expirationDate,
        time: null,
        isAllDay: true,
        category: 'License Expiration',
        responsibleMemberId: null,
        responsibleName: '',
        locationId: lic.locationId,
        relatedLicenseId: lic.id,
        relatedDocumentId: null,
        relatedRequirementId: null,
        priority: desiredPriority,
        isCompleted: false,
        completedAt: null,
        sourceType: 'auto_license_expiration',
        sourceEntityId: lic.id,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      changed = true;
    }
  }

  // Upsert auto_requirement_deadline events
  for (const req of companyReqs) {
    const existing = db.calendarEvents.find(
      (ev) =>
        ev.companyId === companyId &&
        ev.sourceType === 'auto_requirement_deadline' &&
        ev.sourceEntityId === req.id
    );
    const desiredTitle = `${req.title} (Due)`;
    const isCompleted = req.status === 'Completed';
    const days = diffDaysYmd(today, req.dueDate);
    const desiredPriority = isCompleted
      ? 'Low'
      : days < 0 || days <= 3
        ? 'Urgent'
        : days <= 14
          ? 'High'
          : 'Medium';

    if (existing) {
      if (
        existing.title !== desiredTitle ||
        existing.date !== req.dueDate ||
        existing.responsibleMemberId !== req.responsibleMemberId ||
        existing.responsibleName !== req.responsibleName ||
        existing.relatedLicenseId !== req.relatedLicenseId ||
        existing.relatedDocumentId !== req.relatedDocumentId ||
        existing.isCompleted !== isCompleted ||
        existing.priority !== desiredPriority
      ) {
        existing.title = desiredTitle;
        existing.date = req.dueDate;
        existing.responsibleMemberId = req.responsibleMemberId;
        existing.responsibleName = req.responsibleName;
        existing.relatedLicenseId = req.relatedLicenseId;
        existing.relatedDocumentId = req.relatedDocumentId;
        existing.isCompleted = isCompleted;
        existing.completedAt = isCompleted ? req.completedAt || new Date().toISOString() : null;
        existing.priority = desiredPriority;
        existing.updatedAt = new Date().toISOString();
        changed = true;
      }
    } else {
      const nowIso = new Date().toISOString();
      db.calendarEvents.push({
        id: `ev_req_${req.id}`,
        companyId,
        title: desiredTitle,
        description: req.description || `Automatic compliance requirement deadline: ${req.title}`,
        date: req.dueDate,
        time: null,
        isAllDay: true,
        category: 'Compliance Deadline',
        responsibleMemberId: req.responsibleMemberId,
        responsibleName: req.responsibleName,
        locationId: null,
        relatedLicenseId: req.relatedLicenseId,
        relatedDocumentId: req.relatedDocumentId,
        relatedRequirementId: req.id,
        priority: desiredPriority,
        isCompleted,
        completedAt: isCompleted ? req.completedAt || nowIso : null,
        sourceType: 'auto_requirement_deadline',
        sourceEntityId: req.id,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      changed = true;
    }
  }

  // 4. Generate deduplicated notifications for licenses and requirements
  if (company.notificationPreferences?.inAppEnabled !== false) {
    const existingKeys = new Set(
      db.notifications.filter((n) => n.companyId === companyId).map((n) => n.dedupeKey)
    );

    const addNotificationIfNew = (item: Omit<NotificationRecord, 'id' | 'createdAt' | 'isRead'>) => {
      if (existingKeys.has(item.dedupeKey)) return;
      existingKeys.add(item.dedupeKey);
      db.notifications.unshift({
        ...item,
        id: `notif_${crypto.randomUUID()}`,
        isRead: false,
        createdAt: new Date().toISOString(),
      });
      changed = true;
    };

    for (const lic of companyLicenses) {
      const days = lic.daysRemaining;
      if (days < 0) {
        addNotificationIfNew({
          companyId,
          title: `License expired: ${lic.name}`,
          message: `${lic.name} (${lic.licenseNumber}) expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago on ${lic.expirationDate}.`,
          severity: 'urgent',
          intervalDays: -1,
          entityType: 'license',
          entityId: lic.id,
          dedupeKey: `license:${lic.id}:expired:${lic.expirationDate}`,
          dueDate: lic.expirationDate,
        });
      } else if (days === 0 && intervals.includes(0)) {
        addNotificationIfNew({
          companyId,
          title: `Expires today: ${lic.name}`,
          message: `${lic.name} (${lic.licenseNumber}) expires today (${lic.expirationDate}).`,
          severity: 'urgent',
          intervalDays: 0,
          entityType: 'license',
          entityId: lic.id,
          dedupeKey: `license:${lic.id}:0:${lic.expirationDate}`,
          dueDate: lic.expirationDate,
        });
      } else {
        // Find the tightest matching reminder bucket configured by the company
        const sortedIntervals = [...intervals].filter((i) => i > 0).sort((a, b) => a - b);
        for (const interval of sortedIntervals) {
          if (days <= interval) {
            addNotificationIfNew({
              companyId,
              title: `${lic.name} expiring in ${days} day${days === 1 ? '' : 's'}`,
              message: `${lic.name} (${lic.licenseNumber}) is within your ${interval}-day reminder window (expires ${lic.expirationDate}).`,
              severity: interval <= 7 ? 'urgent' : 'warning',
              intervalDays: interval,
              entityType: 'license',
              entityId: lic.id,
              dedupeKey: `license:${lic.id}:${interval}:${lic.expirationDate}`,
              dueDate: lic.expirationDate,
            });
            break;
          }
        }
      }
    }

    for (const req of companyReqs) {
      if (req.status === 'Completed') continue;
      const days = diffDaysYmd(today, req.dueDate);
      if (days < 0) {
        addNotificationIfNew({
          companyId,
          title: `Overdue requirement: ${req.title}`,
          message: `"${req.title}" was due on ${req.dueDate} (${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue).`,
          severity: 'urgent',
          intervalDays: -1,
          entityType: 'requirement',
          entityId: req.id,
          dedupeKey: `requirement:${req.id}:overdue:${req.dueDate}`,
          dueDate: req.dueDate,
        });
      } else if (days <= 7) {
        addNotificationIfNew({
          companyId,
          title: `Requirement due ${days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`}: ${req.title}`,
          message: `"${req.title}" is due on ${req.dueDate}${req.responsibleName ? ` (Assigned: ${req.responsibleName})` : ''}.`,
          severity: days <= 2 ? 'urgent' : 'warning',
          intervalDays: days === 0 ? 0 : 7,
          entityType: 'requirement',
          entityId: req.id,
          dedupeKey: `requirement:${req.id}:7:${req.dueDate}`,
          dueDate: req.dueDate,
        });
      }
    }
  }

  return changed;
}

export function buildDashboardSummary(db: CompanyDatabaseSlice, companyId: string): DashboardSummary {
  const today = getTodayYmd();
  const licenses = db.licenses.filter((l) => l.companyId === companyId);
  const requirements = db.requirements.filter((r) => r.companyId === companyId);
  const documents = db.documents.filter((d) => d.companyId === companyId);
  const notifications = db.notifications.filter((n) => n.companyId === companyId);
  const events = db.calendarEvents.filter((e) => e.companyId === companyId);
  const logs = db.activityLogs.filter((a) => a.companyId === companyId);

  const totalLicenses = licenses.length;
  const activeLicenses = licenses.filter((l) => l.status === 'Active').length;
  const expiringSoonLicenses = licenses.filter((l) => l.status === 'Expiring Soon').length;
  const expiredLicenses = licenses.filter((l) => l.status === 'Expired').length;

  const totalRequirements = requirements.length;
  const completedRequirements = requirements.filter((r) => r.status === 'Completed').length;
  const overdueRequirements = requirements.filter((r) => r.status === 'Overdue').length;
  const pendingRequirements = requirements.filter((r) => r.status !== 'Completed').length;

  const totalTracked = totalLicenses + totalRequirements;
  const onTrackCount =
    activeLicenses + requirements.filter((r) => r.status === 'Completed' || r.status === 'In Progress').length;
  const readinessPercentage = totalTracked > 0 ? Math.round((onTrackCount / totalTracked) * 100) : 100;

  const upcomingDeadlines = [
    ...licenses
      .filter((l) => l.status !== 'Active' || l.daysRemaining <= 90)
      .map((l) => ({
        id: l.id,
        type: 'license' as const,
        title: l.name,
        subtitle: `${l.licenseNumber} · ${l.issuingAuthority}`,
        date: l.expirationDate,
        daysRemaining: l.daysRemaining,
        status: l.status,
      })),
    ...requirements
      .filter((r) => r.status !== 'Completed')
      .map((r) => ({
        id: r.id,
        type: 'requirement' as const,
        title: r.title,
        subtitle: r.responsibleName ? `Assigned to ${r.responsibleName}` : r.category,
        date: r.dueDate,
        daysRemaining: diffDaysYmd(today, r.dueDate),
        status: r.status,
      })),
  ]
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .slice(0, 6);

  const upcomingEvents = [...events]
    .filter((e) => !e.isCompleted && e.date >= today)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.time || '23:59').localeCompare(b.time || '23:59');
    })
    .slice(0, 6);

  const recentActivity = [...logs]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);

  return {
    totalLicenses,
    activeLicenses,
    expiringSoonLicenses,
    expiredLicenses,
    totalRequirements,
    pendingRequirements,
    overdueRequirements,
    completedRequirements,
    totalDocuments: documents.length,
    unreadNotifications: notifications.filter((n) => !n.isRead).length,
    readinessPercentage,
    upcomingDeadlines,
    upcomingEvents,
    recentActivity,
  };
}
