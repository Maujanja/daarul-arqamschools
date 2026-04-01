import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types';

interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
  department?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginAsAdmin: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginAsTeacher: (name: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginAsParent: (studentName: string, rollNumber: string) => Promise<{ success: boolean; error?: string }>;
  loginAsSecretary: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginAsAccountant: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginAsHeadOfSchool: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'edumanage_auth';

async function secureLogin(
  loginType: 'admin' | 'teacher' | 'parent' | 'secretary' | 'accountant' | 'head_of_school',
  credentials: Record<string, string>
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('secure-auth', {
      body: { loginType, credentials },
    });

    if (error) {
      console.error('Auth function error:', error);
      return { success: false, error: 'Authentication service unavailable' };
    }

    return data;
  } catch (err: any) {
    console.error('Auth error:', err);
    return { success: false, error: err.message || 'Authentication failed' };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
    if (storedAuth) {
      try {
        const parsedUser = JSON.parse(storedAuth);
        setUser(parsedUser);
      } catch (error) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const handleLoginResult = useCallback((result: { success: boolean; user?: AuthUser; error?: string }) => {
    if (result.success && result.user) {
      const authUser = result.user as AuthUser;
      setUser(authUser);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
      return { success: true };
    }
    return { success: false, error: result.error || 'Login failed' };
  }, []);

  const loginAsAdmin = useCallback(async (username: string, password: string) => {
    return handleLoginResult(await secureLogin('admin', { username, password }));
  }, [handleLoginResult]);

  const loginAsTeacher = useCallback(async (name: string, password: string) => {
    return handleLoginResult(await secureLogin('teacher', { name, password }));
  }, [handleLoginResult]);

  const loginAsParent = useCallback(async (studentName: string, rollNumber: string) => {
    return handleLoginResult(await secureLogin('parent', { studentName, rollNumber }));
  }, [handleLoginResult]);

  const loginAsSecretary = useCallback(async (username: string, password: string) => {
    return handleLoginResult(await secureLogin('secretary', { username, password }));
  }, [handleLoginResult]);

  const loginAsAccountant = useCallback(async (username: string, password: string) => {
    return handleLoginResult(await secureLogin('accountant', { username, password }));
  }, [handleLoginResult]);

  const loginAsHeadOfSchool = useCallback(async (username: string, password: string) => {
    return handleLoginResult(await secureLogin('head_of_school', { username, password }));
  }, [handleLoginResult]);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      loginAsAdmin,
      loginAsTeacher,
      loginAsParent,
      loginAsSecretary,
      loginAsAccountant,
      loginAsHeadOfSchool,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
