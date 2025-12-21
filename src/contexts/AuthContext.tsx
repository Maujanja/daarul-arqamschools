import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types';

interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginAsAdmin: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginAsTeacher: (name: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginAsParent: (studentName: string, rollNumber: string) => Promise<{ success: boolean; error?: string }>;
  loginAsSecretary: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'edumanage_auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount
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

  const loginAsAdmin = useCallback(async (username: string, password: string) => {
    try {
      const { data, error } = await supabase
        .from('admin_credentials')
        .select('*')
        .eq('username', username)
        .eq('password_hash', password)
        .maybeSingle();

      if (error || !data) {
        return { success: false, error: 'Jina au nywila si sahihi' };
      }

      const authUser: AuthUser = {
        id: data.id,
        name: 'Admin',
        role: 'admin',
      };

      setUser(authUser);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Kuingia kumeshindikana' };
    }
  }, []);

  const loginAsTeacher = useCallback(async (name: string, password: string) => {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .ilike('full_name', name)
        .eq('password_hash', password)
        .maybeSingle();

      if (error || !data) {
        return { success: false, error: 'Jina au nywila si sahihi' };
      }

      const authUser: AuthUser = {
        id: data.id,
        name: data.full_name,
        role: 'teacher',
      };

      setUser(authUser);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Kuingia kumeshindikana' };
    }
  }, []);

  const loginAsParent = useCallback(async (studentName: string, rollNumber: string) => {
    try {
      // Find student by name and roll number
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('*, parents(*)')
        .ilike('full_name', studentName)
        .eq('roll_number', rollNumber)
        .maybeSingle();

      if (studentError || !student) {
        return { success: false, error: 'Jina la mwanafunzi au ID si sahihi' };
      }

      // Get parent info
      const parent = student.parents;
      
      const authUser: AuthUser = {
        id: parent?.id || student.id,
        name: parent?.full_name || `Mzazi wa ${student.full_name}`,
        role: 'parent',
      };

      setUser(authUser);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Kuingia kumeshindikana' };
    }
  }, []);

  const loginAsSecretary = useCallback(async (username: string, password: string) => {
    try {
      const { data, error } = await supabase
        .from('secretary_credentials')
        .select('*')
        .eq('username', username)
        .eq('password_hash', password)
        .maybeSingle();

      if (error || !data) {
        return { success: false, error: 'Jina au nywila si sahihi' };
      }

      const authUser: AuthUser = {
        id: data.id,
        name: data.full_name,
        role: 'secretary',
      };

      setUser(authUser);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Kuingia kumeshindikana' };
    }
  }, []);

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