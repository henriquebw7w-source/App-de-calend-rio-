import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  CheckSquare,
  Edit3,
  Plus,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatDisplayDate, getTodayYmdLocal } from '../lib/format';
import {
  REQUIREMENT_CATEGORIES,
  REQUIREMENT_STATUSES,
  type CompanyMember,
  type ComplianceRequirement,
  type DocumentRecord,
  type License,
  type RequirementCategory,
  type RequirementStatus,
} from '../types/compliance';
import { ConfirmModal } from './ui/ConfirmModal';
import { RingGauge } from './ui/RingGauge';
import { StatusText } from './ui/StatusText';

interface ComplianceViewProps {
  companyId: string;
  requirements: ComplianceRequirement[];
  licenses: License[];
  documents: DocumentRecord[];
  members: CompanyMember[];
  openCreateRequested?: boolean;
  onConsumeCreateRequest?: () => void;
  onDataChanged: () => Promise<void>;
}

export function ComplianceView({
  companyId,
  requirements,
  licenses,
  documents,
  members,
  openCreateRequested,
  onConsumeCreateRequest,
  onDataChanged,
}: ComplianceViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingReq, setEditingReq] = useState<ComplianceRequirement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ComplianceRequirement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<RequirementCategory>('License Renewal');
  const [responsibleMemberId, setResponsibleMemberId] = useState('');
  const [relatedLicenseId, setRelatedLicenseId] = useState('');
  const [relatedDocumentId, setRelatedDocumentId] = useState('');
  const [dueDate, setDueDate] = useState(getTodayYmdLocal());
  const [status, setStatus] = useState<RequirementStatus>('Not Started');
  const [notes, setNotes] = useState('');

  const openCreateModal = React.useCallback(() => {
    setEditingReq(null);
    setTitle('');
    setDescription('');
    setCategory('License Renewal');
    setResponsibleMemberId(members[0]?.id || '');
    setRelatedLicenseId('');
    setRelatedDocumentId('');
    setDueDate(getTodayYmdLocal());
    setStatus('Not Started');
    setNotes('');
    setError(null);
    setModalOpen(true);
  }, [members]);

  React.useEffect(() => {
    if (openCreateRequested) {
      openCreateModal();
      onConsumeCreateRequest?.();
    }
  }, [openCreateRequested, openCreateModal, onConsumeCreateRequest]);

  const openEditModal = (req: ComplianceRequirement) => {
    setEditingReq(req);
    setTitle(req.title);
    setDescription(req.description);
    setCategory(req.category);
    setResponsibleMemberId(req.responsibleMemberId || '');
    setRelatedLicenseId(req.relatedLicenseId || '');
    setRelatedDocumentId(req.relatedDocumentId || '');
    setDueDate(req.dueDate);
    setStatus(req.status);
    setNotes(req.notes);
    setError(null);
    setModalOpen(true);
  };

  const completedCount = requirements.filter((r) => r.status === 'Completed').length;
  const inProgressCount = requirements.filter((r) => r.status === 'In Progress').length;
  const notStartedCount = requirements.filter((r) => r.status === 'Not Started').length;
  const overdueCount = requirements.filter((r) => r.status === 'Overdue').length;
  const onTrackPct =
    requirements.length > 0
      ? Math.round(((completedCount + inProgressCount) / requirements.length) * 100)
      : 100;

  const filteredReqs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...requirements]
      .filter((r) => {
        if (statusFilter === 'Pending' && r.status === 'Completed') return false;
        if (
          statusFilter !== 'All' &&
          statusFilter !== 'Pending' &&
          r.status !== statusFilter
        ) {
          return false;
        }
        if (categoryFilter !== 'All' && r.category !== categoryFilter) return false;
        if (q) {
          const hay = `${r.title} ${r.description} ${r.responsibleName} ${r.category}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Pending/Overdue first sorted by due date; Completed at bottom
        if (a.status === 'Completed' && b.status !== 'Completed') return 1;
        if (a.status !== 'Completed' && b.status === 'Completed') return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [requirements, search, statusFilter, categoryFilter]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const payload = {
        title,
        description,
        category,
        responsibleMemberId: responsibleMemberId || null,
        relatedLicenseId: relatedLicenseId || null,
        relatedDocumentId: relatedDocumentId || null,
        dueDate,
        status,
        notes,
      };
      if (editingReq) {
        await apiFetch(`/api/c/${companyId}/requirements/${editingReq.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/api/c/${companyId}/requirements`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      await onDataChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save requirement.');
    } finally {
      setBusy(false);
    }
  };

  const handleQuickStatusChange = async (req: ComplianceRequirement, nextStatus: RequirementStatus) => {
    await apiFetch(`/api/c/${companyId}/requirements/${req.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: nextStatus }),
    });
    await onDataChanged();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await apiFetch(`/api/c/${companyId}/requirements/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      setDeleteTarget(null);
      await onDataChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Compliance Requirements
          </h2>
          <p className="text-sm text-slate-500">
            Manage tasks, renewals, safety audits, and team obligations with automatic calendar deadlines.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#4F46E5] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#4338CA] whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Create Requirement</span>
        </button>
      </div>

      {/* Progress Ring & Breakdown Card (mirrors screen 6 in reference) */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-6">
            <RingGauge percentage={onTrackPct} label="On Track" size={108} />
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                Requirements Overview
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {requirements.length} total tracked obligations · Due dates auto-sync to Calendar
              </p>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                  <span className="text-slate-600">Completed / Active:</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    {completedCount + inProgressCount}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  <span className="text-slate-600">Not Started:</span>
                  <span className="font-bold text-slate-900 tabular-nums">{notStartedCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
                  <span className="text-slate-600">Overdue:</span>
                  <span className="font-bold text-red-600 tabular-nums">{overdueCount}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search requirements or assignees..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50/60 py-2 pl-9 pr-3 text-sm focus:border-[#4F46E5] focus:bg-white focus:outline-none"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by requirement category"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#4F46E5] focus:outline-none"
          >
            <option value="All">All Categories</option>
            {REQUIREMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          {['All', 'Pending', ...REQUIREMENT_STATUSES].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                statusFilter === tab
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Requirements Timeline / List */}
      {filteredReqs.length === 0 ? (
        <div className="rounded-xl border border-slate-200/80 bg-white px-6 py-12 text-center">
          <CheckSquare className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 font-display text-base font-semibold text-slate-900">
            No requirements match your filters
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Create a compliance requirement to assign responsibility and track its deadline.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#4F46E5] px-4 py-2 text-sm font-medium text-white hover:bg-[#4338CA]"
          >
            <Plus className="h-4 w-4" />
            <span>Create Requirement</span>
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/80 bg-white">
          {filteredReqs.map((req) => {
            const linkedLic = licenses.find((l) => l.id === req.relatedLicenseId);
            const linkedDoc = documents.find((d) => d.id === req.relatedDocumentId);
            const isCompleted = req.status === 'Completed';

            return (
              <div
                key={req.id}
                className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3.5">
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickStatusChange(req, isCompleted ? 'In Progress' : 'Completed')
                    }
                    title={isCompleted ? 'Reopen requirement' : 'Mark completed'}
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors ${
                      isCompleted
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-300 bg-white text-transparent hover:border-[#4F46E5]'
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>

                  <div className="min-w-0">
                    <h4
                      className={`font-display text-sm font-bold sm:text-base ${
                        isCompleted ? 'text-slate-400 line-through' : 'text-slate-900'
                      }`}
                    >
                      {req.title}
                    </h4>
                    {req.description && (
                      <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">{req.description}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span>{req.category}</span>
                      <span>·</span>
                      <span className="tabular-nums font-medium text-slate-700">
                        Due {formatDisplayDate(req.dueDate)}
                      </span>
                      {req.responsibleName && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {req.responsibleName}
                          </span>
                        </>
                      )}
                      {linkedLic && (
                        <>
                          <span>·</span>
                          <span className="text-[#4F46E5]">License: {linkedLic.name}</span>
                        </>
                      )}
                      {linkedDoc && (
                        <>
                          <span>·</span>
                          <span className="text-slate-600">Doc: {linkedDoc.fileName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 sm:justify-end shrink-0">
                  <select
                    value={req.status}
                    onChange={(e) =>
                      handleQuickStatusChange(req, e.target.value as RequirementStatus)
                    }
                    aria-label={`Change status for ${req.title}`}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 focus:border-[#4F46E5] focus:outline-none"
                  >
                    {REQUIREMENT_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>

                  <StatusText status={req.status} />

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(req)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      title="Edit requirement"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(req)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Delete requirement"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Requirement Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="font-display text-lg font-bold text-slate-900">
                {editingReq ? 'Edit Compliance Requirement' : 'Create Compliance Requirement'}
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
                <label className="block text-xs font-medium text-slate-700">Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Renew HVAC Contractor License"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Steps required to complete this compliance task..."
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as RequirementCategory)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                  >
                    {REQUIREMENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Responsible Team Member
                  </label>
                  <select
                    value={responsibleMemberId}
                    onChange={(e) => setResponsibleMemberId(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm tabular-nums focus:border-[#4F46E5] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as RequirementStatus)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                  >
                    {REQUIREMENT_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Associated License
                  </label>
                  <select
                    value={relatedLicenseId}
                    onChange={(e) => setRelatedLicenseId(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
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
                  <label className="block text-xs font-medium text-slate-700">
                    Associated Document
                  </label>
                  <select
                    value={relatedDocumentId}
                    onChange={(e) => setRelatedDocumentId(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                  >
                    <option value="">None</option>
                    {documents.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.fileName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Progress updates or verification notes..."
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
                  {busy ? 'Saving...' : editingReq ? 'Save Changes' : 'Create Requirement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Requirement"
        description={`Are you sure you want to delete "${deleteTarget?.title}"? Its automatically synced deadline will also be removed from the Calendar.`}
        confirmLabel="Delete Requirement"
        isBusy={busy}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
