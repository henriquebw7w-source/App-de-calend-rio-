import React, { useMemo, useState } from 'react';
import {
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { apiFetch, fileToBase64, getDocumentFileUrl } from '../lib/api';
import { formatDisplayDate, formatFileSize } from '../lib/format';
import {
  DOCUMENT_CATEGORIES,
  type ComplianceRequirement,
  type DocumentCategory,
  type DocumentRecord,
  type License,
} from '../types/compliance';
import { ConfirmModal } from './ui/ConfirmModal';

interface DocumentsViewProps {
  companyId: string;
  documents: DocumentRecord[];
  licenses: License[];
  requirements: ComplianceRequirement[];
  openUploadRequested?: boolean;
  onConsumeUploadRequest?: () => void;
  onDataChanged: () => Promise<void>;
  onPreviewDocument: (doc: DocumentRecord) => void;
}

function DocFileIcon({ mimeType, fileName }: { mimeType: string; fileName: string }) {
  const lower = fileName.toLowerCase();
  if (mimeType.includes('pdf') || lower.endsWith('.pdf')) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
        <FileText className="h-5 w-5" />
      </div>
    );
  }
  if (
    mimeType.includes('csv') ||
    mimeType.includes('spreadsheet') ||
    lower.endsWith('.csv') ||
    lower.endsWith('.xlsx')
  ) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
        <FileSpreadsheet className="h-5 w-5" />
      </div>
    );
  }
  if (mimeType.startsWith('image/')) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-[#4F46E5]">
        <ImageIcon className="h-5 w-5" />
      </div>
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
      <FileText className="h-5 w-5" />
    </div>
  );
}

