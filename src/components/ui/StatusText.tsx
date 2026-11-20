import { AlertCircle, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import type { LicenseStatus, RequirementStatus } from '../../types/compliance';

type AnyStatus = LicenseStatus | RequirementStatus | 'Completed' | 'Pending';

export function StatusText({ status }: { status: AnyStatus | string }) {
  if (status === 'Active' || status === 'Completed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 whitespace-nowrap shrink-0">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        <span>{status}</span>
      </span>
    );
  }
  if (status === 'Expiring Soon' || status === 'In Progress') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 whitespace-nowrap shrink-0">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>{status}</span>
      </span>
    );
  }
  if (status === 'Expired' || status === 'Overdue') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 whitespace-nowrap shrink-0">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        <span>{status}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 whitespace-nowrap shrink-0">
      <Clock className="h-3.5 w-3.5 shrink-0" />
      <span>{status}</span>
    </span>
  );
}
