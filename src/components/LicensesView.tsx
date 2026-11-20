import React, { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Building2,
  Calendar,
  Download,
  Edit3,
  Eye,
  FileCheck2,
  FileText,
  Flame,
  MapPin,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  Snowflake,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { apiFetch, fileToBase64, getDocumentFileUrl } from '../lib/api';
import { formatDisplayDate, formatFileSize, getDaysRemainingLabel, getTodayYmdLocal } from '../lib/format';
import {
  LICENSE_CATEGORIES,
  type BusinessLocation,
  type ComplianceRequirement,
  type DocumentRecord,
  type License,
  type LicenseCategory,
  type LicenseStatus,
} from '../types/compliance';
import { ConfirmModal } from './ui/ConfirmModal';
import { StatusText } from './ui/StatusText';

interface LicensesViewProps {
  companyId: string;
  licenses: License[];
  documents: DocumentRecord[];
  requirements: ComplianceRequirement[];
  locations: BusinessLocation[];
  initialStatusFilter?: string;
  openCreateRequested?: boolean;
  onConsumeCreateRequest?: () => void;
  onDataChanged: () => Promise<void>;
  onPreviewDocument: (doc: DocumentRecord) => void;
}

function CategoryIcon({ category }: { category: LicenseCategory }) {
  if (category === 'HVAC Contractor License' || category === 'EPA / Refrigerant Certification') {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
        <Snowflake className="h-5 w-5" />
      </div>
    );
  }
  if (category === 'Business Permit' || category === 'Trade / Mechanical Permit') {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
        <Building2 className="h-5 w-5" />
      </div>
    );
  }
  if (category === 'Safety Certificate') {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
        <Shield className="h-5 w-5" />
      </div>
    );
  }
  if (category === 'Insurance Policy') {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-[#4F46E5]">
        <FileCheck2 className="h-5 w-5" />
      </div>
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
      <Flame className="h-5 w-5" />
    </div>
  );
}

