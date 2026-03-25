import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { citizenApi } from '../lib/api';

const TOKEN_KEY = 'citizen_token';
const USER_KEY = 'citizen_user';

interface CitizenUser {
  id: number;
  full_name: string;
  phone: string;
  barangay?: string;
  is_suspended?: boolean;
  suspension_reason?: string;
  trust?: { score: number; total_alerts: number; false_alarms: number; resolved_emergencies: number };
  strike_count?: number;
}

interface CitizenAuthContextType {
  citizen: CitizenUser | null;
  user: CitizenUser | null;
  loading: boolean;
  login: (phone: string, pin: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const CitizenAuthContext = createContext<CitizenAuthContextType | null>(null);

function saveSession(token: string, user: CitizenUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem('safesignal_citizen_token', token);
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem('safesignal_citizen_token');
}

export function CitizenAuthProvider({ children }: { children: ReactNode }) {
  const [citizen, setCitizen] = useState<CitizenUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (token && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as CitizenUser;
        setCitizen(parsedUser);
        localStorage.setItem('safesignal_citizen_token', token);
        citizenApi.getProfile()
          .then((data: any) => {
            setCitizen(data.citizen);
            localStorage.setItem(USER_KEY, JSON.stringify(data.citizen));
          })
          .catch(() => {
            clearSession();
            setCitizen(null);
          })
          .finally(() => setLoading(false));
      } catch {
        clearSession();
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (phone: string, pin: string) => {
    const data: any = await citizenApi.login({ phone, pin });
    // Normalize: API returns 'name', interface expects 'full_name'
    const citizen = { ...data.citizen, full_name: data.citizen.full_name || data.citizen.name };
    saveSession(data.token, citizen);
    setCitizen(citizen);
  };

  const logout = () => {
    clearSession();
    setCitizen(null);
  };

  const refreshProfile = async () => {
    const data: any = await citizenApi.getProfile();
    const refreshed = { ...data.citizen, full_name: data.citizen.full_name || data.citizen.name };
    setCitizen(refreshed);
    localStorage.setItem(USER_KEY, JSON.stringify(refreshed));
  };

  return (
    <CitizenAuthContext.Provider value={{ citizen, user: citizen, loading, login, logout, refreshProfile }}>
      {children}
    </CitizenAuthContext.Provider>
  );
}

export function useCitizenAuth() {
  const ctx = useContext(CitizenAuthContext);
  if (!ctx) throw new Error('useCitizenAuth must be used within CitizenAuthProvider');
  return ctx;
}
