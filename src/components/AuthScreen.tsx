import React, { useState } from 'react';
import {
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  FileText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { BRAND_CONFIG } from '../config/brand';
import { useAuth } from '../context/AuthContext';

export function AuthScreen() {
  const { login, register, enterDemoMode } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [primaryState, setPrimaryState] = useState('AZ');
  const [industry, setIndustry] = useState('Commercial & Residential HVAC');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register({
          fullName,
          email,
          password,
          companyName,
          primaryState,
          industry,
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleDemo = async () => {
    setError(null);
    setBusy(true);
    try {
      await enterDemoMode();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not open demo workspace.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6FB] text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-10 px-4 py-10 lg:grid-cols-12 lg:px-8">
        {/* Left Value & Architecture Overview */}
        <div className="lg:col-span-6">
          <div className="rounded-2xl bg-[#0F172A] p-8 text-white shadow-sm sm:p-10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4F46E5] text-white">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <span className="font-display text-xl font-bold tracking-tight">
                {BRAND_CONFIG.appName}
              </span>
            </div>

            <h1 className="mt-8 font-display text-3xl font-bold leading-tight tracking-tight text-balance sm:text-4xl">
              Centralize every license, permit, and renewal deadline.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-slate-300">
              Built for U.S. HVAC and mechanical service companies to replace scattered
              spreadsheets and folders with one organized compliance calendar and document vault.
            </p>

            <div className="mt-8 space-y-4 border-t border-white/10 pt-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-sm font-semibold text-white">Automatic Expiration Tracking</p>
                  <p className="text-xs text-slate-400">
                    Calculates Active, Expiring Soon, and Expired records with configurable 60/30/7-day alerts.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-indigo-400" />
                <div>
                  <p className="text-sm font-semibold text-white">Interactive Compliance Calendar</p>
                  <p className="text-xs text-slate-400">
                    License expirations and requirement due dates sync automatically alongside manual team tasks.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
                <div>
                  <p className="text-sm font-semibold text-white">Company-Isolated Document Vault</p>
                  <p className="text-xs text-slate-400">
                    Upload, preview, download, and link certificates directly to licenses and obligations.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-xl border border-white/15 bg-white/5 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold text-indigo-300">Interactive Demo Workspace</p>
                  <p className="mt-0.5 text-sm text-slate-200">
                    Explore Acme HVAC Corp with sample Arizona contractor licenses, documents, and scheduled events.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDemo}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#4F46E5] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#4338CA] disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Try Demo Workspace</span>
                </button>
              </div>
            </div>

            <p className="mt-6 text-xs leading-relaxed text-slate-400">
              {BRAND_CONFIG.organizationalDisclaimer}
            </p>
          </div>
        </div>

        {/* Right Sign In / Register Company Form */}
        <div className="lg:col-span-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900">
                  {mode === 'login' ? 'Sign in to your workspace' : 'Register your company'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {mode === 'login'
                    ? 'Access your isolated company compliance records.'
                    : 'Create an owner account and initialize your company workspace.'}
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    mode === 'login'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    mode === 'register'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Register
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {mode === 'register' && (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700">
                        Your Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="John Miller"
                        className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/15"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700">
                        Company Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Desert Air HVAC LLC"
                        className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/15"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700">
                        Primary State
                      </label>
                      <input
                        type="text"
                        value={primaryState}
                        onChange={(e) => setPrimaryState(e.target.value)}
                        placeholder="AZ"
                        className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/15"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700">
                        Trade / Industry
                      </label>
                      <input
                        type="text"
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        placeholder="HVAC & Mechanical"
                        className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/15"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700">Work Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/15"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/15"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#4F46E5] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4338CA] disabled:opacity-50"
              >
                <span>
                  {busy
                    ? 'Please wait...'
                    : mode === 'login'
                      ? 'Sign In'
                      : 'Create Company Workspace'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-400" />
                <span>Local Workspace Persistence Active</span>
              </div>
              <span>Multi-company isolation enabled</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
