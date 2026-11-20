import { useEffect, useState } from 'react';
import { Download, FileText, X } from 'lucide-react';
import { getDocumentFileUrl } from '../lib/api';
import { formatDisplayDate, formatFileSize } from '../lib/format';
import type { DocumentRecord } from '../types/compliance';

interface DocumentPreviewModalProps {
  companyId: string;
  doc: DocumentRecord | null;
  onClose: () => void;
}

export function DocumentPreviewModal({ companyId, doc, onClose }: DocumentPreviewModalProps) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);

  const lowerName = doc?.fileName.toLowerCase() || '';
  const isPdf = Boolean(doc && (doc.mimeType.includes('pdf') || lowerName.endsWith('.pdf')));
  const isImage = Boolean(doc && doc.mimeType.startsWith('image/'));
  const isText = Boolean(
    doc &&
      (doc.mimeType.startsWith('text/') ||
        lowerName.endsWith('.csv') ||
        lowerName.endsWith('.txt') ||
        lowerName.endsWith('.json'))
  );

  useEffect(() => {
    if (!doc || !isText) {
      setTextContent(null);
      return;
    }
    let cancelled = false;
    setLoadingText(true);
    fetch(getDocumentFileUrl(companyId, doc.id, false), { credentials: 'include' })
      .then((res) => res.text())
      .then((txt) => {
        if (!cancelled) setTextContent(txt);
      })
      .catch(() => {
        if (!cancelled) setTextContent('Unable to preview text content.');
      })
      .finally(() => {
        if (!cancelled) setLoadingText(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, doc, isText]);

  if (!doc) return null;

  const fileUrl = getDocumentFileUrl(companyId, doc.id, false);
  const downloadUrl = getDocumentFileUrl(companyId, doc.id, true);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <h3 className="truncate font-display text-base font-bold text-slate-900">
              {doc.fileName}
            </h3>
            <p className="text-xs text-slate-500">
              {doc.category} · <span className="tabular-nums">{formatFileSize(doc.fileSize)}</span> · Uploaded{' '}
              <span className="tabular-nums">{formatDisplayDate(doc.uploadDate)}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={downloadUrl}
              download={doc.fileName}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#4F46E5] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#4338CA]"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-100 p-4">
          {isPdf ? (
            <iframe
              src={fileUrl}
              title={doc.fileName}
              className="h-full w-full rounded-lg border border-slate-200 bg-white"
            />
          ) : isImage ? (
            <div className="flex h-full items-center justify-center">
              <img
                src={fileUrl}
                alt={doc.fileName}
                referrerPolicy="no-referrer"
                className="max-h-full max-w-full rounded-lg border border-slate-200 bg-white object-contain shadow-xs"
              />
            </div>
          ) : isText ? (
            <div className="h-full overflow-auto rounded-lg border border-slate-200 bg-white p-5">
              {loadingText ? (
                <p className="text-sm text-slate-500">Loading document preview...</p>
              ) : (
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-800">
                  {textContent}
                </pre>
              )}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-8 text-center">
              <FileText className="h-12 w-12 text-slate-300" />
              <p className="mt-3 font-display text-base font-semibold text-slate-900">
                Preview not available for this file format
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Download the file to open it in its native application.
              </p>
              <a
                href={downloadUrl}
                download={doc.fileName}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#4F46E5] px-4 py-2 text-sm font-medium text-white hover:bg-[#4338CA]"
              >
                <Download className="h-4 w-4" />
                <span>Download {doc.fileName}</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
