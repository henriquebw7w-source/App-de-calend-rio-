import { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  Info,
  RefreshCw,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatDisplayDate, formatRelativeTime } from '../lib/format';
import type { NotificationRecord } from '../types/compliance';

interface NotificationsViewProps {
  companyId: string;
  notifications: NotificationRecord[];
  onDataChanged: () => Promise<void>;
  onNavigateToEntity: (entityType: NotificationRecord['entityType']) => void;
}

export function NotificationsView({
  companyId,
  notifications,
  onDataChanged,
  onNavigateToEntity,
}: NotificationsViewProps) {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [busy, setBusy] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const displayed =
    filter === 'unread' ? notifications.filter((n) => !n.isRead) : notifications;

  const handleToggleRead = async (n: NotificationRecord) => {
    await apiFetch(`/api/c/${companyId}/notifications/${n.id}/read`, {
      method: 'PATCH',
      body: JSON.stringify({ isRead: !n.isRead }),
    });
    await onDataChanged();
  };

  const handleMarkAllRead = async () => {
    setBusy(true);
    try {
      await apiFetch(`/api/c/${companyId}/notifications/mark-all-read`, {
        method: 'POST',
      });
      await onDataChanged();
    } finally {
      setBusy(false);
    }
  };

  const handleRunScan = async () => {
    setBusy(true);
    try {
      await apiFetch(`/api/c/${companyId}/notifications/check`, {
        method: 'POST',
      });
      await onDataChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Notifications & Reminders
          </h2>
          <p className="text-sm text-slate-500">
            Automated alerts at 60, 30, 7, and 0 days before expiration, plus overdue obligations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleRunScan}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
            <span>Check Deadlines Now</span>
          </button>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-[#4F46E5] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#4338CA] disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>Mark All Read</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs (matches screen 7: All (N) / Unread (N)) */}
      <div className="inline-flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
            filter === 'all'
              ? 'bg-[#4F46E5] text-white shadow-xs'
              : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('unread')}
          className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
            filter === 'unread'
              ? 'bg-[#4F46E5] text-white shadow-xs'
              : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {/* Notifications List */}
      {displayed.length === 0 ? (
        <div className="rounded-xl border border-slate-200/80 bg-white px-6 py-12 text-center">
          <Bell className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 font-display text-base font-semibold text-slate-900">
            {filter === 'unread' ? 'All caught up' : 'No reminders generated yet'}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {filter === 'unread'
              ? 'You have no unread compliance alerts.'
              : 'Reminders appear automatically when licenses or requirements enter your configured notice intervals.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/80 bg-white">
          {displayed.map((n) => {
            const Icon =
              n.severity === 'urgent'
                ? AlertCircle
                : n.severity === 'warning'
                  ? AlertTriangle
                  : Info;
            const iconWrap =
              n.severity === 'urgent'
                ? 'bg-red-50 text-red-600'
                : n.severity === 'warning'
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-sky-50 text-sky-600';

            return (
              <div
                key={n.id}
                className={`flex flex-col gap-3 px-5 py-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                  n.isRead ? 'bg-white' : 'bg-indigo-50/25'
                }`}
              >
                <div
                  onClick={() => onNavigateToEntity(n.entityType)}
                  className="flex min-w-0 cursor-pointer items-start gap-3.5"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconWrap}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={`font-display text-sm ${
                          n.isRead ? 'font-semibold text-slate-800' : 'font-bold text-slate-900'
                        }`}
                      >
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span className="rounded bg-[#4F46E5]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#4F46E5]">
                          Unread
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-600">{n.message}</p>
                    <p className="mt-1 text-[11px] text-slate-400 tabular-nums">
                      {formatRelativeTime(n.createdAt)}
                      {n.dueDate ? ` · Target Date: ${formatDisplayDate(n.dueDate)}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleRead(n)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      n.isRead
                        ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        : 'border-indigo-200 bg-white text-[#4F46E5] hover:bg-indigo-50'
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{n.isRead ? 'Mark Unread' : 'Mark Read'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
