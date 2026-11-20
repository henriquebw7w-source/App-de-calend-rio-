import React, { useState } from 'react';
import {
  Bell,
  Building2,
  CheckCircle2,
  LogOut,
  Mail,
  MapPin,
  Plus,
  RotateCcw,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import { BRAND_CONFIG } from '../config/brand';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import type {
  BusinessLocation,
  Company,
  CompanyMember,
  MemberRole,
} from '../types/compliance';
import { ConfirmModal } from './ui/ConfirmModal';

interface SettingsViewProps {
  company: Company;
  locations: BusinessLocation[];
  members: CompanyMember[];
  onDataChanged: () => Promise<void>;
}

type SettingsTab = 'company' | 'locations' | 'team' | 'notifications' | 'profile';

export function SettingsView({
  company,
  locations,
  members,
  onDataChanged,
}: SettingsViewProps) {
  const { user, refreshSession, logout } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<SettingsTab>('company');
  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Company Form
  const [companyName, setCompanyName] = useState(company.name);
  const [legalName, setLegalName] = useState(company.legalName);
  const [industry, setIndustry] = useState(company.industry);
  const [ein, setEin] = useState(company.ein);
  const [primaryState, setPrimaryState] = useState(company.primaryState);
  const [companyEmail, setCompanyEmail] = useState(company.email);
  const [companyPhone, setCompanyPhone] = useState(company.phone);
  const [address, setAddress] = useState(company.address);

  // Notification Preferences
  const [warningThresholdDays, setWarningThresholdDays] = useState(
    company.notificationPreferences.warningThresholdDays
  );
  const [intervals, setIntervals] = useState<number[]>(
    company.notificationPreferences.reminderIntervals
  );
  const [inAppEnabled, setInAppEnabled] = useState(
    company.notificationPreferences.inAppEnabled
  );
  const [emailDigestEnabled, setEmailDigestEnabled] = useState(
    company.notificationPreferences.emailDigestEnabled
  );
  const [digestEmailAddress, setDigestEmailAddress] = useState(
    company.notificationPreferences.emailAddress || company.email
  );

  // User Profile Form
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [jobTitle, setJobTitle] = useState(user?.jobTitle || '');
  const [userPhone, setUserPhone] = useState(user?.phone || '');

  // Location Modal
  const [locModalOpen, setLocModalOpen] = useState(false);
  const [locName, setLocName] = useState('');
  const [locAddress, setLocAddress] = useState('');
  const [locCity, setLocCity] = useState('');
  const [locState, setLocState] = useState('');
  const [locZip, setLocZip] = useState('');
  const [locPhone, setLocPhone] = useState('');
  const [locPrimary, setLocPrimary] = useState(false);

  // Member Modal
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [memName, setMemName] = useState('');
  const [memEmail, setMemEmail] = useState('');
  const [memRole, setMemRole] = useState<MemberRole>('Compliance Manager');
  const [memTitle, setMemTitle] = useState('');
  const [memPhone, setMemPhone] = useState('');

  // Confirmations
  const [deleteLoc, setDeleteLoc] = useState<BusinessLocation | null>(null);
  const [deleteMember, setDeleteMember] = useState<CompanyMember | null>(null);
  const [resetDemoConfirm, setResetDemoConfirm] = useState(false);

  React.useEffect(() => {
    setCompanyName(company.name);
    setLegalName(company.legalName);
    setIndustry(company.industry);
    setEin(company.ein);
    setPrimaryState(company.primaryState);
    setCompanyEmail(company.email);
    setCompanyPhone(company.phone);
    setAddress(company.address);
    setWarningThresholdDays(company.notificationPreferences.warningThresholdDays);
    setIntervals(company.notificationPreferences.reminderIntervals);
    setInAppEnabled(company.notificationPreferences.inAppEnabled);
    setEmailDigestEnabled(company.notificationPreferences.emailDigestEnabled);
    setDigestEmailAddress(company.notificationPreferences.emailAddress || company.email);
  }, [company]);

  const showSaved = (msg: string) => {
    setSavedBanner(msg);
    setTimeout(() => setSavedBanner(null), 3500);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiFetch(`/api/c/${company.id}/settings/company`, {
        method: 'PUT',
        body: JSON.stringify({
          name: companyName,
          legalName,
          industry,
          ein,
          primaryState,
          email: companyEmail,
          phone: companyPhone,
          address,
        }),
      });
      await refreshSession();
      await onDataChanged();
      showSaved('Company information updated.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update company.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiFetch(`/api/c/${company.id}/settings/company`, {
        method: 'PUT',
        body: JSON.stringify({
          notificationPreferences: {
            warningThresholdDays: Number(warningThresholdDays),
            reminderIntervals: intervals,
            inAppEnabled,
            emailDigestEnabled,
            emailAddress: digestEmailAddress,
          },
        }),
      });
      await refreshSession();
      await onDataChanged();
      showSaved('Notification thresholds updated and statuses recalculated.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save notification preferences.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiFetch(`/api/c/${company.id}/settings/profile`, {
        method: 'PUT',
        body: JSON.stringify({ fullName, jobTitle, phone: userPhone }),
      });
      await refreshSession();
      await onDataChanged();
      showSaved('Your profile has been updated.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiFetch(`/api/c/${company.id}/locations`, {
        method: 'POST',
        body: JSON.stringify({
          name: locName,
          address: locAddress,
          city: locCity,
          state: locState,
          zipCode: locZip,
          phone: locPhone,
          isPrimary: locPrimary,
        }),
      });
      setLocName('');
      setLocAddress('');
      setLocCity('');
      setLocState('');
      setLocZip('');
      setLocPhone('');
      setLocPrimary(false);
      setLocModalOpen(false);
      await onDataChanged();
      showSaved('Business location added.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add location.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiFetch(`/api/c/${company.id}/members`, {
        method: 'POST',
        body: JSON.stringify({
          fullName: memName,
          email: memEmail,
          role: memRole,
          jobTitle: memTitle,
          phone: memPhone,
        }),
      });
      setMemName('');
      setMemEmail('');
      setMemTitle('');
      setMemPhone('');
      setMemberModalOpen(false);
      await onDataChanged();
      showSaved('Team member added to roster.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add team member.');
    } finally {
      setBusy(false);
    }
  };

  const toggleInterval = (val: number) => {
    setIntervals((prev) =>
      prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val].sort((a, b) => b - a)
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Company Header Banner (matches screen 8) */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200/80 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-[#4F46E5]">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">{company.name}</h2>
            <p className="text-sm text-slate-500">
              {company.email} · {company.primaryState || 'US'} · {locations.length} location
              {locations.length === 1 ? '' : 's'} · {members.length} team member
              {members.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {company.isDemo && (
            <button
              type="button"
              onClick={() => setResetDemoConfirm(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Demo Data</span>
            </button>
          )}
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {savedBanner && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{savedBanner}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Sub-navigation + Form Area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-slate-200/80 bg-white p-2 space-y-1">
            {(
              [
                { id: 'company', label: 'Company Information', icon: Building2 },
                { id: 'locations', label: 'Business Locations', icon: MapPin },
                { id: 'team', label: 'Team Members', icon: Users },
                { id: 'notifications', label: 'Notification Preferences', icon: Bell },
                { id: 'profile', label: 'User Profile', icon: User },
              ] as Array<{ id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }>
            ).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSubTab(tab.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
                    activeSubTab === tab.id
                      ? 'bg-[#4F46E5] text-white'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-9">
          {activeSubTab === 'company' && (
            <form
              onSubmit={handleSaveCompany}
              className="rounded-xl border border-slate-200/80 bg-white p-6 space-y-5"
            >
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  Company Information
                </h3>
                <p className="text-xs text-slate-500">
                  Manage legal business details for {BRAND_CONFIG.appName} workspaces.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Company Name *</label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Legal Entity Name</label>
                  <input
                    type="text"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Trade / Industry</label>
                  <input
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">EIN / Tax ID</label>
                  <input
                    type="text"
                    value={ein}
                    onChange={(e) => setEin(e.target.value)}
                    placeholder="XX-XXXXXXX"
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-mono focus:border-[#4F46E5] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Primary State</label>
                  <input
                    type="text"
                    value={primaryState}
                    onChange={(e) => setPrimaryState(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Company Phone</label>
                  <input
                    type="text"
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700">Primary Email</label>
                  <input
                    type="email"
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700">Headquarters Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end border-t border-slate-100 pt-4">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-[#4F46E5] px-5 py-2 text-sm font-medium text-white hover:bg-[#4338CA] disabled:opacity-50"
                >
                  {busy ? 'Saving...' : 'Save Company Info'}
                </button>
              </div>
            </form>
          )}

          {activeSubTab === 'locations' && (
            <div className="rounded-xl border border-slate-200/80 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900">
                    Business Locations
                  </h3>
                  <p className="text-xs text-slate-500">
                    Associate licenses, permits, and inspections with specific branches or depots.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLocModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#4F46E5] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#4338CA]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Location</span>
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {locations.map((loc) => (
                  <div
                    key={loc.id}
                    className="flex items-center justify-between gap-4 px-6 py-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-display text-sm font-bold text-slate-900">{loc.name}</p>
                        {loc.isPrimary && (
                          <span className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-[#4F46E5]">
                            Primary
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {[loc.address, loc.city, loc.state, loc.zipCode].filter(Boolean).join(', ') ||
                          'Address not set'}
                        {loc.phone ? ` · ${loc.phone}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteLoc(loc)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Delete location"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSubTab === 'team' && (
            <div className="rounded-xl border border-slate-200/80 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900">Team Members</h3>
                  <p className="text-xs text-slate-500">
                    Assign compliance requirements and calendar activities to authorized team members.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMemberModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#4F46E5] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#4338CA]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Member</span>
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-4 px-6 py-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-display text-sm font-bold text-slate-900">
                          {m.fullName}
                        </p>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          {m.role}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {m.email}
                        {m.jobTitle ? ` · ${m.jobTitle}` : ''} · {m.status}
                      </p>
                    </div>
                    {m.role !== 'Owner' && (
                      <button
                        type="button"
                        onClick={() => setDeleteMember(m)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Remove member"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSubTab === 'notifications' && (
            <form
              onSubmit={handleSaveNotifications}
              className="rounded-xl border border-slate-200/80 bg-white p-6 space-y-5"
            >
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  Reminder & Warning Thresholds
                </h3>
                <p className="text-xs text-slate-500">
                  Configure when licenses switch to "Expiring Soon" and when reminders are generated.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Expiring Soon Warning Threshold (Days)
                </label>
                <input
                  type="number"
                  min={7}
                  max={365}
                  value={warningThresholdDays}
                  onChange={(e) => setWarningThresholdDays(Number(e.target.value))}
                  className="mt-1.5 w-40 rounded-lg border border-slate-200 px-3.5 py-2 text-sm tabular-nums focus:border-[#4F46E5] focus:outline-none"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Default is 60 days. Changing this immediately recalculates all license statuses.
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-700">Reminder Alert Intervals</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[90, 60, 30, 14, 7, 0].map((dayVal) => {
                    const active = intervals.includes(dayVal);
                    return (
                      <button
                        key={dayVal}
                        type="button"
                        onClick={() => toggleInterval(dayVal)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? 'border-[#4F46E5] bg-indigo-50 text-[#4F46E5]'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {dayVal === 0 ? 'On expiration date' : `${dayVal} days before`}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-100 pt-4">
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    checked={inAppEnabled}
                    onChange={(e) => setInAppEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#4F46E5]"
                  />
                  <span>Enable in-app Notification Center alerts</span>
                </label>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Mail className="h-4 w-4 text-slate-500" />
                      <span>Email Notification Delivery</span>
                    </div>
                    <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                      Provider Not Configured
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Email preferences are saved in your schema for future SMTP/transactional email
                    integration. External email dispatch is disabled until an email provider is connected.
                  </p>
                  <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={emailDigestEnabled}
                        onChange={(e) => setEmailDigestEnabled(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-[#4F46E5]"
                      />
                      <span>Save digest preference for future email sync</span>
                    </label>
                    <input
                      type="email"
                      value={digestEmailAddress}
                      onChange={(e) => setDigestEmailAddress(e.target.value)}
                      placeholder="alerts@company.com"
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-[#4F46E5] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end border-t border-slate-100 pt-4">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-[#4F46E5] px-5 py-2 text-sm font-medium text-white hover:bg-[#4338CA] disabled:opacity-50"
                >
                  {busy ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </form>
          )}

          {activeSubTab === 'profile' && (
            <form
              onSubmit={handleSaveProfile}
              className="rounded-xl border border-slate-200/80 bg-white p-6 space-y-5"
            >
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">User Profile</h3>
                <p className="text-xs text-slate-500">
                  Update your account display name and contact details.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    disabled
                    value={user?.email || ''}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Job Title</label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Phone</label>
                  <input
                    type="text"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end border-t border-slate-100 pt-4">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-[#4F46E5] px-5 py-2 text-sm font-medium text-white hover:bg-[#4338CA] disabled:opacity-50"
                >
                  {busy ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Add Location Modal */}
      {locModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-display text-base font-bold text-slate-900">
                Add Business Location
              </h3>
              <button
                type="button"
                onClick={() => setLocModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddLocation} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">Location Name *</label>
                <input
                  type="text"
                  required
                  value={locName}
                  onChange={(e) => setLocName(e.target.value)}
                  placeholder="e.g. Mesa Service Depot"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Street Address</label>
                <input
                  type="text"
                  value={locAddress}
                  onChange={(e) => setLocAddress(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={locCity}
                  onChange={(e) => setLocCity(e.target.value)}
                  placeholder="City"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                />
                <input
                  type="text"
                  value={locState}
                  onChange={(e) => setLocState(e.target.value)}
                  placeholder="State"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                />
                <input
                  type="text"
                  value={locZip}
                  onChange={(e) => setLocZip(e.target.value)}
                  placeholder="ZIP"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Phone</label>
                <input
                  type="text"
                  value={locPhone}
                  onChange={(e) => setLocPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                />
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={locPrimary}
                  onChange={(e) => setLocPrimary(e.target.checked)}
                />
                <span>Set as primary headquarters</span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLocModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-[#4F46E5] px-4 py-2 text-xs font-medium text-white"
                >
                  Save Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {memberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-display text-base font-bold text-slate-900">Add Team Member</h3>
              <button
                type="button"
                onClick={() => setMemberModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddMember} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">Full Name *</label>
                <input
                  type="text"
                  required
                  value={memName}
                  onChange={(e) => setMemName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">Work Email *</label>
                <input
                  type="email"
                  required
                  value={memEmail}
                  onChange={(e) => setMemEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Role</label>
                  <select
                    value={memRole}
                    onChange={(e) => setMemRole(e.target.value as MemberRole)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Compliance Manager">Compliance Manager</option>
                    <option value="Member">Member</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Job Title</label>
                  <input
                    type="text"
                    value={memTitle}
                    onChange={(e) => setMemTitle(e.target.value)}
                    placeholder="Field Manager"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMemberModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-[#4F46E5] px-4 py-2 text-xs font-medium text-white"
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteLoc)}
        title="Remove Business Location"
        description={`Remove "${deleteLoc?.name}" from your company? Linked licenses will stay active and become company-wide.`}
        confirmLabel="Remove Location"
        onConfirm={async () => {
          if (!deleteLoc) return;
          await apiFetch(`/api/c/${company.id}/locations/${deleteLoc.id}`, { method: 'DELETE' });
          setDeleteLoc(null);
          await onDataChanged();
        }}
        onCancel={() => setDeleteLoc(null)}
      />

      <ConfirmModal
        open={Boolean(deleteMember)}
        title="Remove Team Member"
        description={`Remove "${deleteMember?.fullName}" from ${company.name}?`}
        confirmLabel="Remove Member"
        onConfirm={async () => {
          if (!deleteMember) return;
          await apiFetch(`/api/c/${company.id}/members/${deleteMember.id}`, { method: 'DELETE' });
          setDeleteMember(null);
          await onDataChanged();
        }}
        onCancel={() => setDeleteMember(null)}
      />

      <ConfirmModal
        open={resetDemoConfirm}
        title="Reset Demo Workspace"
        description="Restore Acme HVAC Corp sample licenses, documents, requirements, and calendar events to their initial demo state?"
        confirmLabel="Reset Demo Data"
        isDanger={false}
        onConfirm={async () => {
          await apiFetch(`/api/c/${company.id}/demo/reset`, { method: 'POST' });
          setResetDemoConfirm(false);
          await refreshSession();
          await onDataChanged();
          showSaved('Demo workspace restored to initial sample data.');
        }}
        onCancel={() => setResetDemoConfirm(false)}
      />
    </div>
  );
}
