import React, { useState } from 'react';
import {
  Bell,
  Building2,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  FileText,
  Home,
  LayoutGrid,
  LogOut,
  Plus,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import { BRAND_CONFIG } from '../config/brand';
import { useAuth } from '../context/AuthContext';

export type NavTab =
  | 'dashboard'
  | 'licenses'
  | 'calendar'
  | 'documents'
  | 'compliance'
  | 'notifications'
  | 'settings';

interface AppShellProps {
  activeTab: NavTab;
  onNavigate: (tab: NavTab) => void;
  unreadNotifications: number;
  onQuickAction: (action: 'add_license' | 'upload_doc' | 'create_requirement' | 'add_event') => void;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{ id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'licenses', label: 'Licenses', icon: ShieldCheck },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'compliance', label: 'Compliance', icon: CheckSquare },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function AppShell({
  activeTab,
  onNavigate,
  unreadNotifications,
  onQuickAction,
  children,
}: AppShellProps) {
  const { user, companies, activeCompany, setActiveCompanyId, createCompany, logout } = useAuth();
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [newCompanyModalOpen, setNewCompanyModalOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyState, setNewCompanyState] = useState('AZ');
  const [creatingCompany, setCreatingCompany] = useState(false);

  const activeTitle = NAV_ITEMS.find((n) => n.id === activeTab)?.label || 'Dashboard';

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    setCreatingCompany(true);
    try {
      await createCompany({
        name: newCompanyName.trim(),
        primaryState: newCompanyState.trim() || 'AZ',
        industry: 'HVAC & Mechanical Contracting',
      });
      setNewCompanyName('');
      setNewCompanyModalOpen(false);
      setCompanyMenuOpen(false);
    } finally {
      setCreatingCompany(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6FB] text-slate-900">
      {/* Desktop Left Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-[#0F172A] text-white md:flex">
        {/* Brand Wordmark */}
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#4F46E5] text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight whitespace-nowrap">
            {BRAND_CONFIG.appName}
          </span>
        </div>

        {/* Company Switcher */}
        <div className="relative border-b border-white/10 p-3">
          <button
            type="button"
            onClick={() => setCompanyMenuOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2.5 text-left transition-colors hover:bg-white/10"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#4F46E5]/30 text-indigo-200">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {activeCompany?.name || 'Select Company'}
                </p>
                <p className="truncate text-[11px] text-slate-400">
                  {activeCompany?.isDemo ? 'Demo Workspace' : activeCompany?.primaryState || 'Company Workspace'}
                </p>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          </button>

          {companyMenuOpen && (
            <div className="absolute left-3 right-3 top-full z-40 mt-1.5 rounded-xl border border-slate-700 bg-[#1E293B] p-1.5 shadow-xl">
              {companies.map(({ company }) => (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => {
                    setActiveCompanyId(company.id);
                    setCompanyMenuOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                    company.id === activeCompany?.id
                      ? 'bg-[#4F46E5] text-white font-semibold'
                      : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <span className="truncate">{company.name}</span>
                  {company.isDemo && (
                    <span className="ml-2 shrink-0 text-[10px] text-indigo-200">Demo</span>
                  )}
                </button>
              ))}
              <div className="my-1 border-t border-slate-700" />
              <button
                type="button"
                onClick={() => {
                  setCompanyMenuOpen(false);
                  setNewCompanyModalOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-indigo-300 hover:bg-white/10"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add New Company</span>
              </button>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#4F46E5] text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3 whitespace-nowrap">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {item.id === 'notifications' && unreadNotifications > 0 && (
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                      active ? 'bg-white/20 text-white' : 'bg-red-500/20 text-red-300'
                    }`}
                  >
                    {unreadNotifications}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{user?.fullName}</p>
              <p className="truncate text-xs text-slate-400">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              title="Sign Out"
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex min-h-screen flex-col md:pl-64">
        {/* Top Bar (3-zone contract) */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0F172A] text-white md:hidden">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="hidden text-slate-400 sm:inline">{activeCompany?.name}</span>
                <span className="hidden text-slate-300 sm:inline">/</span>
                <h1 className="truncate font-display text-base font-bold text-slate-900 sm:text-lg">
                  {activeTitle}
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('notifications')}
              className="relative rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
              aria-label={`Notifications (${unreadNotifications} unread)`}
            >
              <Bell className="h-4 w-4" />
              {unreadNotifications > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white tabular-nums">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setQuickMenuOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-lg bg-[#4F46E5] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4338CA] whitespace-nowrap shrink-0"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Quick Add</span>
              </button>

              {quickMenuOpen && (
                <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onQuickAction('add_license');
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <ShieldCheck className="h-4 w-4 text-[#4F46E5]" />
                    <span>Add License</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onQuickAction('upload_doc');
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <FileText className="h-4 w-4 text-sky-600" />
                    <span>Upload Document</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onQuickAction('create_requirement');
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <CheckSquare className="h-4 w-4 text-emerald-600" />
                    <span>Create Requirement</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onQuickAction('add_event');
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <CalendarDays className="h-4 w-4 text-amber-600" />
                    <span>Add Calendar Event</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-24 sm:px-6 md:pb-8 lg:px-8">
          {children}
        </main>

        {/* Quiet Legal Disclaimer Footer */}
        <footer className="hidden border-t border-slate-200/80 bg-white/60 px-8 py-3 text-xs text-slate-500 md:flex md:items-center md:justify-between">
          <span>
            {BRAND_CONFIG.appName} · {BRAND_CONFIG.organizationalDisclaimer}
          </span>
          <span className="shrink-0">
            {activeCompany?.isDemo ? 'Interactive Demo Mode (Local Persistence)' : 'Local Workspace Persistence'}
          </span>
        </footer>
      </div>

      {/* Mobile Bottom Navigation (matches reference image & respects 15% mobile height cap) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-slate-200 bg-white px-2 md:hidden"
        aria-label="Mobile navigation"
      >
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium ${
            activeTab === 'dashboard' ? 'text-[#4F46E5]' : 'text-slate-500'
          }`}
        >
          <Home className="h-5 w-5" />
          <span>Home</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('calendar')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium ${
            activeTab === 'calendar' ? 'text-[#4F46E5]' : 'text-slate-500'
          }`}
        >
          <CalendarDays className="h-5 w-5" />
          <span>Calendar</span>
        </button>
        <button
          type="button"
          onClick={() => setQuickMenuOpen((v) => !v)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[#4F46E5] text-white shadow-md"
          aria-label="Quick Add"
        >
          <Plus className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => onNavigate('documents')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium ${
            activeTab === 'documents' ? 'text-[#4F46E5]' : 'text-slate-500'
          }`}
        >
          <FileText className="h-5 w-5" />
          <span>Docs</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileMoreOpen(true)}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium ${
            ['licenses', 'compliance', 'notifications', 'settings'].includes(activeTab)
              ? 'text-[#4F46E5]'
              : 'text-slate-500'
          }`}
        >
          <LayoutGrid className="h-5 w-5" />
          <span>More</span>
        </button>
      </nav>

      {/* Mobile "More" Drawer */}
      {mobileMoreOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/45 md:hidden">
          <div className="w-full rounded-t-2xl bg-white p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="font-display text-base font-bold text-slate-900">
                {activeCompany?.name}
              </span>
              <button
                type="button"
                onClick={() => setMobileMoreOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(['licenses', 'compliance', 'notifications', 'settings'] as NavTab[]).map((tabId) => {
                const item = NAV_ITEMS.find((n) => n.id === tabId)!;
                const Icon = item.icon;
                return (
                  <button
                    key={tabId}
                    type="button"
                    onClick={() => {
                      onNavigate(tabId);
                      setMobileMoreOpen(false);
                    }}
                    className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-sm font-medium ${
                      activeTab === tabId
                        ? 'border-[#4F46E5] bg-indigo-50 text-[#4F46E5]'
                        : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={logout}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 py-2.5 text-sm font-medium text-red-700"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Add New Company Modal */}
      {newCompanyModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-slate-900">
                Create New Company Workspace
              </h3>
              <button
                type="button"
                onClick={() => setNewCompanyModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateCompany} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700">Company Name *</label>
                <input
                  type="text"
                  required
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="Valley Mechanical HVAC Inc."
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Primary State</label>
                <input
                  type="text"
                  value={newCompanyState}
                  onChange={(e) => setNewCompanyState(e.target.value)}
                  placeholder="AZ"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setNewCompanyModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingCompany}
                  className="rounded-lg bg-[#4F46E5] px-4 py-2 text-sm font-medium text-white hover:bg-[#4338CA] disabled:opacity-50"
                >
                  {creatingCompany ? 'Creating...' : 'Create Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
