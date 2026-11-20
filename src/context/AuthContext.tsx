import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch, setAuthToken } from '../lib/api';
import type { Company, CompanyMember, User } from '../types/compliance';

export interface CompanyMembershipItem {
  company: Company;
  membership: CompanyMember;
}

interface AuthContextValue {
  user: User | null;
  companies: CompanyMembershipItem[];
  activeCompany: Company | null;
  activeMembership: CompanyMember | null;
  isLoading: boolean;
  setActiveCompanyId: (companyId: string) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    fullName: string;
    email: string;
    password: string;
    companyName: string;
    primaryState: string;
    industry: string;
  }) => Promise<void>;
  enterDemoMode: () => Promise<void>;
  createCompany: (payload: { name: string; primaryState: string; industry: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [companies, setCompanies] = useState<CompanyMembershipItem[]>([]);
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applySessionPayload = useCallback(
    (payload: {
      user: User;
      companies: CompanyMembershipItem[];
      token?: string;
      activeCompanyId?: string | null;
    }) => {
      if (payload.token) {
        setAuthToken(payload.token);
      }
      setUser(payload.user);
      setCompanies(payload.companies);
      const nextId =
        payload.activeCompanyId ||
        (payload.companies.some((c) => c.company.id === activeCompanyId)
          ? activeCompanyId
          : payload.companies[0]?.company.id) ||
        null;
      setActiveCompanyIdState(nextId);
    },
    [activeCompanyId]
  );

  const refreshSession = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: User; companies: CompanyMembershipItem[] }>('/api/auth/me');
      applySessionPayload(data);
    } catch {
      setUser(null);
      setCompanies([]);
      setActiveCompanyIdState(null);
    } finally {
      setIsLoading(false);
    }
  }, [applySessionPayload]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = async (email: string, password: string) => {
    const data = await apiFetch<{
      token: string;
      user: User;
      companies: CompanyMembershipItem[];
      activeCompanyId: string | null;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    applySessionPayload(data);
  };

  const register = async (payload: {
    fullName: string;
    email: string;
    password: string;
    companyName: string;
    primaryState: string;
    industry: string;
  }) => {
    const data = await apiFetch<{
      token: string;
      user: User;
      companies: CompanyMembershipItem[];
      activeCompanyId: string | null;
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    applySessionPayload(data);
  };

  const enterDemoMode = async () => {
    const data = await apiFetch<{
      token: string;
      user: User;
      companies: CompanyMembershipItem[];
      activeCompanyId: string | null;
    }>('/api/auth/demo', {
      method: 'POST',
    });
    applySessionPayload(data);
  };

  const createCompany = async (payload: { name: string; primaryState: string; industry: string }) => {
    const data = await apiFetch<{ company: Company; companies: CompanyMembershipItem[] }>('/api/companies', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setCompanies(data.companies);
    setActiveCompanyIdState(data.company.id);
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setAuthToken(null);
      setUser(null);
      setCompanies([]);
      setActiveCompanyIdState(null);
    }
  };

  const activeItem =
    companies.find((c) => c.company.id === activeCompanyId) || companies[0] || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        companies,
        activeCompany: activeItem?.company || null,
        activeMembership: activeItem?.membership || null,
        isLoading,
        setActiveCompanyId: (id) => setActiveCompanyIdState(id),
        login,
        register,
        enterDemoMode,
        createCompany,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