export function DocumentsView({
  companyId,
  documents,
  licenses,
  requirements,
  openUploadRequested,
  onConsumeUploadRequest,
  onDataChanged,
  onPreviewDocument,
}: DocumentsViewProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocumentRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload / Edit Form State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileNameInput, setFileNameInput] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('Licenses');
  const [expirationDate, setExpirationDate] = useState('');
  const [relatedLicenseId, setRelatedLicenseId] = useState('');
  const [relatedRequirementId, setRelatedRequirementId] = useState('');
  const [notes, setNotes] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const openUploadModal = React.useCallback(() => {
    setEditingDoc(null);
    setSelectedFile(null);
    setFileNameInput('');
    setCategory('Licenses');
    setExpirationDate('');
    setRelatedLicenseId('');
    setRelatedRequirementId('');
    setNotes('');
    setError(null);
    setUploadModalOpen(true);
  }, []);

  React.useEffect(() => {
    if (openUploadRequested) {
      openUploadModal();
      onConsumeUploadRequest?.();
    }
  }, [openUploadRequested, openUploadModal, onConsumeUploadRequest]);

  const openEditModal = (doc: DocumentRecord) => {
    setEditingDoc(doc);
    setSelectedFile(null);
    setFileNameInput(doc.fileName);
    setCategory(doc.category);
    setExpirationDate(doc.expirationDate || '');
    setRelatedLicenseId(doc.relatedLicenseId || '');
    setRelatedRequirementId(doc.relatedRequirementId || '');
    setNotes(doc.notes);
    setError(null);
    setUploadModalOpen(true);
  };

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((doc) => {
      if (categoryFilter !== 'All' && doc.category !== categoryFilter) return false;
      if (q) {
        const licName = licenses.find((l) => l.id === doc.relatedLicenseId)?.name || '';
        const hay = `${doc.fileName} ${doc.category} ${doc.notes} ${licName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [documents, licenses, search, categoryFilter]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (editingDoc) {
        await apiFetch(`/api/c/${companyId}/documents/${editingDoc.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            fileName: fileNameInput,
            category,
            expirationDate: expirationDate || null,
            relatedLicenseId: relatedLicenseId || null,
            relatedRequirementId: relatedRequirementId || null,
            notes,
          }),
        });
      } else {
        if (!selectedFile) {
          setError('Please select a file to upload.');
          setBusy(false);
          return;
        }
        const base64Data = await fileToBase64(selectedFile);
        await apiFetch(`/api/c/${companyId}/documents`, {
          method: 'POST',
          body: JSON.stringify({
            fileName: fileNameInput.trim() || selectedFile.name,
            mimeType: selectedFile.type || 'application/octet-stream',
            base64Data,
            category,
            expirationDate: expirationDate || null,
            relatedLicenseId: relatedLicenseId || null,
            relatedRequirementId: relatedRequirementId || null,
            notes,
          }),
        });
      }
      setUploadModalOpen(false);
      await onDataChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save document.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await apiFetch(`/api/c/${companyId}/documents/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      setDeleteTarget(null);
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
          <h2 className="font-display text-xl font-bold text-slate-900">Document Center</h2>
          <p className="text-sm text-slate-500">
            Store, organize, preview, and link certificates, policies, and inspection records.
          </p>
        </div>
        <button
          type="button"
          onClick={openUploadModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#4F46E5] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#4338CA] whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Search & Category Filter */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 space-y-3">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents by file name, linked license, or notes..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50/60 py-2 pl-9 pr-3 text-sm focus:border-[#4F46E5] focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {['All', ...DOCUMENT_CATEGORIES].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                categoryFilter === cat
                  ? 'bg-[#4F46E5] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Document List */}
      {filteredDocs.length === 0 ? (
        <div className="rounded-xl border border-slate-200/80 bg-white px-6 py-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 font-display text-base font-semibold text-slate-900">
            No documents found
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Upload contractor licenses, certificates of insurance, or compliance reports.
          </p>
          <button
            type="button"
            onClick={openUploadModal}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#4F46E5] px-4 py-2 text-sm font-medium text-white hover:bg-[#4338CA]"
          >
            <Upload className="h-4 w-4" />
            <span>Upload First Document</span>
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/80 bg-white">
          {filteredDocs.map((doc) => {
            const linkedLic = licenses.find((l) => l.id === doc.relatedLicenseId);
            const linkedReq = requirements.find((r) => r.id === doc.relatedRequirementId);
            return (
              <div
                key={doc.id}
                className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3.5">
                  <DocFileIcon mimeType={doc.mimeType} fileName={doc.fileName} />
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onPreviewDocument(doc)}
                      className="truncate text-left font-display text-sm font-bold text-slate-900 hover:text-[#4F46E5]"
                    >
                      {doc.fileName}
                    </button>
                    <p className="mt-0.5 text-xs text-slate-500">
                      <span className="tabular-nums">{formatFileSize(doc.fileSize)}</span>
                      {' · '}
                      <span>{doc.category}</span>
                      {' · '}
                      <span className="tabular-nums">Uploaded {formatDisplayDate(doc.uploadDate)}</span>
                      {doc.expirationDate ? (
                        <>
                          {' · '}
                          <span className="tabular-nums">
                            Expires {formatDisplayDate(doc.expirationDate)}
                          </span>
                        </>
                      ) : null}
                    </p>
                    {(linkedLic || linkedReq) && (
                      <p className="mt-1 text-xs font-medium text-[#4F46E5]">
                        {linkedLic ? `Linked License: ${linkedLic.name}` : ''}
                        {linkedLic && linkedReq ? ' · ' : ''}
                        {linkedReq ? `Linked Requirement: ${linkedReq.title}` : ''}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => onPreviewDocument(doc)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Preview</span>
                  </button>
                  <a
                    href={getDocumentFileUrl(companyId, doc.id, true)}
                    download={doc.fileName}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => openEditModal(doc)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    title="Edit details"
                    aria-label={`Edit ${doc.fileName}`}
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(doc)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title="Delete document"
                    aria-label={`Delete ${doc.fileName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload / Edit Document Modal */}
      {uploadModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="font-display text-lg font-bold text-slate-900">
                {editingDoc ? 'Edit Document Details' : 'Upload Document'}
              </h3>
              <button
                type="button"
                onClick={() => setUploadModalOpen(false)}
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
              {!editingDoc && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) {
                      setSelectedFile(f);
                      if (!fileNameInput) setFileNameInput(f.name);
                    }
                  }}
                  className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
                    isDragging
                      ? 'border-[#4F46E5] bg-indigo-50/70'
                      : 'border-slate-200 bg-slate-50/70'
                  }`}
                >
                  <Upload className="mx-auto h-7 w-7 text-[#4F46E5]" />
                  {selectedFile ? (
                    <div className="mt-2">
                      <p className="text-sm font-semibold text-slate-900">{selectedFile.name}</p>
                      <p className="text-xs text-slate-500">{formatFileSize(selectedFile.size)}</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-600">
                      Drag and drop a file (PDF, JPG, PNG, CSV, TXT up to 15 MB) or{' '}
                      <label className="cursor-pointer font-semibold text-[#4F46E5] hover:underline">
                        choose from device
                        <input
                          type="file"
                          className="sr-only"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              setSelectedFile(f);
                              if (!fileNameInput) setFileNameInput(f.name);
                            }
                          }}
                        />
                      </label>
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700">Document Name</label>
                <input
                  type="text"
                  value={fileNameInput}
                  onChange={(e) => setFileNameInput(e.target.value)}
                  placeholder="e.g. HVAC_License_2026.pdf"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as DocumentCategory)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                  >
                    {DOCUMENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Expiration Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm tabular-nums focus:border-[#4F46E5] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Related License
                  </label>
                  <select
                    value={relatedLicenseId}
                    onChange={(e) => setRelatedLicenseId(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                  >
                    <option value="">None</option>
                    {licenses.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.licenseNumber})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Related Requirement
                  </label>
                  <select
                    value={relatedRequirementId}
                    onChange={(e) => setRelatedRequirementId(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
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
                <label className="block text-xs font-medium text-slate-700">Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional filing notes..."
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-[#4F46E5] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-[#4F46E5] px-5 py-2 text-sm font-medium text-white hover:bg-[#4338CA] disabled:opacity-50"
                >
                  {busy ? 'Uploading...' : editingDoc ? 'Save Changes' : 'Upload File'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Document"
        description={`Are you sure you want to permanently delete "${deleteTarget?.fileName}"? This removes the file from storage.`}
        confirmLabel="Delete Document"
        isBusy={busy}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
