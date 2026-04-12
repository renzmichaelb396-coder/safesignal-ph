import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { dispatchApi } from '../lib/api';

const TOKEN_KEY = 'dispatch_token';
const USER_KEY = 'dispatch_user';

interface OfficerUser {
  id: number;
  full_name: string;
  badge_number: string;
  role: string;
  email: string;
  station?: any;
}

interface DispatchAuthContextType {
  officer: OfficerUser | null;
  loading: boolean;
  login: (email: string, password: string, badge_number: string, remember?: boolean) => Promise<void>;
  logout: () => void;
}

const DispatchAuthContext = createContext<DispatchAuthContextType | null>(null);

function saveSession(token: string, user: OfficerUser) {
  // Only write dispatch-specific keys — never touch officer keys (safesignal_officer_token/data).
  // Cross-writing causes session contamination when both roles are used in the same browser.
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  // Only clear dispatch-specific keys — never touch officer keys.
  // OfficerDashboard manages its own session independently.
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function DispatchAuthProvider({ children }: { children: ReactNode }) {
  const [officer, setOfficer] = useState<OfficerUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only read from dispatch-specific keys — never fall back to officer keys.
    // Officer sessions (safesignal_officer_token) must not bleed into dispatch auth.
    const token = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (token && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as OfficerUser;
        setOfficer(parsedUser);
      } catch {
        clearSession();
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string, badge_number: string, remember?: boolean) => {
    const data: any = await dispatchApi.login({ email, password, badge_number, remember });
    // Normalize officer: API returns 'name', interface expects 'full_name'
    const officer = { ...data.officer, full_name: data.officer.full_name || data.officer.name };
    saveSession(data.token, officer);
    setOfficer(officer);
  };

  const logout = () => {
    clearSession();
    setOfficer(null);
  };

  return (
    <DispatchAuthContext.Provider value={{ officer, loading, login, logout }}>
      {children}
    </DispatchAuthContext.Provider>
  );
}

export function useDispatchAuth() {
  const ctx = useContext(DispatchAuthContext);
  if (!ctx) throw new Error('useDispatchAuth must be used within DispatchAuthProvider');
  return ctx;
}