export function LicensesView({
  companyId,
  licenses,
  documents,
  requirements,
  locations,
  initialStatusFilter = 'All',
  openCreateRequested,
  onConsumeCreateRequest,
  onDataChanged,
  onPreviewDocument,
}: LicensesViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter);
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [locationFilter, setLocationFilter] = useState<string>('All');
  const [expWindowFilter, setExpWindowFilter] = useState<string>('All');
  const [sortAsc, setSortAsc] = useState(true);

  const [selectedLicenseId, setSelectedLicenseId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<License | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<License | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [category, setCategory] = useState<LicenseCategory>('HVAC Contractor License');
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [stateOrJurisdiction, setStateOrJurisdiction] = useState('');
  const [locationId, setLocationId] = useState('');
  const [issueDate, setIssueDate] = useState(getTodayYmdLocal());
  const [expirationDate, setExpirationDate] = useState('');
  const [notes, setNotes] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Sync external initial status filter if changed
  React.useEffect(() => {
    if (initialStatusFilter) {
      setStatusFilter(initialStatusFilter);
    }
  }, [initialStatusFilter]);

  const openCreateModal = React.useCallback(() => {
    setEditingLicense(null);
    setName('');
    setLicenseNumber('');
    setCategory('HVAC Contractor License');
    setIssuingAuthority('');
    setStateOrJurisdiction('');
    setLocationId(locations.find((l) => l.isPrimary)?.id || locations[0]?.id || '');
    setIssueDate(getTodayYmdLocal());
    setExpirationDate('');
    setNotes('');
    setAttachedFile(null);
    setFormError(null);
    setModalOpen(true);
  }, [locations]);

  React.useEffect(() => {
    if (openCreateRequested) {
      openCreateModal();
      onConsumeCreateRequest?.();
    }
  }, [openCreateRequested, openCreateModal, onConsumeCreateRequest]);

  const openEditModal = (lic: License) => {
    setEditingLicense(lic);
    setName(lic.name);
    setLicenseNumber(lic.licenseNumber);
    setCategory(lic.category);
    setIssuingAuthority(lic.issuingAuthority);
    setStateOrJurisdiction(lic.stateOrJurisdiction);
    setLocationId(lic.locationId || '');
    setIssueDate(lic.issueDate);
    setExpirationDate(lic.expirationDate);
    setNotes(lic.notes);
    setAttachedFile(null);
    setFormError(null);
    setModalOpen(true);
  };

  const filteredLicenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return licenses
      .filter((lic) => {
        if (statusFilter !== 'All' && lic.status !== statusFilter) return false;
        if (categoryFilter !== 'All' && lic.category !== categoryFilter) return false;
        if (locationFilter !== 'All' && (lic.locationId || 'unassigned') !== locationFilter) return false;
        if (expWindowFilter === '30' && (lic.daysRemaining < 0 || lic.daysRemaining > 30)) return false;
        if (expWindowFilter === '60' && (lic.daysRemaining < 0 || lic.daysRemaining > 60)) return false;
        if (expWindowFilter === '90' && (lic.daysRemaining < 0 || lic.daysRemaining > 90)) return false;
        if (expWindowFilter === 'expired' && lic.daysRemaining >= 0) return false;
        if (q) {
          const hay = `${lic.name} ${lic.licenseNumber} ${lic.issuingAuthority} ${lic.stateOrJurisdiction}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) =>
        sortAsc
          ? a.expirationDate.localeCompare(b.expirationDate)
          : b.expirationDate.localeCompare(a.expirationDate)
      );
  }, [licenses, search, statusFilter, categoryFilter, locationFilter, expWindowFilter, sortAsc]);

  const selectedLicense = licenses.find((l) => l.id === selectedLicenseId) || null;
  const linkedDocs = selectedLicense
    ? documents.filter((d) => d.relatedLicenseId === selectedLicense.id)
    : [];
  const linkedReqs = selectedLicense
    ? requirements.filter((r) => r.relatedLicenseId === selectedLicense.id)
    : [];

  const getLocationName = (id: string | null) =>
    locations.find((l) => l.id === id)?.name || 'All Locations';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setBusy(true);
    try {
      let attachmentPayload:
        | { fileName: string; mimeType: string; base64Data: string }
        | undefined;
      if (attachedFile) {
        const base64Data = await fileToBase64(attachedFile);
        attachmentPayload = {
          fileName: attachedFile.name,
          mimeType: attachedFile.type || 'application/octet-stream',
          base64Data,
        };
      }

      if (editingLicense) {
        await apiFetch(`/api/c/${companyId}/licenses/${editingLicense.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name,
            licenseNumber,
            category,
            issuingAuthority,
            stateOrJurisdiction,
            locationId: locationId || null,
            issueDate,
            expirationDate,
            notes,
          }),
        });
      } else {
        await apiFetch(`/api/c/${companyId}/licenses`, {
          method: 'POST',
          body: JSON.stringify({
            name,
            licenseNumber,
            category,
            issuingAuthority,
            stateOrJurisdiction,
            locationId: locationId || null,
            issueDate,
            expirationDate,
            notes,
            attachment: attachmentPayload,
          }),
        });
      }
      setModalOpen(false);
      await onDataChanged();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save license.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await apiFetch(`/api/c/${companyId}/licenses/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (selectedLicenseId === deleteTarget.id) setSelectedLicenseId(null);
      setDeleteTarget(null);
      await onDataChanged();
    } finally {
      setBusy(false);
    }
  };

  const statusTabs: Array<{ value: string; label: string; count: number }> = [
    { value: 'All', label: 'All', count: licenses.length },
    { value: 'Active', label: 'Active', count: licenses.filter((l) => l.status === 'Active').length },
    {
      value: 'Expiring Soon',
      label: 'Expiring Soon',
      count: licenses.filter((l) => l.status === 'Expiring Soon').length,
    },
    { value: 'Expired', label: 'Expired', count: licenses.filter((l) => l.status === 'Expired').length },
  ];

  return (
    <div className="space-y-5">
      {/* Header & Primary Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Licenses & Certifications
          </h2>
          <p className="text-sm text-slate-500">
            Track contractor licenses, business permits, safety certificates, and insurance policies.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#4F46E5] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#4338CA] whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Add License</span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search licenses by name, #ID, or authority..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50/60 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#4F46E5] focus:bg-white focus:outline-none"
            />
          </div>

          {/* Segmented Status Filter */}
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
            {statusTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === tab.value
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Filters Row */}
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by category"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-[#4F46E5] focus:outline-none"
          >
            <option value="All">All Categories</option>
            {LICENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            aria-label="Filter by location"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-[#4F46E5] focus:outline-none"
          >
            <option value="All">All Business Locations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>

          <select
            value={expWindowFilter}
            onChange={(e) => setExpWindowFilter(e.target.value)}
            aria-label="Filter by expiration date"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-[#4F46E5] focus:outline-none"
          >
            <option value="All">Any Expiration Date</option>
            <option value="30">Expires in 30 Days</option>
            <option value="60">Expires in 60 Days</option>
            <option value="90">Expires in 90 Days</option>
            <option value="expired">Already Expired</option>
          </select>

          <button
            type="button"
            onClick={() => setSortAsc((v) => !v)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" />
            <span>Expiration: {sortAsc ? 'Soonest First' : 'Latest First'}</span>
          </button>
        </div>
      </div>

      {/* License List */}
      {filteredLicenses.length === 0 ? (
        <div className="rounded-xl border border-slate-200/80 bg-white px-6 py-12 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 font-display text-base font-semibold text-slate-900">
            No matching licenses found
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {licenses.length === 0
              ? 'Add your first contractor license, permit, or insurance certificate to begin tracking.'
              : 'Try adjusting your search or filter criteria.'}
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#4F46E5] px-4 py-2 text-sm font-medium text-white hover:bg-[#4338CA]"
          >
            <Plus className="h-4 w-4" />
            <span>Add License</span>
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/80 bg-white">
          {filteredLicenses.map((lic) => {
            const docCount = documents.filter((d) => d.relatedLicenseId === lic.id).length;
            return (
              <div
                key={lic.id}
                onClick={() => setSelectedLicenseId(lic.id)}
                className="flex cursor-pointer flex-col gap-3 px-5 py-4 transition-colors hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3.5">
                  <CategoryIcon category={lic.category} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-display text-sm font-bold text-slate-900 sm:text-base">
                        {lic.name}
                      </h3>
                      <span className="font-mono text-xs text-slate-500 tabular-nums">
                        {lic.licenseNumber}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {lic.category} · {lic.issuingAuthority} · {getLocationName(lic.locationId)}
                      {docCount > 0 ? ` · ${docCount} file${docCount === 1 ? '' : 's'}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <div className="text-left sm:text-right">
                    <p className="text-xs font-medium text-slate-700 tabular-nums">
                      Expires {formatDisplayDate(lic.expirationDate)}
                    </p>
                    <p
                      className={`text-[11px] font-medium tabular-nums ${
                        lic.daysRemaining < 0
                          ? 'text-red-600'
                          : lic.daysRemaining <= 60
                            ? 'text-amber-700'
                            : 'text-slate-500'
                      }`}
                    >
                      {getDaysRemainingLabel(lic.daysRemaining)}
                    </p>
                  </div>

                  <StatusText status={lic.status} />

                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => openEditModal(lic)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      title="Edit license"
                      aria-label={`Edit ${lic.name}`}
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(lic)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Delete license"
                      aria-label={`Delete ${lic.name}`}
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

      {/* License Detail Drawer */}
      {selectedLicense && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-slate-950/35"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div className="min-w-0 pr-4">
                <div className="flex items-center gap-2.5">
                  <StatusText status={selectedLicense.status} />
                  <span className="font-mono text-xs text-slate-500 tabular-nums">
                    {selectedLicense.licenseNumber}
                  </span>
                </div>
                <h3 className="mt-2 font-display text-xl font-bold text-slate-900">
                  {selectedLicense.name}
                </h3>
                <p className="text-xs text-slate-500">{selectedLicense.category}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLicenseId(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close details"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Issuing Authority</p>
                  <p className="mt-0.5 font-medium text-slate-900">
                    {selectedLicense.issuingAuthority}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">State / Jurisdiction</p>
                  <p className="mt-0.5 font-medium text-slate-900">
                    {selectedLicense.stateOrJurisdiction || 'Not specified'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Business Location</p>
                  <p className="mt-0.5 flex items-center gap-1 font-medium text-slate-900">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span>{getLocationName(selectedLicense.locationId)}</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Issue Date</p>
                  <p className="mt-0.5 font-medium text-slate-900 tabular-nums">
                    {formatDisplayDate(selectedLicense.issueDate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Expiration Date</p>
                  <p className="mt-0.5 flex items-center gap-1 font-semibold text-slate-900 tabular-nums">
                    <Calendar className="h-3.5 w-3.5 text-[#4F46E5]" />
                    <span>{formatDisplayDate(selectedLicense.expirationDate)}</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Remaining Time</p>
                  <p
                    className={`mt-0.5 font-semibold tabular-nums ${
                      selectedLicense.daysRemaining < 0
                        ? 'text-red-600'
                        : selectedLicense.daysRemaining <= 60
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                    }`}
                  >
                    {getDaysRemainingLabel(selectedLicense.daysRemaining)}
                  </p>
                </div>
              </div>

              {selectedLicense.notes && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500">Notes</h4>
                  <p className="mt-1.5 rounded-lg border border-slate-200 bg-white p-3.5 text-sm leading-relaxed text-slate-700">
                    {selectedLicense.notes}
                  </p>
                </div>
              )}

              {/* Associated Documents */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500">
                  Associated Documents ({linkedDocs.length})
                </h4>
                {linkedDocs.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    No documents linked to this license yet. Upload one from the Documents tab.
                  </p>
                ) : (
                  <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {linkedDocs.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <FileText className="h-4 w-4 shrink-0 text-[#4F46E5]" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">{doc.fileName}</p>
                            <p className="text-xs text-slate-500 tabular-nums">
                              {formatFileSize(doc.fileSize)} · Uploaded {formatDisplayDate(doc.uploadDate)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => onPreviewDocument(doc)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            title="Preview"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <a
                            href={getDocumentFileUrl(companyId, doc.id, true)}
                            download={doc.fileName}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            title="Download"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Associated Compliance Requirements */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500">
                  Linked Compliance Requirements ({linkedReqs.length})
                </h4>
                {linkedReqs.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    No compliance requirements connected to this license.
                  </p>
                ) : (
                  <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {linkedReqs.map((req) => (
                      <div key={req.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">{req.title}</p>
                          <p className="text-xs text-slate-500 tabular-nums">
                            Due {formatDisplayDate(req.dueDate)}
                            {req.responsibleName ? ` · ${req.responsibleName}` : ''}
                          </p>
                        </div>
                        <StatusText status={req.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setDeleteTarget(selectedLicense)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3.5 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete</span>
              </button>
              <button
                type="button"
                onClick={() => openEditModal(selectedLicense)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#4F46E5] px-4 py-2 text-sm font-medium text-white hover:bg-[#4338CA]"
              >
                <Edit3 className="h-4 w-4" />
                <span>Edit License</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit License Modal (matching reference screen 3) */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="font-display text-lg font-bold text-slate-900">
                {editingLicense ? 'Edit License Record' : 'Add License or Certification'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="mt-5 space-y-4">
              {!editingLicense && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) setAttachedFile(file);
                  }}
                  className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
                    isDragging
                      ? 'border-[#4F46E5] bg-indigo-50/70'
                      : 'border-slate-200 bg-slate-50/70'
                  }`}
                >
                  <Upload className="mx-auto h-7 w-7 text-[#4F46E5]" />
                  {attachedFile ? (
                    <div className="mt-2">
                      <p className="text-sm font-semibold text-slate-900">{attachedFile.name}</p>
                      <p className="text-xs text-slate-500">
                        {formatFileSize(attachedFile.size)} · Ready to attach
                      </p>
                      <button
                        type="button"
                        onClick={() => setAttachedFile(null)}
                        className="mt-1.5 text-xs font-medium text-red-600 hover:underline"
                      >
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="mt-2 text-sm font-semibold text-slate-800">
                        Upload Document (Optional)
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Drag and drop PDF, JPG, PNG, or CSV here, or{' '}
                        <label className="cursor-pointer font-semibold text-[#4F46E5] hover:underline">
                          browse files
                          <input
                            type="file"
                            className="sr-only"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) setAttachedFile(file);
                            }}
                          />
                        </label>
                      </p>
                    </>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">License Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. HVAC Contractor License"
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    License / ID Number
                  </label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="e.g. #HVAC-001"
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-mono focus:border-[#4F46E5] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as LicenseCategory)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                  >
                    {LICENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Issuing Authority
                  </label>
                  <input
                    type="text"
                    value={issuingAuthority}
                    onChange={(e) => setIssuingAuthority(e.target.value)}
                    placeholder="e.g. Arizona Registrar of Contractors"
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    State / Jurisdiction
                  </label>
                  <input
                    type="text"
                    value={stateOrJurisdiction}
                    onChange={(e) => setStateOrJurisdiction(e.target.value)}
                    placeholder="e.g. Arizona"
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                  />
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
                    <option value="">All / Company-Wide</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Issue Date</label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm tabular-nums focus:border-[#4F46E5] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Expiration Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm tabular-nums focus:border-[#4F46E5] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Notes</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Renewal instructions, bond details, or permit conditions..."
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
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
                  {busy ? 'Saving...' : editingLicense ? 'Update License' : 'Save License'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete License Record"
        description={`Are you sure you want to delete "${deleteTarget?.name}" (${deleteTarget?.licenseNumber})? Its automatically synced expiration calendar event will also be removed, while uploaded documents remain in your Document Center.`}
        confirmLabel="Delete License"
        isBusy={busy}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
