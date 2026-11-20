import { useCallback, useEffect, useState } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { AppShell, type NavTab } from './components/AppShell';
import { CalendarView } from './components/CalendarView';
import { ComplianceView } from './components/ComplianceView';
import { DashboardView } from './components/DashboardView';
import { DocumentPreviewModal } from './components/DocumentPreviewModal';
import { DocumentsView } from './components/DocumentsView';
import { LicensesView } from './components/LicensesView';
import { NotificationsView } from './components/NotificationsView';
import { SettingsView } from './components/SettingsView';
import { BRAND_CONFIG } from './config/brand';
import { AuthProvider, useAuth } from './context/AuthContext';
import { apiFetch } from './lib/api';
import type {
  BusinessLocation,
  CalendarEvent,
  CompanyMember,
  ComplianceRequirement,
  DashboardSummary,
  DocumentRecord,
  License,
  NotificationRecord,
} from './types/compliance';

function WorkspaceApp() {
  const { user, activeCompany, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [licenseStatusHint, setLicenseStatusHint] = useState<string>('All');

  // Quick action triggers forwarded to target view
  const [triggerAddLicense, setTriggerAddLicense] = useState(false);
  const [triggerUploadDoc, setTriggerUploadDoc] = useState(false);
  const [triggerCreateReq, setTriggerCreateReq] = useState(false);
  const [triggerAddEvent, setTriggerAddEvent] = useState(false);

  // Company-isolated workspace state
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [requirements, setRequirements] = useState<ComplianceRequirement[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null);

  useEffect(() => {
    document.title = activeCompany
      ? `${activeCompany.name} · ${BRAND_CONFIG.appName}`
      : `${BRAND_CONFIG.appName} — ${BRAND_CONFIG.subtitle}`;
  }, [activeCompany]);

  const loadWorkspaceData = useCallback(async () => {
    if (!activeCompany) return;
    const cid = activeCompany.id;
    setDataLoading(true);
    setLoadError(null);
    try {
      const [dashRes, licRes, docRes, reqRes, calRes, notifRes, settingsRes] = await Promise.all([
        apiFetch<DashboardSummary>(`/api/c/${cid}/dashboard`),
        apiFetch<License[]>(`/api/c/${cid}/licenses`),
        apiFetch<DocumentRecord[]>(`/api/c/${cid}/documents`),
        apiFetch<ComplianceRequirement[]>(`/api/c/${cid}/requirements`),
        apiFetch<CalendarEvent[]>(`/api/c/${cid}/calendar`),
        apiFetch<NotificationRecord[]>(`/api/c/${cid}/notifications`),
        apiFetch<{ locations: BusinessLocation[]; members: CompanyMember[] }>(
          `/api/c/${cid}/settings`
        ),
      ]);
      setDashboard(dashRes);
      setLicenses(licRes);
      setDocuments(docRes);
      setRequirements(reqRes);
      setCalendarEvents(calRes);
      setNotifications(notifRes);
      setLocations(settingsRes.locations);
      setMembers(settingsRes.members);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load company workspace.');
    } finally {
      setDataLoading(false);
    }
  }, [activeCompany]);

  useEffect(() => {
    if (user && activeCompany) {
      loadWorkspaceData();
    }
  }, [user, activeCompany, loadWorkspaceData]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6FB]">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#4F46E5]" />
          <p className="mt-3 text-sm font-medium text-slate-600">Loading {BRAND_CONFIG.appName}...</p>
        </div>
      </div>
    );
  }

  if (!user || !activeCompany) {
    return <AuthScreen />;
  }

  const handleNavigate = (tab: NavTab, filterHint?: string) => {
    if (tab === 'licenses' && filterHint) {
      setLicenseStatusHint(filterHint);
    } else if (tab === 'licenses') {
      setLicenseStatusHint('All');
    }
    setActiveTab(tab);
  };

  const handleQuickAction = (
    action: 'add_license' | 'upload_doc' | 'create_requirement' | 'add_event'
  ) => {
    if (action === 'add_license') {
      setActiveTab('licenses');
      setTriggerAddLicense(true);
    } else if (action === 'upload_doc') {
      setActiveTab('documents');
      setTriggerUploadDoc(true);
    } else if (action === 'create_requirement') {
      setActiveTab('compliance');
      setTriggerCreateReq(true);
    } else if (action === 'add_event') {
      setActiveTab('calendar');
      setTriggerAddEvent(true);
    }
  };

  const unreadNotifications = notifications.filter((n) => !n.isRead).length;

  return (
    <AppShell
      activeTab={activeTab}
      onNavigate={(t) => handleNavigate(t)}
      unreadNotifications={unreadNotifications}
      onQuickAction={handleQuickAction}
    >
      {loadError && (
        <div className="mb-5 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={loadWorkspaceData}
            className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <DashboardView
          summary={dashboard}
          loading={dataLoading}
          onNavigate={handleNavigate}
          onQuickAction={handleQuickAction}
        />
      )}

      {activeTab === 'licenses' && (
        <LicensesView
          companyId={activeCompany.id}
          licenses={licenses}
          documents={documents}
          requirements={requirements}
          locations={locations}
          initialStatusFilter={licenseStatusHint}
          openCreateRequested={triggerAddLicense}
          onConsumeCreateRequest={() => setTriggerAddLicense(false)}
          onDataChanged={loadWorkspaceData}
          onPreviewDocument={setPreviewDoc}
        />
      )}

      {activeTab === 'calendar' && (
        <CalendarView
          companyId={activeCompany.id}
          events={calendarEvents}
          licenses={licenses}
          documents={documents}
          requirements={requirements}
          locations={locations}
          members={members}
          openCreateRequested={triggerAddEvent}
          onConsumeCreateRequest={() => setTriggerAddEvent(false)}
          onDataChanged={loadWorkspaceData}
          onJumpToModule={(m) => handleNavigate(m)}
        />
      )}

      {activeTab === 'documents' && (
        <DocumentsView
          companyId={activeCompany.id}
          documents={documents}
          licenses={licenses}
          requirements={requirements}
          openUploadRequested={triggerUploadDoc}
          onConsumeUploadRequest={() => setTriggerUploadDoc(false)}
          onDataChanged={loadWorkspaceData}
          onPreviewDocument={setPreviewDoc}
        />
      )}

      {activeTab === 'compliance' && (
        <ComplianceView
          companyId={activeCompany.id}
          requirements={requirements}
          licenses={licenses}
          documents={documents}
          members={members}
          openCreateRequested={triggerCreateReq}
          onConsumeCreateRequest={() => setTriggerCreateReq(false)}
          onDataChanged={loadWorkspaceData}
        />
      )}

      {activeTab === 'notifications' && (
        <NotificationsView
          companyId={activeCompany.id}
          notifications={notifications}
          onDataChanged={loadWorkspaceData}
          onNavigateToEntity={(entityType) => {
            if (entityType === 'license') handleNavigate('licenses');
            else if (entityType === 'requirement') handleNavigate('compliance');
            else if (entityType === 'document') handleNavigate('documents');
            else if (entityType === 'calendar') handleNavigate('calendar');
          }}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsView
          company={activeCompany}
          locations={locations}
          members={members}
          onDataChanged={loadWorkspaceData}
        />
      )}

      <DocumentPreviewModal
        companyId={activeCompany.id}
        doc={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WorkspaceApp />
    </AuthProvider>
  );
}
