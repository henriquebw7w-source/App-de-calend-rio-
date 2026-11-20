import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { BRAND_CONFIG } from './src/config/brand.ts';
import { calculateLicenseStatus, getTodayYmd } from './src/server/engine.ts';
import { hashPassword, store, UPLOADS_DIR, verifyPassword } from './src/server/store.ts';
import type {
  BusinessLocation,
  CalendarEvent,
  Company,
  CompanyMember,
  ComplianceRequirement,
  DocumentRecord,
  License,
  User,
} from './src/types/compliance.ts';

dotenv.config();

interface AuthedRequest extends Request {
  currentUser?: User;
  sessionToken?: string;
  companyAccess?: {
    company: Company;
    membership: CompanyMember;
  };
}

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice('Bearer '.length).trim();
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const parts = cookieHeader.split(';');
    for (const part of parts) {
      const [k, ...v] = part.trim().split('=');
      if (k === 'pp_session') {
        return decodeURIComponent(v.join('='));
      }
    }
  }
  if (typeof req.query.token === 'string' && req.query.token) {
    return req.query.token;
  }
  return null;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  const user = store.getUserBySessionToken(token);
  if (!user || !token) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  req.currentUser = user;
  req.sessionToken = token;
  next();
}

function requireCompanyAccess(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.currentUser) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const companyId = String(req.params.companyId || '');
  const access = store.assertCompanyAccess(req.currentUser.id, companyId);
  if (!access) {
    return res.status(403).json({ error: 'You do not have access to this company workspace.' });
  }
  req.companyAccess = access;
  store.syncCompany(companyId);
  next();
}

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'document';
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '20mb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, product: BRAND_CONFIG.appName });
  });

  // ── AUTH ROUTES ────────────────────────────────────────────────────────────
  app.post('/api/auth/register', (req, res) => {
    const { fullName, email, password, companyName, primaryState, industry } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanName = String(fullName || '').trim();
    const cleanCompany = String(companyName || '').trim();
    const cleanPassword = String(password || '');

    if (!cleanEmail || !cleanName || !cleanCompany || cleanPassword.length < 6) {
      return res.status(400).json({
        error: 'Full name, valid email, company name, and a password of at least 6 characters are required.',
      });
    }

    const db = store.getDb();
    if (db.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
    }

    const nowIso = new Date().toISOString();
    const userId = `usr_${crypto.randomUUID()}`;
    const companyId = `comp_${crypto.randomUUID()}`;

    const newUser = {
      id: userId,
      email: cleanEmail,
      fullName: cleanName,
      jobTitle: 'Owner / Administrator',
      phone: '',
      passwordHash: hashPassword(cleanPassword),
      createdAt: nowIso,
    };

    const newCompany: Company = {
      id: companyId,
      name: cleanCompany,
      legalName: cleanCompany,
      industry: String(industry || 'HVAC & Mechanical Contracting').trim(),
      ein: '',
      primaryState: String(primaryState || 'AZ').trim(),
      email: cleanEmail,
      phone: '',
      website: '',
      address: '',
      isDemo: false,
      notificationPreferences: {
        warningThresholdDays: BRAND_CONFIG.defaultWarningThresholdDays,
        reminderIntervals: [...BRAND_CONFIG.defaultReminderIntervals],
        inAppEnabled: true,
        emailDigestEnabled: false,
        emailAddress: cleanEmail,
        emailIntegrationStatus: 'not_configured',
      },
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const newMember: CompanyMember = {
      id: `mem_${crypto.randomUUID()}`,
      companyId,
      userId,
      fullName: cleanName,
      email: cleanEmail,
      role: 'Owner',
      jobTitle: 'Owner / Administrator',
      phone: '',
      status: 'Active',
      createdAt: nowIso,
    };

    const primaryLoc: BusinessLocation = {
      id: `loc_${crypto.randomUUID()}`,
      companyId,
      name: 'Main Office',
      address: '',
      city: '',
      state: newCompany.primaryState,
      zipCode: '',
      phone: '',
      isPrimary: true,
      createdAt: nowIso,
    };

    db.users.push(newUser);
    db.companies.push(newCompany);
    db.members.push(newMember);
    db.locations.push(primaryLoc);

    // Link any pre-invited memberships matching this email
    for (const m of db.members) {
      if (m.email.toLowerCase() === cleanEmail && !m.userId) {
        m.userId = userId;
        m.status = 'Active';
      }
    }

    store.logActivity({
      companyId,
      actorName: cleanName,
      action: 'Created company workspace',
      entityType: 'company',
      entityId: companyId,
      entityTitle: cleanCompany,
      details: 'Initialized company compliance workspace',
    });

    const token = store.createSession(userId);
    res.cookie('pp_session', token, { httpOnly: true, sameSite: 'lax', path: '/' });
    res.status(201).json({
      token,
      user: store.sanitizeUser(newUser),
      companies: store.getUserCompanies(userId),
      activeCompanyId: companyId,
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPassword = String(password || '');

    const db = store.getDb();
    const user = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!user || !verifyPassword(cleanPassword, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Attach invited memberships by email
    let linked = false;
    for (const m of db.members) {
      if (m.email.toLowerCase() === cleanEmail && !m.userId) {
        m.userId = user.id;
        m.status = 'Active';
        linked = true;
      }
    }
    if (linked) store.persist();

    const companies = store.getUserCompanies(user.id);
    const token = store.createSession(user.id);
    res.cookie('pp_session', token, { httpOnly: true, sameSite: 'lax', path: '/' });
    res.json({
      token,
      user: store.sanitizeUser(user),
      companies,
      activeCompanyId: companies[0]?.company.id || null,
    });
  });

  app.post('/api/auth/demo', (_req, res) => {
    const db = store.getDb();
    let demoUser = db.users.find((u) => u.id === 'usr_demo_john');
    if (!demoUser || !db.companies.some((c) => c.id === 'comp_demo_acme')) {
      store.resetDemoWorkspace();
      demoUser = store.getDb().users.find((u) => u.id === 'usr_demo_john');
    }
    if (!demoUser) {
      return res.status(500).json({ error: 'Failed to initialize demo workspace.' });
    }
    const token = store.createSession(demoUser.id);
    const companies = store.getUserCompanies(demoUser.id);
    res.cookie('pp_session', token, { httpOnly: true, sameSite: 'lax', path: '/' });
    res.json({
      token,
      user: store.sanitizeUser(demoUser),
      companies,
      activeCompanyId: 'comp_demo_acme',
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = extractToken(req);
    store.deleteSession(token);
    res.clearCookie('pp_session', { path: '/' });
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    const companies = store.getUserCompanies(req.currentUser!.id);
    res.json({
      user: req.currentUser,
      companies,
    });
  });

  app.post('/api/companies', requireAuth, (req: AuthedRequest, res) => {
    const { name, primaryState, industry } = req.body || {};
    const cleanName = String(name || '').trim();
    if (!cleanName) {
      return res.status(400).json({ error: 'Company name is required.' });
    }
    const db = store.getDb();
    const nowIso = new Date().toISOString();
    const companyId = `comp_${crypto.randomUUID()}`;
    const user = req.currentUser!;

    const newCompany: Company = {
      id: companyId,
      name: cleanName,
      legalName: cleanName,
      industry: String(industry || 'HVAC & Mechanical Contracting').trim(),
      ein: '',
      primaryState: String(primaryState || 'AZ').trim(),
      email: user.email,
      phone: user.phone,
      website: '',
      address: '',
      isDemo: false,
      notificationPreferences: {
        warningThresholdDays: BRAND_CONFIG.defaultWarningThresholdDays,
        reminderIntervals: [...BRAND_CONFIG.defaultReminderIntervals],
        inAppEnabled: true,
        emailDigestEnabled: false,
        emailAddress: user.email,
        emailIntegrationStatus: 'not_configured',
      },
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const newMember: CompanyMember = {
      id: `mem_${crypto.randomUUID()}`,
      companyId,
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      role: 'Owner',
      jobTitle: user.jobTitle || 'Owner',
      phone: user.phone,
      status: 'Active',
      createdAt: nowIso,
    };

    const primaryLoc: BusinessLocation = {
      id: `loc_${crypto.randomUUID()}`,
      companyId,
      name: 'Main Office',
      address: '',
      city: '',
      state: newCompany.primaryState,
      zipCode: '',
      phone: '',
      isPrimary: true,
      createdAt: nowIso,
    };

    db.companies.push(newCompany);
    db.members.push(newMember);
    db.locations.push(primaryLoc);
    store.logActivity({
      companyId,
      actorName: user.fullName,
      action: 'Created company workspace',
      entityType: 'company',
      entityId: companyId,
      entityTitle: cleanName,
      details: 'Added new company profile',
    });
    store.persist();

    res.status(201).json({
      company: newCompany,
      companies: store.getUserCompanies(user.id),
    });
  });

  app.post('/api/c/:companyId/demo/reset', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    if (!req.companyAccess!.company.isDemo) {
      return res.status(400).json({ error: 'Only the demo workspace can be reset.' });
    }
    store.resetDemoWorkspace();
    res.json({ ok: true });
  });

  // ── DASHBOARD ──────────────────────────────────────────────────────────────
  app.get('/api/c/:companyId/dashboard', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const summary = store.getDashboard(req.companyAccess!.company.id);
    res.json(summary);
  });

  // ── LICENSES ───────────────────────────────────────────────────────────────
  app.get('/api/c/:companyId/licenses', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const companyId = req.companyAccess!.company.id;
    const db = store.getDb();
    const licenses = db.licenses.filter((l) => l.companyId === companyId);
    res.json(licenses);
  });

  app.post('/api/c/:companyId/licenses', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const company = req.companyAccess!.company;
    const {
      name,
      licenseNumber,
      category,
      issuingAuthority,
      stateOrJurisdiction,
      locationId,
      issueDate,
      expirationDate,
      notes,
      attachment,
    } = req.body || {};

    if (!String(name || '').trim() || !String(expirationDate || '').trim()) {
      return res.status(400).json({ error: 'License name and expiration date are required.' });
    }

    const db = store.getDb();
    const nowIso = new Date().toISOString();
    const licId = `lic_${crypto.randomUUID()}`;
    const threshold = company.notificationPreferences?.warningThresholdDays ?? 60;
    const calc = calculateLicenseStatus(String(expirationDate), threshold);

    const newLicense: License = {
      id: licId,
      companyId: company.id,
      name: String(name).trim(),
      licenseNumber: String(licenseNumber || '').trim() || 'N/A',
      category: category || 'HVAC Contractor License',
      issuingAuthority: String(issuingAuthority || '').trim() || 'State Licensing Board',
      stateOrJurisdiction: String(stateOrJurisdiction || company.primaryState || '').trim(),
      locationId: locationId || null,
      issueDate: String(issueDate || getTodayYmd()),
      expirationDate: String(expirationDate),
      status: calc.status,
      daysRemaining: calc.daysRemaining,
      notes: String(notes || '').trim(),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.licenses.unshift(newLicense);

    // Optional uploaded document directly during license creation
    let createdDoc: DocumentRecord | null = null;
    if (attachment && attachment.fileName && attachment.base64Data) {
      const docId = `doc_${crypto.randomUUID()}`;
      const cleanName = safeFileName(String(attachment.fileName));
      const companyDir = path.join(UPLOADS_DIR, company.id);
      fs.mkdirSync(companyDir, { recursive: true });
      const filePath = path.join(companyDir, `${docId}_${cleanName}`);
      const buffer = Buffer.from(String(attachment.base64Data), 'base64');
      fs.writeFileSync(filePath, buffer);

      createdDoc = {
        id: docId,
        companyId: company.id,
        fileName: String(attachment.fileName),
        originalName: String(attachment.fileName),
        mimeType: String(attachment.mimeType || 'application/octet-stream'),
        fileSize: buffer.length,
        storagePath: filePath,
        category: 'Licenses',
        uploadDate: getTodayYmd(),
        expirationDate: newLicense.expirationDate,
        relatedLicenseId: licId,
        relatedRequirementId: null,
        notes: `Uploaded alongside license ${newLicense.name}`,
        uploadedByName: req.currentUser!.fullName,
        createdAt: nowIso,
      };
      db.documents.unshift(createdDoc);
    }

    store.logActivity({
      companyId: company.id,
      actorName: req.currentUser!.fullName,
      action: 'Created license',
      entityType: 'license',
      entityId: licId,
      entityTitle: newLicense.name,
      details: `${newLicense.licenseNumber} · Expires ${newLicense.expirationDate}`,
    });

    store.syncCompany(company.id);
    store.persist();
    res.status(201).json({ license: newLicense, document: createdDoc });
  });

  app.put('/api/c/:companyId/licenses/:id', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const company = req.companyAccess!.company;
    const db = store.getDb();
    const license = db.licenses.find((l) => l.id === req.params.id && l.companyId === company.id);
    if (!license) {
      return res.status(404).json({ error: 'License record not found.' });
    }

    const {
      name,
      licenseNumber,
      category,
      issuingAuthority,
      stateOrJurisdiction,
      locationId,
      issueDate,
      expirationDate,
      notes,
    } = req.body || {};

    if (name !== undefined) license.name = String(name).trim() || license.name;
    if (licenseNumber !== undefined) license.licenseNumber = String(licenseNumber).trim() || 'N/A';
    if (category !== undefined) license.category = category;
    if (issuingAuthority !== undefined) license.issuingAuthority = String(issuingAuthority).trim();
    if (stateOrJurisdiction !== undefined) license.stateOrJurisdiction = String(stateOrJurisdiction).trim();
    if (locationId !== undefined) license.locationId = locationId || null;
    if (issueDate !== undefined) license.issueDate = String(issueDate);
    if (expirationDate !== undefined) license.expirationDate = String(expirationDate);
    if (notes !== undefined) license.notes = String(notes).trim();
    license.updatedAt = new Date().toISOString();

    store.logActivity({
      companyId: company.id,
      actorName: req.currentUser!.fullName,
      action: 'Updated license',
      entityType: 'license',
      entityId: license.id,
      entityTitle: license.name,
      details: `Expiration: ${license.expirationDate}`,
    });

    store.syncCompany(company.id);
    store.persist();
    res.json({ license });
  });

  app.delete('/api/c/:companyId/licenses/:id', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const company = req.companyAccess!.company;
    const db = store.getDb();
    const idx = db.licenses.findIndex((l) => l.id === req.params.id && l.companyId === company.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'License record not found.' });
    }
    const [removed] = db.licenses.splice(idx, 1);

    // Unlink associated documents & requirements rather than deleting uploaded evidence
    for (const d of db.documents) {
      if (d.companyId === company.id && d.relatedLicenseId === removed.id) {
        d.relatedLicenseId = null;
      }
    }
    for (const r of db.requirements) {
      if (r.companyId === company.id && r.relatedLicenseId === removed.id) {
        r.relatedLicenseId = null;
      }
    }
    for (const ev of db.calendarEvents) {
      if (ev.companyId === company.id && ev.relatedLicenseId === removed.id && ev.sourceType === 'manual') {
        ev.relatedLicenseId = null;
      }
    }

    store.logActivity({
      companyId: company.id,
      actorName: req.currentUser!.fullName,
      action: 'Deleted license',
      entityType: 'license',
      entityId: removed.id,
      entityTitle: removed.name,
      details: `Removed license ${removed.licenseNumber}`,
    });

    store.syncCompany(company.id);
    store.persist();
    res.json({ ok: true });
  });

  // ── DOCUMENTS ──────────────────────────────────────────────────────────────
  app.get('/api/c/:companyId/documents', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const companyId = req.companyAccess!.company.id;
    const docs = store.getDb().documents.filter((d) => d.companyId === companyId);
    res.json(docs);
  });

  app.post('/api/c/:companyId/documents', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const company = req.companyAccess!.company;
    const {
      fileName,
      mimeType,
      base64Data,
      category,
      expirationDate,
      relatedLicenseId,
      relatedRequirementId,
      notes,
    } = req.body || {};

    if (!fileName || !base64Data) {
      return res.status(400).json({ error: 'File name and file contents are required.' });
    }

    const buffer = Buffer.from(String(base64Data), 'base64');
    if (buffer.length > 15 * 1024 * 1024) {
      return res.status(400).json({ error: 'File exceeds the 15 MB upload limit.' });
    }

    const docId = `doc_${crypto.randomUUID()}`;
    const cleanName = safeFileName(String(fileName));
    const companyDir = path.join(UPLOADS_DIR, company.id);
    fs.mkdirSync(companyDir, { recursive: true });
    const storagePath = path.join(companyDir, `${docId}_${cleanName}`);
    fs.writeFileSync(storagePath, buffer);

    const newDoc: DocumentRecord = {
      id: docId,
      companyId: company.id,
      fileName: String(fileName),
      originalName: String(fileName),
      mimeType: String(mimeType || 'application/octet-stream'),
      fileSize: buffer.length,
      storagePath,
      category: category || 'Other',
      uploadDate: getTodayYmd(),
      expirationDate: expirationDate ? String(expirationDate) : null,
      relatedLicenseId: relatedLicenseId || null,
      relatedRequirementId: relatedRequirementId || null,
      notes: String(notes || '').trim(),
      uploadedByName: req.currentUser!.fullName,
      createdAt: new Date().toISOString(),
    };

    store.getDb().documents.unshift(newDoc);
    store.logActivity({
      companyId: company.id,
      actorName: req.currentUser!.fullName,
      action: 'Uploaded document',
      entityType: 'document',
      entityId: docId,
      entityTitle: newDoc.fileName,
      details: `Category: ${newDoc.category}`,
    });
    store.persist();

    res.status(201).json({ document: newDoc });
  });

  app.patch('/api/c/:companyId/documents/:id', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const company = req.companyAccess!.company;
    const doc = store
      .getDb()
      .documents.find((d) => d.id === req.params.id && d.companyId === company.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    const { category, expirationDate, relatedLicenseId, relatedRequirementId, notes, fileName } = req.body || {};
    if (fileName !== undefined && String(fileName).trim()) doc.fileName = String(fileName).trim();
    if (category !== undefined) doc.category = category;
    if (expirationDate !== undefined) doc.expirationDate = expirationDate || null;
    if (relatedLicenseId !== undefined) doc.relatedLicenseId = relatedLicenseId || null;
    if (relatedRequirementId !== undefined) doc.relatedRequirementId = relatedRequirementId || null;
    if (notes !== undefined) doc.notes = String(notes).trim();

    store.logActivity({
      companyId: company.id,
      actorName: req.currentUser!.fullName,
      action: 'Updated document details',
      entityType: 'document',
      entityId: doc.id,
      entityTitle: doc.fileName,
      details: `Category: ${doc.category}`,
    });
    store.persist();
    res.json({ document: doc });
  });

  app.get('/api/c/:companyId/documents/:id/file', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const company = req.companyAccess!.company;
    const doc = store
      .getDb()
      .documents.find((d) => d.id === req.params.id && d.companyId === company.id);
    if (!doc || !fs.existsSync(doc.storagePath)) {
      return res.status(404).json({ error: 'Stored file not found on disk.' });
    }
    const isDownload = req.query.download === '1';
    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `${isDownload ? 'attachment' : 'inline'}; filename="${encodeURIComponent(doc.fileName)}"`
    );
    fs.createReadStream(doc.storagePath).pipe(res);
  });

  app.delete('/api/c/:companyId/documents/:id', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const company = req.companyAccess!.company;
    const db = store.getDb();
    const idx = db.documents.findIndex((d) => d.id === req.params.id && d.companyId === company.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Document not found.' });
    }
    const [removed] = db.documents.splice(idx, 1);

    try {
      if (removed.storagePath && fs.existsSync(removed.storagePath)) {
        fs.unlinkSync(removed.storagePath);
      }
    } catch (err) {
      console.error('Failed to remove file from disk:', err);
    }

    for (const r of db.requirements) {
      if (r.companyId === company.id && r.relatedDocumentId === removed.id) {
        r.relatedDocumentId = null;
      }
    }
    for (const ev of db.calendarEvents) {
      if (ev.companyId === company.id && ev.relatedDocumentId === removed.id) {
        ev.relatedDocumentId = null;
      }
    }

    store.logActivity({
      companyId: company.id,
      actorName: req.currentUser!.fullName,
      action: 'Deleted document',
      entityType: 'document',
      entityId: removed.id,
      entityTitle: removed.fileName,
      details: `Removed from ${removed.category}`,
    });
    store.persist();
    res.json({ ok: true });
  });

  // ── COMPLIANCE REQUIREMENTS ────────────────────────────────────────────────
  app.get('/api/c/:companyId/requirements', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const companyId = req.companyAccess!.company.id;
    const list = store.getDb().requirements.filter((r) => r.companyId === companyId);
    res.json(list);
  });

  app.post('/api/c/:companyId/requirements', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const company = req.companyAccess!.company;
    const {
      title,
      description,
      category,
      responsibleMemberId,
      relatedLicenseId,
      relatedDocumentId,
      dueDate,
      status,
      notes,
    } = req.body || {};

    if (!String(title || '').trim() || !String(dueDate || '').trim()) {
      return res.status(400).json({ error: 'Requirement title and due date are required.' });
    }

    const db = store.getDb();
    const member = responsibleMemberId
      ? db.members.find((m) => m.id === responsibleMemberId && m.companyId === company.id)
      : null;

    const nowIso = new Date().toISOString();
    const reqId = `req_${crypto.randomUUID()}`;
    const chosenStatus = status || 'Not Started';

    const newReq: ComplianceRequirement = {
      id: reqId,
      companyId: company.id,
      title: String(title).trim(),
      description: String(description || '').trim(),
      category: category || 'License Renewal',
      responsibleMemberId: member ? member.id : null,
      responsibleName: member ? member.fullName : '',
      relatedLicenseId: relatedLicenseId || null,
      relatedDocumentId: relatedDocumentId || null,
      dueDate: String(dueDate),
      status: chosenStatus,
      completedAt: chosenStatus === 'Completed' ? getTodayYmd() : null,
      notes: String(notes || '').trim(),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.requirements.unshift(newReq);
    store.logActivity({
      companyId: company.id,
      actorName: req.currentUser!.fullName,
      action: 'Created compliance requirement',
      entityType: 'requirement',
      entityId: reqId,
      entityTitle: newReq.title,
      details: `Due ${newReq.dueDate}${newReq.responsibleName ? ` · Assigned to ${newReq.responsibleName}` : ''}`,
    });

    store.syncCompany(company.id);
    store.persist();
    res.status(201).json({ requirement: newReq });
  });

  app.put('/api/c/:companyId/requirements/:id', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const company = req.companyAccess!.company;
    const db = store.getDb();
    const item = db.requirements.find((r) => r.id === req.params.id && r.companyId === company.id);
    if (!item) {
      return res.status(404).json({ error: 'Compliance requirement not found.' });
    }

    const {
      title,
      description,
      category,
      responsibleMemberId,
      relatedLicenseId,
      relatedDocumentId,
      dueDate,
      status,
      notes,
    } = req.body || {};

    const prevStatus = item.status;
    if (title !== undefined) item.title = String(title).trim() || item.title;
    if (description !== undefined) item.description = String(description).trim();
    if (category !== undefined) item.category = category;
    if (responsibleMemberId !== undefined) {
      const member = responsibleMemberId
        ? db.members.find((m) => m.id === responsibleMemberId && m.companyId === company.id)
        : null;
      item.responsibleMemberId = member ? member.id : null;
      item.responsibleName = member ? member.fullName : '';
    }
    if (relatedLicenseId !== undefined) item.relatedLicenseId = relatedLicenseId || null;
    if (relatedDocumentId !== undefined) item.relatedDocumentId = relatedDocumentId || null;
    if (dueDate !== undefined) item.dueDate = String(dueDate);
    if (status !== undefined) {
      item.status = status;
      item.completedAt = status === 'Completed' ? getTodayYmd() : null;
    }
    if (notes !== undefined) item.notes = String(notes).trim();
    item.updatedAt = new Date().toISOString();

    store.logActivity({
      companyId: company.id,
      actorName: req.currentUser!.fullName,
      action: prevStatus !== item.status && item.status === 'Completed' ? 'Completed requirement' : 'Updated requirement',
      entityType: 'requirement',
      entityId: item.id,
      entityTitle: item.title,
      details: `Status: ${item.status} · Due ${item.dueDate}`,
    });

    store.syncCompany(company.id);
    store.persist();
    res.json({ requirement: item });
  });

  app.delete('/api/c/:companyId/requirements/:id', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const company = req.companyAccess!.company;
    const db = store.getDb();
    const idx = db.requirements.findIndex((r) => r.id === req.params.id && r.companyId === company.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Compliance requirement not found.' });
    }
    const [removed] = db.requirements.splice(idx, 1);

    for (const d of db.documents) {
      if (d.companyId === company.id && d.relatedRequirementId === removed.id) {
        d.relatedRequirementId = null;
      }
    }
    for (const ev of db.calendarEvents) {
      if (ev.companyId === company.id && ev.relatedRequirementId === removed.id && ev.sourceType === 'manual') {
        ev.relatedRequirementId = null;
      }
    }

    store.logActivity({
      companyId: company.id,
      actorName: req.currentUser!.fullName,
      action: 'Deleted requirement',
      entityType: 'requirement',
      entityId: removed.id,
      entityTitle: removed.title,
      details: 'Removed compliance requirement',
    });

    store.syncCompany(company.id);
    store.persist();
    res.json({ ok: true });
  });

  // ── CALENDAR EVENTS ────────────────────────────────────────────────────────
  app.get('/api/c/:companyId/calendar', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const companyId = req.companyAccess!.company.id;
    const events = store.getDb().calendarEvents.filter((e) => e.companyId === companyId);
    res.json(events);
  });

  app.post('/api/c/:companyId/calendar', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const company = req.companyAccess!.company;
    const {
      title,
      description,
      date,
      time,
      isAllDay,
      category,
      responsibleMemberId,
      locationId,
      relatedLicenseId,
      relatedDocumentId,
      relatedRequirementId,
      priority,
    } = req.body || {};

    if (!String(title || '').trim() || !String(date || '').trim()) {
      return res.status(400).json({ error: 'Event title and date are required.' });
    }

    const db = store.getDb();
    const member = responsibleMemberId
      ? db.members.find((m) => m.id === responsibleMemberId && m.companyId === company.id)
      : null;

    const nowIso = new Date().toISOString();
    const evId = `ev_${crypto.randomUUID()}`;
    const newEvent: CalendarEvent = {
      id: evId,
      companyId: company.id,
      title: String(title).trim(),
      description: String(description || '').trim(),
      date: String(date),
      time: isAllDay ? null : time ? String(time) : '09:00',
      isAllDay: Boolean(isAllDay),
      category: category || 'General',
      responsibleMemberId: member ? member.id : null,
      responsibleName: member ? member.fullName : '',
      locationId: locationId || null,
      relatedLicenseId: relatedLicenseId || null,
      relatedDocumentId: relatedDocumentId || null,
      relatedRequirementId: relatedRequirementId || null,
      priority: priority || 'Medium',
      isCompleted: false,
      completedAt: null,
      sourceType: 'manual',
      sourceEntityId: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.calendarEvents.push(newEvent);
    store.logActivity({
      companyId: company.id,
      actorName: req.currentUser!.fullName,
      action: 'Scheduled calendar event',
      entityType: 'calendar',
      entityId: evId,
      entityTitle: newEvent.title,
      details: `${newEvent.date}${newEvent.isAllDay ? ' (All Day)' : newEvent.time ? ` at ${newEvent.time}` : ''}`,
    });
    store.persist();
    res.status(201).json({ event: newEvent });
  });

  app.put('/api/c/:companyId/calendar/:id', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const company = req.companyAccess!.company;
    const db = store.getDb();
    const ev = db.calendarEvents.find((e) => e.id === req.params.id && e.companyId === company.id);
    if (!ev) {
      return res.status(404).json({ error: 'Calendar event not found.' });
    }

    const {
      title,
      description,
      date,
      time,
      isAllDay,
      category,
      responsibleMemberId,
      locationId,
      relatedLicenseId,
      relatedDocumentId,
      relatedRequirementId,
      priority,
      isCompleted,
    } = req.body || {};

    // Allow toggling completion on any event (and sync back if linked to auto_requirement_deadline)
    if (isCompleted !== undefined) {
      ev.isCompleted = Boolean(isCompleted);
      ev.completedAt = ev.isCompleted ? new Date().toISOString() : null;
      if (ev.sourceType === 'auto_requirement_deadline' && ev.sourceEntityId) {
        const linkedReq = db.requirements.find(
          (r) => r.id === ev.sourceEntityId && r.companyId === company.id
        );
        if (linkedReq) {
          linkedReq.status = ev.isCompleted ? 'Completed' : 'In Progress';
          linkedReq.completedAt = ev.isCompleted ? getTodayYmd() : null;
          linkedReq.updatedAt = new Date().toISOString();
        }
      }
    }

    if (ev.sourceType === 'manual') {
      if (title !== undefined) ev.title = String(title).trim() || ev.title;
      if (description !== undefined) ev.description = String(description).trim();
      if (date !== undefined) ev.date = String(date);
      if (isAllDay !== undefined) ev.isAllDay = Boolean(isAllDay);
      if (time !== undefined) ev.time = ev.isAllDay ? null : time ? String(time) : null;
      if (category !== undefined) ev.category = category;
      if (responsibleMemberId !== undefined) {
        const member = responsibleMemberId
          ? db.members.find((m) => m.id === responsibleMemberId && m.companyId === company.id)
          : null;
        ev.responsibleMemberId = member ? member.id : null;
        ev.responsibleName = member ? member.fullName : '';
      }
      if (locationId !== undefined) ev.locationId = locationId || null;
      if (relatedLicenseId !== undefined) ev.relatedLicenseId = relatedLicenseId || null;
      if (relatedDocumentId !== undefined) ev.relatedDocumentId = relatedDocumentId || null;
      if (relatedRequirementId !== undefined) ev.relatedRequirementId = relatedRequirementId || null;
      if (priority !== undefined) ev.priority = priority;
    }

    ev.updatedAt = new Date().toISOString();
    store.logActivity({
      companyId: company.id,
      actorName: req.currentUser!.fullName,
      action: isCompleted !== undefined && ev.isCompleted ? 'Completed calendar event' : 'Updated calendar event',
      entityType: 'calendar',
      entityId: ev.id,
      entityTitle: ev.title,
      details: `Date: ${ev.date}`,
    });

    store.syncCompany(company.id);
    store.persist();
    res.json({ event: ev });
  });

  app.delete('/api/c/:companyId/calendar/:id', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const company = req.companyAccess!.company;
    const db = store.getDb();
    const idx = db.calendarEvents.findIndex((e) => e.id === req.params.id && e.companyId === company.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Calendar event not found.' });
    }
    const ev = db.calendarEvents[idx];
    if (ev.sourceType !== 'manual') {
      return res.status(400).json({
        error: 'Automatic deadlines stay synced with their source license or requirement. Edit or remove the source record instead.',
      });
    }
    db.calendarEvents.splice(idx, 1);
    store.logActivity({
      companyId: company.id,
      actorName: req.currentUser!.fullName,
      action: 'Deleted calendar event',
      entityType: 'calendar',
      entityId: ev.id,
      entityTitle: ev.title,
      details: `Removed event on ${ev.date}`,
    });
    store.persist();
    res.json({ ok: true });
  });

  // ── NOTIFICATIONS ──────────────────────────────────────────────────────────
  app.get('/api/c/:companyId/notifications', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const companyId = req.companyAccess!.company.id;
    const list = store
      .getDb()
      .notifications.filter((n) => n.companyId === companyId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json(list);
  });

  app.post('/api/c/:companyId/notifications/check', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const companyId = req.companyAccess!.company.id;
    store.syncCompany(companyId);
    const list = store
      .getDb()
      .notifications.filter((n) => n.companyId === companyId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json(list);
  });

  app.patch('/api/c/:companyId/notifications/:id/read', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const companyId = req.companyAccess!.company.id;
    const notif = store
      .getDb()
      .notifications.find((n) => n.id === req.params.id && n.companyId === companyId);
    if (!notif) {
      return res.status(404).json({ error: 'Notification not found.' });
    }
    notif.isRead = req.body?.isRead !== undefined ? Boolean(req.body.isRead) : true;
    store.persist();
    res.json({ notification: notif });
  });

  app.post('/api/c/:companyId/notifications/mark-all-read', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const companyId = req.companyAccess!.company.id;
    for (const n of store.getDb().notifications) {
      if (n.companyId === companyId) n.isRead = true;
    }
    store.persist();
    res.json({ ok: true });
  });

  // ── ACTIVITY LOGS ──────────────────────────────────────────────────────────
  app.get('/api/c/:companyId/activity', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const companyId = req.companyAccess!.company.id;
    const logs = store
      .getDb()
      .activityLogs.filter((a) => a.companyId === companyId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json(logs);
  });

  // ── SETTINGS, LOCATIONS & TEAM MEMBERS ─────────────────────────────────────
  app.get('/api/c/:companyId/settings', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const company = req.companyAccess!.company;
    const db = store.getDb();
    res.json({
      company,
      membership: req.companyAccess!.membership,
      user: req.currentUser,
      locations: db.locations.filter((l) => l.companyId === company.id),
      members: db.members.filter((m) => m.companyId === company.id),
    });
  });

  app.put('/api/c/:companyId/settings/company', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const company = req.companyAccess!.company;
    const {
      name,
      legalName,
      industry,
      ein,
      primaryState,
      email,
      phone,
      website,
      address,
      notificationPreferences,
    } = req.body || {};

    if (name !== undefined && String(name).trim()) company.name = String(name).trim();
    if (legalName !== undefined) company.legalName = String(legalName).trim();
    if (industry !== undefined) company.industry = String(industry).trim();
    if (ein !== undefined) company.ein = String(ein).trim();
    if (primaryState !== undefined) company.primaryState = String(primaryState).trim();
    if (email !== undefined) company.email = String(email).trim();
    if (phone !== undefined) company.phone = String(phone).trim();
    if (website !== undefined) company.website = String(website).trim();
    if (address !== undefined) company.address = String(address).trim();
    if (notificationPreferences) {
      const nextThresh = Number(notificationPreferences.warningThresholdDays);
      company.notificationPreferences = {
        ...company.notificationPreferences,
        warningThresholdDays:
          Number.isFinite(nextThresh) && nextThresh >= 7 && nextThresh <= 365
            ? nextThresh
            : company.notificationPreferences.warningThresholdDays,
        reminderIntervals: Array.isArray(notificationPreferences.reminderIntervals)
          ? notificationPreferences.reminderIntervals.map(Number).filter((n: number) => Number.isFinite(n) && n >= 0)
          : company.notificationPreferences.reminderIntervals,
        inAppEnabled:
          notificationPreferences.inAppEnabled !== undefined
            ? Boolean(notificationPreferences.inAppEnabled)
            : company.notificationPreferences.inAppEnabled,
        emailDigestEnabled:
          notificationPreferences.emailDigestEnabled !== undefined
            ? Boolean(notificationPreferences.emailDigestEnabled)
            : company.notificationPreferences.emailDigestEnabled,
        emailAddress:
          notificationPreferences.emailAddress !== undefined
            ? String(notificationPreferences.emailAddress).trim()
            : company.notificationPreferences.emailAddress,
      };
    }
    company.updatedAt = new Date().toISOString();

    store.logActivity({
      companyId: company.id,
      actorName: req.currentUser!.fullName,
      action: 'Updated company settings',
      entityType: 'company',
      entityId: company.id,
      entityTitle: company.name,
      details: `Warning threshold: ${company.notificationPreferences.warningThresholdDays} days`,
    });

    store.syncCompany(company.id);
    store.persist();
    res.json({ company });
  });

  app.put('/api/c/:companyId/settings/profile', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const db = store.getDb();
    const user = db.users.find((u) => u.id === req.currentUser!.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const { fullName, jobTitle, phone } = req.body || {};
    if (fullName !== undefined && String(fullName).trim()) user.fullName = String(fullName).trim();
    if (jobTitle !== undefined) user.jobTitle = String(jobTitle).trim();
    if (phone !== undefined) user.phone = String(phone).trim();

    for (const m of db.members) {
      if (m.userId === user.id) {
        m.fullName = user.fullName;
        m.jobTitle = user.jobTitle;
        m.phone = user.phone;
      }
    }
    store.persist();
    res.json({ user: store.sanitizeUser(user) });
  });

  app.post('/api/c/:companyId/locations', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const company = req.companyAccess!.company;
    const { name, address, city, state, zipCode, phone, isPrimary } = req.body || {};
    if (!String(name || '').trim()) {
      return res.status(400).json({ error: 'Location name is required.' });
    }
    const db = store.getDb();
    if (isPrimary) {
      for (const l of db.locations) {
        if (l.companyId === company.id) l.isPrimary = false;
      }
    }
    const loc: BusinessLocation = {
      id: `loc_${crypto.randomUUID()}`,
      companyId: company.id,
      name: String(name).trim(),
      address: String(address || '').trim(),
      city: String(city || '').trim(),
      state: String(state || '').trim(),
      zipCode: String(zipCode || '').trim(),
      phone: String(phone || '').trim(),
      isPrimary: Boolean(isPrimary),
      createdAt: new Date().toISOString(),
    };
    db.locations.push(loc);
    store.logActivity({
      companyId: company.id,
      actorName: req.currentUser!.fullName,
      action: 'Added business location',
      entityType: 'location',
      entityId: loc.id,
      entityTitle: loc.name,
      details: [loc.city, loc.state].filter(Boolean).join(', ') || 'Location added',
    });
    store.persist();
    res.status(201).json({ location: loc });
  });

  app.put('/api/c/:companyId/locations/:id', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const company = req.companyAccess!.company;
    const db = store.getDb();
    const loc = db.locations.find((l) => l.id === req.params.id && l.companyId === company.id);
    if (!loc) return res.status(404).json({ error: 'Location not found.' });

    const { name, address, city, state, zipCode, phone, isPrimary } = req.body || {};
    if (isPrimary) {
      for (const l of db.locations) {
        if (l.companyId === company.id) l.isPrimary = false;
      }
    }
    if (name !== undefined && String(name).trim()) loc.name = String(name).trim();
    if (address !== undefined) loc.address = String(address).trim();
    if (city !== undefined) loc.city = String(city).trim();
    if (state !== undefined) loc.state = String(state).trim();
    if (zipCode !== undefined) loc.zipCode = String(zipCode).trim();
    if (phone !== undefined) loc.phone = String(phone).trim();
    if (isPrimary !== undefined) loc.isPrimary = Boolean(isPrimary);

    store.persist();
    res.json({ location: loc });
  });

  app.delete('/api/c/:companyId/locations/:id', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const company = req.companyAccess!.company;
    const db = store.getDb();
    const idx = db.locations.findIndex((l) => l.id === req.params.id && l.companyId === company.id);
    if (idx === -1) return res.status(404).json({ error: 'Location not found.' });
    const [removed] = db.locations.splice(idx, 1);

    for (const lic of db.licenses) {
      if (lic.companyId === company.id && lic.locationId === removed.id) lic.locationId = null;
    }
    for (const ev of db.calendarEvents) {
      if (ev.companyId === company.id && ev.locationId === removed.id) ev.locationId = null;
    }
    store.persist();
    res.json({ ok: true });
  });

  app.post('/api/c/:companyId/members', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const company = req.companyAccess!.company;
    const { fullName, email, role, jobTitle, phone } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanName = String(fullName || '').trim();
    if (!cleanName || !cleanEmail) {
      return res.status(400).json({ error: 'Team member name and email are required.' });
    }
    const db = store.getDb();
    if (db.members.some((m) => m.companyId === company.id && m.email.toLowerCase() === cleanEmail)) {
      return res.status(409).json({ error: 'This team member email is already in the company roster.' });
    }
    const existingUser = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
    const member: CompanyMember = {
      id: `mem_${crypto.randomUUID()}`,
      companyId: company.id,
      userId: existingUser ? existingUser.id : null,
      fullName: cleanName,
      email: cleanEmail,
      role: role || 'Member',
      jobTitle: String(jobTitle || '').trim(),
      phone: String(phone || '').trim(),
      status: existingUser ? 'Active' : 'Invited',
      createdAt: new Date().toISOString(),
    };
    db.members.push(member);
    store.logActivity({
      companyId: company.id,
      actorName: req.currentUser!.fullName,
      action: 'Added team member',
      entityType: 'member',
      entityId: member.id,
      entityTitle: member.fullName,
      details: `${member.role} · ${member.email}`,
    });
    store.persist();
    res.status(201).json({ member });
  });

  app.delete('/api/c/:companyId/members/:id', requireAuth, requireCompanyAccess, (req: AuthedRequest, res) => {
    const company = req.companyAccess!.company;
    const db = store.getDb();
    const idx = db.members.findIndex((m) => m.id === req.params.id && m.companyId === company.id);
    if (idx === -1) return res.status(404).json({ error: 'Team member not found.' });
    if (db.members[idx].role === 'Owner' && db.members[idx].userId === req.currentUser!.id) {
      return res.status(400).json({ error: 'You cannot remove yourself as company owner.' });
    }
    const [removed] = db.members.splice(idx, 1);
    store.persist();
    res.json({ ok: true, removedId: removed.id });
  });

  // ── VITE / STATIC SERVING ──────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`${BRAND_CONFIG.appName} server running on http://localhost:${PORT}`);
  });
}

startServer();
