import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  ActivityLog,
  Company,
  CompanyMember,
  User,
} from '../types/compliance.ts';
import {
  buildDashboardSummary,
  syncCompanyDerivedState,
  type CompanyDatabaseSlice,
} from './engine.ts';
import { createInitialSeedDatabase } from './seed.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'store.json');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || 'permitpulse-local-workspace-secret-2026';
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const stored = Buffer.from(keyHex, 'hex');
  if (derived.length !== stored.length) return false;
  return crypto.timingSafeEqual(derived, stored);
}

export function hashToken(rawToken: string): string {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(rawToken)
    .digest('hex');
}

class ComplianceStore {
  private db: CompanyDatabaseSlice;

  constructor() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    this.db = this.loadOrInitialize();
  }

  private loadOrInitialize(): CompanyDatabaseSlice {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw) as CompanyDatabaseSlice;
        // Ensure all top-level collections exist
        parsed.companies ||= [];
        parsed.users ||= [];
        parsed.members ||= [];
        parsed.locations ||= [];
        parsed.licenses ||= [];
        parsed.documents ||= [];
        parsed.requirements ||= [];
        parsed.calendarEvents ||= [];
        parsed.notifications ||= [];
        parsed.activityLogs ||= [];
        parsed.sessions ||= [];
        return parsed;
      } catch (err) {
        console.error('Failed to parse store.json, recreating initial seed:', err);
      }
    }
    const seeded = createInitialSeedDatabase(UPLOADS_DIR, hashPassword);
    this.saveRaw(seeded);
    return seeded;
  }

  private saveRaw(data: CompanyDatabaseSlice) {
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpFile, DB_FILE);
  }

  public persist() {
    this.saveRaw(this.db);
  }

  public getDb(): CompanyDatabaseSlice {
    return this.db;
  }

  public sanitizeUser(u: User & { passwordHash?: string }): User {
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      jobTitle: u.jobTitle,
      phone: u.phone,
      createdAt: u.createdAt,
    };
  }

  public createSession(userId: string): string {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
    // Prune expired sessions for cleanliness
    const nowIso = new Date().toISOString();
    this.db.sessions = this.db.sessions.filter((s) => s.expiresAt > nowIso);
    this.db.sessions.push({ tokenHash, userId, expiresAt });
    this.persist();
    return rawToken;
  }

  public getUserBySessionToken(rawToken: string | undefined | null): User | null {
    if (!rawToken) return null;
    const tokenHash = hashToken(rawToken);
    const nowIso = new Date().toISOString();
    const session = this.db.sessions.find((s) => s.tokenHash === tokenHash && s.expiresAt > nowIso);
    if (!session) return null;
    const user = this.db.users.find((u) => u.id === session.userId);
    return user ? this.sanitizeUser(user) : null;
  }

  public deleteSession(rawToken: string | undefined | null) {
    if (!rawToken) return;
    const tokenHash = hashToken(rawToken);
    this.db.sessions = this.db.sessions.filter((s) => s.tokenHash !== tokenHash);
    this.persist();
  }

  public getUserCompanies(userId: string): Array<{ company: Company; membership: CompanyMember }> {
    const user = this.db.users.find((u) => u.id === userId);
    if (!user) return [];
    const memberships = this.db.members.filter(
      (m) => m.userId === userId || m.email.toLowerCase() === user.email.toLowerCase()
    );
    const result: Array<{ company: Company; membership: CompanyMember }> = [];
    const seenCompanyIds = new Set<string>();
    for (const m of memberships) {
      if (seenCompanyIds.has(m.companyId)) continue;
      const company = this.db.companies.find((c) => c.id === m.companyId);
      if (company) {
        seenCompanyIds.add(company.id);
        result.push({ company, membership: m });
      }
    }
    return result;
  }

  public assertCompanyAccess(userId: string, companyId: string): { company: Company; membership: CompanyMember } | null {
    const allowed = this.getUserCompanies(userId);
    return allowed.find((item) => item.company.id === companyId) || null;
  }

  public syncCompany(companyId: string) {
    const changed = syncCompanyDerivedState(this.db, companyId);
    if (changed) {
      this.persist();
    }
  }

  public getDashboard(companyId: string) {
    this.syncCompany(companyId);
    return buildDashboardSummary(this.db, companyId);
  }

  public logActivity(entry: Omit<ActivityLog, 'id' | 'createdAt'>) {
    this.db.activityLogs.unshift({
      ...entry,
      id: `act_${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
    });
    // Cap per-company logs to 200 entries
    const companyLogs = this.db.activityLogs.filter((a) => a.companyId === entry.companyId);
    if (companyLogs.length > 200) {
      const keepIds = new Set(companyLogs.slice(0, 200).map((a) => a.id));
      this.db.activityLogs = this.db.activityLogs.filter(
        (a) => a.companyId !== entry.companyId || keepIds.has(a.id)
      );
    }
  }

  public resetDemoWorkspace() {
    const freshSeed = createInitialSeedDatabase(UPLOADS_DIR, hashPassword);
    // Replace demo company data without wiping custom registered user accounts
    const demoCompanyId = 'comp_demo_acme';
    const demoUserId = 'usr_demo_john';

    this.db.companies = [
      ...this.db.companies.filter((c) => c.id !== demoCompanyId),
      ...freshSeed.companies,
    ];
    if (!this.db.users.some((u) => u.id === demoUserId)) {
      this.db.users.push(...freshSeed.users);
    }
    this.db.members = [
      ...this.db.members.filter((m) => m.companyId !== demoCompanyId),
      ...freshSeed.members,
    ];
    this.db.locations = [
      ...this.db.locations.filter((l) => l.companyId !== demoCompanyId),
      ...freshSeed.locations,
    ];
    this.db.licenses = [
      ...this.db.licenses.filter((l) => l.companyId !== demoCompanyId),
      ...freshSeed.licenses,
    ];
    this.db.documents = [
      ...this.db.documents.filter((d) => d.companyId !== demoCompanyId),
      ...freshSeed.documents,
    ];
    this.db.requirements = [
      ...this.db.requirements.filter((r) => r.companyId !== demoCompanyId),
      ...freshSeed.requirements,
    ];
    this.db.calendarEvents = [
      ...this.db.calendarEvents.filter((e) => e.companyId !== demoCompanyId),
      ...freshSeed.calendarEvents,
    ];
    this.db.notifications = [
      ...this.db.notifications.filter((n) => n.companyId !== demoCompanyId),
      ...freshSeed.notifications,
    ];
    this.db.activityLogs = [
      ...this.db.activityLogs.filter((a) => a.companyId !== demoCompanyId),
      ...freshSeed.activityLogs,
    ];
    this.persist();
  }
}

export const store = new ComplianceStore();
