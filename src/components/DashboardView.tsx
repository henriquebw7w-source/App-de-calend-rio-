import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Clock,
  FileText,
  Plus,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { BRAND_CONFIG } from '../config/brand';
import { useAuth } from '../context/AuthContext';
import { formatDisplayDate, formatRelativeTime, formatTime12h, getDaysRemainingLabel } from '../lib/format';
import type { DashboardSummary } from '../types/compliance';
import type { NavTab } from './AppShell';
import { RingGauge } from './ui/RingGauge';
import { StatusText } from './ui/StatusText';

interface DashboardViewProps {
  summary: DashboardSummary | null;
  loading: boolean;
  onNavigate: (tab: NavTab, filterHint?: string) => void;
  onQuickAction: (action: 'add_license' | 'upload_doc' | 'create_requirement' | 'add_event') => void;
}

export function DashboardView({
  summary,
  loading,
  onNavigate,
  onQuickAction,
}: DashboardViewProps) {
  const { user, activeCompany } = useAuth();

  if (loading && !summary) {
    return (
      <div className="space-y-6">
        <div className="h-20 animate-pulse rounded-xl bg-white" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-white" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="h-72 animate-pulse rounded-xl bg-white lg:col-span-7" />
          <div className="h-72 animate-pulse rounded-xl bg-white lg:col-span-5" />
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const firstName = user?.fullName.split(' ')[0] || 'there';

  return (
    <div className="space-y-6">
      {/* Greeting & Quick Actions Row */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200/80 bg-white p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Good afternoon, {firstName}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Compliance overview for <span className="font-medium text-slate-900">{activeCompany?.name}</span>
            {' · '}
            {summary.expiringSoonLicenses + summary.expiredLicenses + summary.overdueRequirements > 0
              ? `${summary.expiringSoonLicenses + summary.expiredLicenses + summary.overdueRequirements} records require attention`
              : 'All tracked licenses and obligations are currently on track'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onQuickAction('add_license')}
            className="inline-flex items-center gap-2 rounded-lg bg-[#4F46E5] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4338CA] whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Add License</span>
          </button>
          <button
            type="button"
            onClick={() => onQuickAction('upload_doc')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
          >
            <Upload className="h-4 w-4 text-slate-500" />
            <span>Upload Document</span>
          </button>
          <button
            type="button"
            onClick={() => onQuickAction('create_requirement')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
          >
            <CheckSquare className="h-4 w-4 text-slate-500" />
            <span>Create Requirement</span>
          </button>
          <button
            type="button"
            onClick={() => onQuickAction('add_event')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
          >
            <CalendarDays className="h-4 w-4 text-slate-500" />
            <span>Add Event</span>
          </button>
        </div>
      </div>

      {/* 4 Core KPI Cards answering Questions 1–4 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => onNavigate('licenses', 'All')}
          className="group rounded-xl border border-slate-200/80 bg-white p-5 text-left transition-colors hover:border-[#4F46E5]/40"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Total Licenses</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-[#4F46E5]">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 font-display text-3xl font-bold text-slate-900 tabular-nums">
            {summary.totalLicenses}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {summary.totalDocuments} stored documents · View all
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('licenses', 'Active')}
          className="group rounded-xl border border-slate-200/80 bg-white p-5 text-left transition-colors hover:border-emerald-300"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Active Records</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 font-display text-3xl font-bold text-slate-900 tabular-nums">
            {summary.activeLicenses}
          </p>
          <p className="mt-1 text-xs text-emerald-700 font-medium">
            Current & outside warning window
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('licenses', 'Expiring Soon')}
          className="group rounded-xl border border-slate-200/80 bg-white p-5 text-left transition-colors hover:border-amber-300"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Expiring Soon</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 font-display text-3xl font-bold text-slate-900 tabular-nums">
            {summary.expiringSoonLicenses}
          </p>
          <p className="mt-1 text-xs text-amber-700 font-medium">
            Within {activeCompany?.notificationPreferences?.warningThresholdDays ?? 60}-day renewal window
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('licenses', 'Expired')}
          className="group rounded-xl border border-slate-200/80 bg-white p-5 text-left transition-colors hover:border-red-300"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Expired</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <AlertCircle className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 font-display text-3xl font-bold text-slate-900 tabular-nums">
            {summary.expiredLicenses}
          </p>
          <p className="mt-1 text-xs text-red-700 font-medium">
            Past expiration date · Needs renewal
          </p>
        </button>
      </div>

      {/* Main Content Split: Overall Status & Attention Needed Next + Calendar Events */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left 7 cols: Overall Record Status + Attention Needed Next */}
        <div className="space-y-6 lg:col-span-7">
          {/* Overall Record Status */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <RingGauge percentage={summary.readinessPercentage} label="On Track" size={116} />
              <div className="flex-1">
                <h3 className="font-display text-lg font-bold text-slate-900">
                  Overall Record Status
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Tracks active licenses alongside in-progress and completed compliance requirements.
                </p>
                <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Pending Tasks</p>
                    <p className="mt-0.5 font-display text-lg font-bold text-slate-900 tabular-nums">
                      {summary.pendingRequirements}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Overdue Tasks</p>
                    <p className="mt-0.5 font-display text-lg font-bold text-red-600 tabular-nums">
                      {summary.overdueRequirements}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Completed</p>
                    <p className="mt-0.5 font-display text-lg font-bold text-emerald-600 tabular-nums">
                      {summary.completedRequirements}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
              {BRAND_CONFIG.organizationalDisclaimer}
            </p>
          </div>

          {/* Question 5: What needs my attention next? */}
          <div className="rounded-xl border border-slate-200/80 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  Needs Attention Next
                </h3>
                <p className="text-xs text-slate-500">
                  Prioritized by upcoming expiration dates and overdue deadlines
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('compliance')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#4F46E5] hover:text-[#4338CA]"
              >
                <span>View Requirements</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {summary.upcomingDeadlines.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                <p className="mt-2 text-sm font-medium text-slate-900">
                  No urgent deadlines right now
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Add licenses or compliance requirements to start tracking upcoming renewals.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {summary.upcomingDeadlines.map((item) => (
                  <button
                    key={`${item.type}_${item.id}`}
                    type="button"
                    onClick={() =>
                      onNavigate(item.type === 'license' ? 'licenses' : 'compliance')
                    }
                    className="flex w-full items-center justify-between gap-4 px-6 py-3.5 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {item.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {item.type === 'license' ? 'License' : 'Requirement'} · {item.subtitle} ·{' '}
                        <span className="tabular-nums">{formatDisplayDate(item.date)}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusText status={item.status} />
                      <span
                        className={`text-[11px] font-medium tabular-nums ${
                          item.daysRemaining < 0
                            ? 'text-red-600'
                            : item.daysRemaining <= 14
                              ? 'text-amber-700'
                              : 'text-slate-500'
                        }`}
                      >
                        {getDaysRemainingLabel(item.daysRemaining)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 5 cols: Upcoming Calendar Events + Recent Activity */}
        <div className="space-y-6 lg:col-span-5">
          {/* Upcoming Calendar Events */}
          <div className="rounded-xl border border-slate-200/80 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  Upcoming Events
                </h3>
                <p className="text-xs text-slate-500">Scheduled activities & auto-synced deadlines</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('calendar')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#4F46E5] hover:text-[#4338CA]"
              >
                <span>Open Calendar</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {summary.upcomingEvents.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <CalendarDays className="mx-auto h-7 w-7 text-slate-300" />
                <p className="mt-2 text-sm font-medium text-slate-700">No upcoming events</p>
                <button
                  type="button"
                  onClick={() => onQuickAction('add_event')}
                  className="mt-3 text-xs font-semibold text-[#4F46E5] hover:underline"
                >
                  Schedule an activity
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {summary.upcomingEvents.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => onNavigate('calendar')}
                    className="flex w-full items-start justify-between gap-3 px-6 py-3.5 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{ev.title}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        <span className="tabular-nums">{formatDisplayDate(ev.date)}</span>
                        {' · '}
                        <span className="tabular-nums">{formatTime12h(ev.time, ev.isAllDay)}</span>
                        {ev.responsibleName ? ` · ${ev.responsibleName}` : ''}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                        ev.priority === 'Urgent'
                          ? 'bg-red-50 text-red-700'
                          : ev.priority === 'High'
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {ev.priority}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity Log */}
          <div className="rounded-xl border border-slate-200/80 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="font-display text-base font-bold text-slate-900">Recent Activity</h3>
              <Clock className="h-4 w-4 text-slate-400" />
            </div>

            {summary.recentActivity.length === 0 ? (
              <div className="px-6 py-8 text-center text-xs text-slate-500">
                Activity will appear here as you create or update records.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {summary.recentActivity.map((act) => (
                  <div key={act.id} className="flex items-start justify-between gap-3 px-6 py-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-900">
                        <span className="font-semibold">{act.actorName}</span>{' '}
                        <span className="text-slate-600">{act.action.toLowerCase()}</span>{' '}
                        <span className="font-semibold text-slate-900">{act.entityTitle}</span>
                      </p>
                      {act.details && (
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">{act.details}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-400 tabular-nums">
                      {formatRelativeTime(act.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
