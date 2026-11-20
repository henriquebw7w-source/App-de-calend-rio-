import React, { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  ExternalLink,
  List,
  MapPin,
  Plus,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatDisplayDate, formatLongDate, formatTime12h, getTodayYmdLocal } from '../lib/format';
import {
  CALENDAR_EVENT_CATEGORIES,
  CALENDAR_PRIORITIES,
  type BusinessLocation,
  type CalendarEvent,
  type CalendarEventCategory,
  type CalendarEventPriority,
  type CompanyMember,
  type ComplianceRequirement,
  type DocumentRecord,
  type License,
} from '../types/compliance';
import { ConfirmModal } from './ui/ConfirmModal';

interface CalendarViewProps {
  companyId: string;
  events: CalendarEvent[];
  licenses: License[];
  documents: DocumentRecord[];
  requirements: ComplianceRequirement[];
  locations: BusinessLocation[];
  members: CompanyMember[];
  openCreateRequested?: boolean;
  onConsumeCreateRequest?: () => void;
  onDataChanged: () => Promise<void>;
  onJumpToModule: (tab: 'licenses' | 'documents' | 'compliance') => void;
}

type CalendarMode = 'month' | 'week' | 'day' | 'upcoming';

function getCategoryStyle(category: CalendarEventCategory, isCompleted: boolean) {
  if (isCompleted) {
    return {
      dot: 'bg-slate-400',
      chip: 'bg-slate-100 text-slate-500 line-through',
      label: 'text-slate-500',
    };
  }
  switch (category) {
    case 'License Expiration':
      return { dot: 'bg-red-500', chip: 'bg-red-50 text-red-700', label: 'text-red-700' };
    case 'License Renewal':
      return { dot: 'bg-[#4F46E5]', chip: 'bg-indigo-50 text-[#4F46E5]', label: 'text-[#4F46E5]' };
    case 'Insurance Review':
      return { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700', label: 'text-emerald-700' };
    case 'Business Permit':
      return { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-800', label: 'text-amber-800' };
    case 'Compliance Deadline':
      return { dot: 'bg-sky-500', chip: 'bg-sky-50 text-sky-700', label: 'text-sky-700' };
    case 'Inspection':
      return { dot: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700', label: 'text-violet-700' };
    default:
      return { dot: 'bg-slate-600', chip: 'bg-slate-100 text-slate-700', label: 'text-slate-700' };
  }
}

function getPriorityBadgeClass(priority: CalendarEventPriority) {
  if (priority === 'Urgent') return 'bg-red-50 text-red-700';
  if (priority === 'High') return 'bg-amber-50 text-amber-800';
  if (priority === 'Medium') return 'bg-indigo-50 text-[#4F46E5]';
  return 'bg-slate-100 text-slate-600';
}

function toYmd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function CalendarView({
  companyId,
  events,
  licenses,
  documents,
  requirements,
  locations,
  members,
  openCreateRequested,
  onConsumeCreateRequest,
  onDataChanged,
  onJumpToModule,
}: CalendarViewProps) {
  const todayYmd = getTodayYmdLocal();
  const [viewMode, setViewMode] = useState<CalendarMode>('month');
  const [selectedDate, setSelectedDate] = useState<string>(todayYmd);
  const [cursorDate, setCursorDate] = useState<Date>(() => parseYmd(todayYmd));

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [memberFilter, setMemberFilter] = useState<string>('All');
  const [locationFilter, setLocationFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Completed'>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');

  // Modals / Drawers
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CalendarEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Event Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayYmd);
  const [time, setTime] = useState('09:00');
  const [isAllDay, setIsAllDay] = useState(false);
  const [category, setCategory] = useState<CalendarEventCategory>('License Renewal');
  const [responsibleMemberId, setResponsibleMemberId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [relatedLicenseId, setRelatedLicenseId] = useState('');
  const [relatedDocumentId, setRelatedDocumentId] = useState('');
  const [relatedRequirementId, setRelatedRequirementId] = useState('');
  const [priority, setPriority] = useState<CalendarEventPriority>('Medium');

  const openCreateModal = React.useCallback(
    (prefillDate?: string) => {
      setEditingEvent(null);
      setTitle('');
      setDescription('');
      setDate(prefillDate || selectedDate || todayYmd);
      setTime('09:00');
      setIsAllDay(false);
      setCategory('License Renewal');
      setResponsibleMemberId(members[0]?.id || '');
      setLocationId(locations.find((l) => l.isPrimary)?.id || '');
      setRelatedLicenseId('');
      setRelatedDocumentId('');
      setRelatedRequirementId('');
      setPriority('Medium');
      setError(null);
      setModalOpen(true);
    },
    [selectedDate, todayYmd, members, locations]
  );

  React.useEffect(() => {
    if (openCreateRequested) {
      openCreateModal(selectedDate);
      onConsumeCreateRequest?.();
    }
  }, [openCreateRequested, openCreateModal, selectedDate, onConsumeCreateRequest]);

  const openEditModal = (ev: CalendarEvent) => {
    setEditingEvent(ev);
    setTitle(ev.title);
    setDescription(ev.description);
    setDate(ev.date);
    setTime(ev.time || '09:00');
    setIsAllDay(ev.isAllDay);
    setCategory(ev.category);
    setResponsibleMemberId(ev.responsibleMemberId || '');
    setLocationId(ev.locationId || '');
    setRelatedLicenseId(ev.relatedLicenseId || '');
    setRelatedDocumentId(ev.relatedDocumentId || '');
    setRelatedRequirementId(ev.relatedRequirementId || '');
    setPriority(ev.priority);
    setError(null);
    setModalOpen(true);
  };

  const filteredEvents = useMemo(() => {
    return events
      .filter((ev) => {
        if (categoryFilter !== 'All' && ev.category !== categoryFilter) return false;
        if (memberFilter !== 'All' && (ev.responsibleMemberId || 'unassigned') !== memberFilter) {
          return false;
        }
        if (locationFilter !== 'All' && (ev.locationId || 'unassigned') !== locationFilter) {
          return false;
        }
        if (statusFilter === 'Pending' && ev.isCompleted) return false;
        if (statusFilter === 'Completed' && !ev.isCompleted) return false;
        if (priorityFilter !== 'All' && ev.priority !== priorityFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        if (a.isAllDay && !b.isAllDay) return -1;
        if (!a.isAllDay && b.isAllDay) return 1;
        return (a.time || '23:59').localeCompare(b.time || '23:59');
      });
  }, [events, categoryFilter, memberFilter, locationFilter, statusFilter, priorityFilter]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of filteredEvents) {
      const list = map.get(ev.date) || [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [filteredEvents]);

  const selectedDayEvents = eventsByDate.get(selectedDate) || [];
  const selectedEvent = events.find((e) => e.id === selectedEventId) || null;

  // Month Grid calculation (Sunday start)
  const monthDays = useMemo(() => {
    const year = cursorDate.getFullYear();
    const month = cursorDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay(); // 0=Sun
    const startDate = new Date(year, month, 1 - startOffset);

    const cells: Array<{ date: Date; ymd: string; inMonth: boolean }> = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
      cells.push({
        date: d,
        ymd: toYmd(d),
        inMonth: d.getMonth() === month,
      });
    }
    return cells;
  }, [cursorDate]);

  // Week Days calculation (Sunday-Saturday containing selectedDate)
  const weekDays = useMemo(() => {
    const base = parseYmd(selectedDate);
    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - base.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return { date: d, ymd: toYmd(d) };
    });
  }, [selectedDate]);

  const navigatePeriod = (dir: -1 | 1) => {
    if (viewMode === 'month') {
      const next = new Date(cursorDate.getFullYear(), cursorDate.getMonth() + dir, 1);
      setCursorDate(next);
    } else if (viewMode === 'week') {
      const base = parseYmd(selectedDate);
      const next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dir * 7);
      setSelectedDate(toYmd(next));
      setCursorDate(next);
    } else if (viewMode === 'day') {
      const base = parseYmd(selectedDate);
      const next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dir);
      setSelectedDate(toYmd(next));
      setCursorDate(next);
    }
  };

  const jumpToToday = () => {
    setSelectedDate(todayYmd);
    setCursorDate(parseYmd(todayYmd));
  };

  const handleToggleCompleted = async (ev: CalendarEvent) => {
    await apiFetch(`/api/c/${companyId}/calendar/${ev.id}`, {
      method: 'PUT',
      body: JSON.stringify({ isCompleted: !ev.isCompleted }),
    });
    await onDataChanged();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const payload = {
        title,
        description,
        date,
        time: isAllDay ? null : time,
        isAllDay,
        category,
        responsibleMemberId: responsibleMemberId || null,
        locationId: locationId || null,
        relatedLicenseId: relatedLicenseId || null,
        relatedDocumentId: relatedDocumentId || null,
        relatedRequirementId: relatedRequirementId || null,
        priority,
      };
      if (editingEvent) {
        await apiFetch(`/api/c/${companyId}/calendar/${editingEvent.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/api/c/${companyId}/calendar`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setSelectedDate(date);
      setCursorDate(parseYmd(date));
      setModalOpen(false);
      await onDataChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save calendar event.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await apiFetch(`/api/c/${companyId}/calendar/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (selectedEventId === deleteTarget.id) setSelectedEventId(null);
      setDeleteTarget(null);
      await onDataChanged();
    } finally {
      setBusy(false);
    }
  };

  const monthHeaderLabel = cursorDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const upcomingEventsList = useMemo(
    () => filteredEvents.filter((ev) => ev.date >= todayYmd),
    [filteredEvents, todayYmd]
  );

  return (
    <div className="space-y-5">
      {/* Top Toolbar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Compliance & Operations Calendar
          </h2>
          <p className="text-sm text-slate-500">
            Daily, weekly, and monthly schedule combining team tasks with auto-synced license expirations and requirement deadlines.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
            {(
              [
                { id: 'month', label: 'Month' },
                { id: 'week', label: 'Week' },
                { id: 'day', label: 'Day' },
                { id: 'upcoming', label: 'Upcoming' },
              ] as Array<{ id: CalendarMode; label: string }>
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setViewMode(m.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  viewMode === m.id
                    ? 'bg-[#4F46E5] text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => openCreateModal(selectedDate)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#4F46E5] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4338CA] whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Create Event</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white p-3.5">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter by event category"
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-[#4F46E5] focus:outline-none"
        >
          <option value="All">All Categories</option>
          {CALENDAR_EVENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={memberFilter}
          onChange={(e) => setMemberFilter(e.target.value)}
          aria-label="Filter by responsible person"
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-[#4F46E5] focus:outline-none"
        >
          <option value="All">All Team Members</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.fullName}
            </option>
          ))}
        </select>

        <select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          aria-label="Filter by business location"
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-[#4F46E5] focus:outline-none"
        >
          <option value="All">All Locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'All' | 'Pending' | 'Completed')}
          aria-label="Filter by completion status"
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-[#4F46E5] focus:outline-none"
        >
          <option value="All">All Statuses</option>
          <option value="Pending">Pending Only</option>
          <option value="Completed">Completed Only</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          aria-label="Filter by priority"
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-[#4F46E5] focus:outline-none"
        >
          <option value="All">All Priorities</option>
          {CALENDAR_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={jumpToToday}
          className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Today
        </button>
      </div>

      {/* Main Calendar Area */}
      {viewMode === 'upcoming' ? (
        <div className="rounded-xl border border-slate-200/80 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div className="flex items-center gap-2">
              <List className="h-4 w-4 text-[#4F46E5]" />
              <h3 className="font-display text-base font-bold text-slate-900">
                Upcoming Events & Deadlines ({upcomingEventsList.length})
              </h3>
            </div>
          </div>
          {upcomingEventsList.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              No upcoming events match your current filters.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {upcomingEventsList.map((ev) => {
                const style = getCategoryStyle(ev.category, ev.isCompleted);
                return (
                  <div
                    key={ev.id}
                    onClick={() => setSelectedEventId(ev.id)}
                    className="flex cursor-pointer flex-col gap-3 px-6 py-4 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} />
                      <div className="min-w-0">
                        <p
                          className={`font-display text-sm font-bold ${
                            ev.isCompleted ? 'text-slate-400 line-through' : 'text-slate-900'
                          }`}
                        >
                          {ev.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          <span className="tabular-nums font-medium text-slate-700">
                            {formatDisplayDate(ev.date)}
                          </span>
                          {' · '}
                          <span className="tabular-nums">
                            {formatTime12h(ev.time, ev.isAllDay)}
                          </span>
                          {' · '}
                          <span>{ev.category}</span>
                          {ev.responsibleName ? ` · ${ev.responsibleName}` : ''}
                          {ev.sourceType !== 'manual' ? ' · Auto-synced' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${getPriorityBadgeClass(
                          ev.priority
                        )}`}
                      >
                        {ev.priority}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleCompleted(ev);
                        }}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                          ev.isCompleted
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {ev.isCompleted ? 'Completed' : 'Mark Done'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Calendar Grid / Week / Day Surface (8 cols) */}
          <div className="rounded-xl border border-slate-200/80 bg-white lg:col-span-8">
            {/* Period Navigator */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() => navigatePeriod(-1)}
                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                aria-label="Previous period"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h3 className="font-display text-base font-bold text-slate-900 sm:text-lg">
                {viewMode === 'month'
                  ? monthHeaderLabel
                  : viewMode === 'week'
                    ? `Week of ${formatDisplayDate(weekDays[0].ymd)}`
                    : formatLongDate(selectedDate)}
              </h3>
              <button
                type="button"
                onClick={() => navigatePeriod(1)}
                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                aria-label="Next period"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {viewMode === 'month' && (
              <div className="p-3 sm:p-4">
                <div className="grid grid-cols-7 pb-2 text-center text-xs font-semibold text-slate-500">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className="py-1">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {monthDays.map((cell) => {
                    const dayEvents = eventsByDate.get(cell.ymd) || [];
                    const isSelected = cell.ymd === selectedDate;
                    const isToday = cell.ymd === todayYmd;

                    return (
                      <button
                        key={cell.ymd}
                        type="button"
                        onClick={() => {
                          setSelectedDate(cell.ymd);
                          if (!cell.inMonth) {
                            setCursorDate(cell.date);
                          }
                        }}
                        className={`flex min-h-[76px] flex-col items-stretch rounded-xl border p-1.5 text-left transition-colors sm:min-h-[92px] sm:p-2 ${
                          isSelected
                            ? 'border-[#4F46E5] bg-indigo-50/50'
                            : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50/70'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                              isSelected
                                ? 'bg-[#4F46E5] text-white'
                                : isToday
                                  ? 'bg-slate-900 text-white'
                                  : cell.inMonth
                                    ? 'text-slate-900'
                                    : 'text-slate-300'
                            }`}
                          >
                            {cell.date.getDate()}
                          </span>
                          {dayEvents.length > 0 && (
                            <span className="text-[10px] font-semibold text-slate-400 tabular-nums sm:hidden">
                              {dayEvents.length}
                            </span>
                          )}
                        </div>

                        {/* Mobile colored dots */}
                        {dayEvents.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1 sm:hidden">
                            {dayEvents.slice(0, 4).map((ev) => (
                              <span
                                key={ev.id}
                                className={`h-1.5 w-1.5 rounded-full ${
                                  getCategoryStyle(ev.category, ev.isCompleted).dot
                                }`}
                              />
                            ))}
                          </div>
                        )}

                        {/* Desktop compact event labels */}
                        <div className="mt-1.5 hidden space-y-1 sm:block">
                          {dayEvents.slice(0, 2).map((ev) => {
                            const style = getCategoryStyle(ev.category, ev.isCompleted);
                            return (
                              <div
                                key={ev.id}
                                className={`truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${style.chip}`}
                                title={ev.title}
                              >
                                {ev.title}
                              </div>
                            );
                          })}
                          {dayEvents.length > 2 && (
                            <div className="px-1 text-[10px] font-semibold text-slate-500">
                              +{dayEvents.length - 2} more
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {viewMode === 'week' && (
              <div className="divide-y divide-slate-100">
                {weekDays.map(({ date: dObj, ymd }) => {
                  const list = eventsByDate.get(ymd) || [];
                  const isSelected = ymd === selectedDate;
                  return (
                    <div
                      key={ymd}
                      onClick={() => setSelectedDate(ymd)}
                      className={`cursor-pointer p-4 transition-colors ${
                        isSelected ? 'bg-indigo-50/40' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                              isSelected
                                ? 'bg-[#4F46E5] text-white'
                                : ymd === todayYmd
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {dObj.getDate()}
                          </span>
                          <span className="font-display text-sm font-bold text-slate-900">
                            {formatLongDate(ymd)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCreateModal(ymd);
                          }}
                          className="text-xs font-semibold text-[#4F46E5] hover:underline"
                        >
                          + Add
                        </button>
                      </div>

                      {list.length === 0 ? (
                        <p className="mt-2 pl-9 text-xs text-slate-400">No scheduled activities</p>
                      ) : (
                        <div className="mt-2.5 space-y-1.5 pl-9">
                          {list.map((ev) => {
                            const style = getCategoryStyle(ev.category, ev.isCompleted);
                            return (
                              <div
                                key={ev.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedEventId(ev.id);
                                }}
                                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 hover:border-[#4F46E5]/50"
                              >
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                                  <span className="font-mono text-xs text-slate-500 tabular-nums shrink-0">
                                    {formatTime12h(ev.time, ev.isAllDay)}
                                  </span>
                                  <span
                                    className={`truncate text-sm font-medium ${
                                      ev.isCompleted ? 'text-slate-400 line-through' : 'text-slate-900'
                                    }`}
                                  >
                                    {ev.title}
                                  </span>
                                </div>
                                <span
                                  className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-medium ${getPriorityBadgeClass(
                                    ev.priority
                                  )}`}
                                >
                                  {ev.priority}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {viewMode === 'day' && (
              <div className="p-5">
                {selectedDayEvents.length === 0 ? (
                  <div className="py-14 text-center">
                    <CalendarIcon className="mx-auto h-10 w-10 text-slate-300" />
                    <p className="mt-3 font-display text-base font-semibold text-slate-900">
                      Nothing scheduled for {formatDisplayDate(selectedDate)}
                    </p>
                    <button
                      type="button"
                      onClick={() => openCreateModal(selectedDate)}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#4F46E5] px-4 py-2 text-sm font-medium text-white hover:bg-[#4338CA]"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Schedule Event on This Day</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedDayEvents.map((ev) => {
                      const style = getCategoryStyle(ev.category, ev.isCompleted);
                      return (
                        <div
                          key={ev.id}
                          onClick={() => setSelectedEventId(ev.id)}
                          className="flex cursor-pointer flex-col gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:border-[#4F46E5]/50 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleCompleted(ev);
                              }}
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                                ev.isCompleted
                                  ? 'border-emerald-600 bg-emerald-600 text-white'
                                  : 'border-slate-300 text-transparent hover:border-[#4F46E5]'
                              }`}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </button>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                                <span className="font-mono text-xs font-medium text-slate-600 tabular-nums">
                                  {formatTime12h(ev.time, ev.isAllDay)}
                                </span>
                                <span className="text-xs text-slate-400">·</span>
                                <span className="text-xs font-medium text-slate-600">
                                  {ev.category}
                                </span>
                              </div>
                              <h4
                                className={`mt-1 font-display text-base font-bold ${
                                  ev.isCompleted ? 'text-slate-400 line-through' : 'text-slate-900'
                                }`}
                              >
                                {ev.title}
                              </h4>
                              {ev.description && (
                                <p className="mt-0.5 text-xs text-slate-600">{ev.description}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {ev.responsibleName && (
                              <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                                <User className="h-3.5 w-3.5 text-slate-400" />
                                {ev.responsibleName}
                              </span>
                            )}
                            <span
                              className={`rounded-md px-2 py-0.5 text-xs font-medium ${getPriorityBadgeClass(
                                ev.priority
                              )}`}
                            >
                              {ev.priority}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Day Agenda Panel (4 cols) — mirrors bottom card of screen 4 */}
          <div className="rounded-xl border border-slate-200/80 bg-white lg:col-span-4 flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  {formatLongDate(selectedDate)}
                </h3>
                <p className="text-xs text-slate-500 tabular-nums">
                  {selectedDayEvents.length} scheduled item{selectedDayEvents.length === 1 ? '' : 's'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openCreateModal(selectedDate)}
                className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-[#4F46E5] hover:bg-indigo-100"
              >
                + Add
              </button>
            </div>

            <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
              {selectedDayEvents.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <Clock className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm font-medium text-slate-700">No events on this date</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Click "+ Add" to schedule a renewal, review, or inspection.
                  </p>
                </div>
              ) : (
                selectedDayEvents.map((ev) => {
                  const style = getCategoryStyle(ev.category, ev.isCompleted);
                  return (
                    <div
                      key={ev.id}
                      onClick={() => setSelectedEventId(ev.id)}
                      className="cursor-pointer px-5 py-4 transition-colors hover:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} />
                          <span className="font-mono text-xs font-semibold text-slate-600 tabular-nums">
                            {formatTime12h(ev.time, ev.isAllDay)}
                          </span>
                        </div>
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] font-medium ${getPriorityBadgeClass(
                            ev.priority
                          )}`}
                        >
                          {ev.priority}
                        </span>
                      </div>

                      <p
                        className={`mt-1.5 font-display text-sm font-bold ${
                          ev.isCompleted ? 'text-slate-400 line-through' : 'text-slate-900'
                        }`}
                      >
                        {ev.title}
                      </p>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                        <span>{ev.category}</span>
                        {ev.responsibleName && (
                          <>
                            <span>·</span>
                            <span>{ev.responsibleName}</span>
                          </>
                        )}
                        {ev.sourceType !== 'manual' && (
                          <>
                            <span>·</span>
                            <span className="font-medium text-[#4F46E5]">Auto-synced</span>
                          </>
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <span
                          className={`text-[11px] font-semibold ${
                            ev.isCompleted ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {ev.isCompleted ? 'Completed' : 'Pending'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleCompleted(ev);
                          }}
                          className="text-xs font-semibold text-[#4F46E5] hover:underline"
                        >
                          {ev.isCompleted ? 'Reopen' : 'Mark Completed'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Event Detail Drawer */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-slate-950/35"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div className="min-w-0 pr-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-medium ${getPriorityBadgeClass(
                      selectedEvent.priority
                    )}`}
                  >
                    {selectedEvent.priority} Priority
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {selectedEvent.sourceType === 'manual'
                      ? 'Manual Event'
                      : selectedEvent.sourceType === 'auto_license_expiration'
                        ? 'Auto: License Expiration'
                        : 'Auto: Requirement Deadline'}
                  </span>
                </div>
                <h3 className="mt-2 font-display text-lg font-bold text-slate-900">
                  {selectedEvent.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEventId(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-6 text-sm">
              <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div>
                  <p className="text-xs text-slate-500">Date</p>
                  <p className="mt-0.5 font-semibold text-slate-900 tabular-nums">
                    {formatDisplayDate(selectedEvent.date)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Time</p>
                  <p className="mt-0.5 font-semibold text-slate-900 tabular-nums">
                    {formatTime12h(selectedEvent.time, selectedEvent.isAllDay)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Category</p>
                  <p className="mt-0.5 font-medium text-slate-900">{selectedEvent.category}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Status</p>
                  <p
                    className={`mt-0.5 font-semibold ${
                      selectedEvent.isCompleted ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {selectedEvent.isCompleted ? 'Completed' : 'Pending'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Responsible</p>
                  <p className="mt-0.5 font-medium text-slate-900">
                    {selectedEvent.responsibleName || 'Unassigned'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Business Location</p>
                  <p className="mt-0.5 flex items-center gap-1 font-medium text-slate-900">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {locations.find((l) => l.id === selectedEvent.locationId)?.name ||
                        'Company-Wide'}
                    </span>
                  </p>
                </div>
              </div>

              {selectedEvent.description && (
                <div>
                  <p className="text-xs font-semibold text-slate-500">Description</p>
                  <p className="mt-1.5 rounded-lg border border-slate-200 p-3.5 text-sm text-slate-700">
                    {selectedEvent.description}
                  </p>
                </div>
              )}

              {/* Linked Records */}
              {(selectedEvent.relatedLicenseId ||
                selectedEvent.relatedDocumentId ||
                selectedEvent.relatedRequirementId) && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500">Connected Records</p>
                  {selectedEvent.relatedLicenseId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEventId(null);
                        onJumpToModule('licenses');
                      }}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5 text-left hover:bg-slate-50"
                    >
                      <div>
                        <p className="text-[11px] text-slate-500">License</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {licenses.find((l) => l.id === selectedEvent.relatedLicenseId)?.name ||
                            'View License'}
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-slate-400" />
                    </button>
                  )}
                  {selectedEvent.relatedDocumentId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEventId(null);
                        onJumpToModule('documents');
                      }}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5 text-left hover:bg-slate-50"
                    >
                      <div>
                        <p className="text-[11px] text-slate-500">Document</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {documents.find((d) => d.id === selectedEvent.relatedDocumentId)
                            ?.fileName || 'View Document'}
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-slate-400" />
                    </button>
                  )}
                  {selectedEvent.relatedRequirementId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEventId(null);
                        onJumpToModule('compliance');
                      }}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5 text-left hover:bg-slate-50"
                    >
                      <div>
                        <p className="text-[11px] text-slate-500">Compliance Requirement</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {requirements.find((r) => r.id === selectedEvent.relatedRequirementId)
                            ?.title || 'View Requirement'}
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-slate-400" />
                    </button>
                  )}
                </div>
              )}

              {selectedEvent.sourceType !== 'manual' && (
                <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 p-3 text-xs text-indigo-900">
                  This deadline is automatically synchronized with its source record. Updating the
                  source license or requirement date will update this entry automatically.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-6 py-4">
              {selectedEvent.sourceType === 'manual' ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(selectedEvent)}
                    className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                    title="Delete event"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditModal(selectedEvent)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </button>
                </div>
              ) : (
                <span className="text-xs text-slate-400">Auto-synced deadline</span>
              )}

              <button
                type="button"
                onClick={() => handleToggleCompleted(selectedEvent)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white ${
                  selectedEvent.isCompleted
                    ? 'bg-slate-700 hover:bg-slate-800'
                    : 'bg-[#4F46E5] hover:bg-[#4338CA]'
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{selectedEvent.isCompleted ? 'Reopen Event' : 'Mark Completed'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Event Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="font-display text-lg font-bold text-slate-900">
                {editingEvent ? 'Edit Calendar Event' : 'Create Calendar Event'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700">Event Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Renew HVAC Contractor License"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Date *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums focus:border-[#4F46E5] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Time</label>
                  <input
                    type="time"
                    disabled={isAllDay}
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums disabled:bg-slate-100 disabled:text-slate-400 focus:border-[#4F46E5] focus:outline-none"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={isAllDay}
                      onChange={(e) => setIsAllDay(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[#4F46E5] focus:ring-[#4F46E5]"
                    />
                    <span>All-day event</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as CalendarEventCategory)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                  >
                    {CALENDAR_EVENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as CalendarEventPriority)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                  >
                    {CALENDAR_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Responsible Person
                  </label>
                  <select
                    value={responsibleMemberId}
                    onChange={(e) => setResponsibleMemberId(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Business Location
                  </label>
                  <select
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                  >
                    <option value="">Company-Wide</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Link License</label>
                  <select
                    value={relatedLicenseId}
                    onChange={(e) => setRelatedLicenseId(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs focus:border-[#4F46E5] focus:outline-none"
                  >
                    <option value="">None</option>
                    {licenses.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Link Document</label>
                  <select
                    value={relatedDocumentId}
                    onChange={(e) => setRelatedDocumentId(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs focus:border-[#4F46E5] focus:outline-none"
                  >
                    <option value="">None</option>
                    {documents.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.fileName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Link Requirement
                  </label>
                  <select
                    value={relatedRequirementId}
                    onChange={(e) => setRelatedRequirementId(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs focus:border-[#4F46E5] focus:outline-none"
                  >
                    <option value="">None</option>
                    {requirements.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Details, agenda items, or checklist..."
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-[#4F46E5] px-5 py-2 text-sm font-medium text-white hover:bg-[#4338CA] disabled:opacity-50"
                >
                  {busy ? 'Saving...' : editingEvent ? 'Update Event' : 'Save Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Calendar Event"
        description={`Are you sure you want to delete "${deleteTarget?.title}" on ${
          deleteTarget ? formatDisplayDate(deleteTarget.date) : ''
        }?`}
        confirmLabel="Delete Event"
        isBusy={busy}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
