import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type UserRole = "customer" | "worker" | "admin";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar_url?: string;
  phone?: string;
}

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

async function fetchAppUser(userId: string): Promise<AppUser | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!profile) return null;

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: (roleData?.role as UserRole) || "customer",
    avatar_url: profile.avatar_url ?? undefined,
    phone: profile.phone ?? undefined,
  };
}

// Set worker online status and location
async function setWorkerOnline(userId: string, role: string, online: boolean) {
  if (role !== "worker") return;

  const updates: any = { is_online: online };

  if (online && navigator.geolocation) {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
      );
      updates.latitude = pos.coords.latitude;
      updates.longitude = pos.coords.longitude;
    } catch {
      // Location unavailable, just toggle online
    }
  }

  await supabase.from("worker_profiles").update(updates).eq("user_id", userId);
  await supabase.from("profiles").update({ is_online: online, ...(updates.latitude ? { latitude: updates.latitude, longitude: updates.longitude } : {}) }).eq("id", userId);
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async (sess: Session | null) => {
    if (!sess?.user) {
      setUser(null);
      setSession(null);
      setLoading(false);
      return;
    }
    setSession(sess);
    const appUser = await fetchAppUser(sess.user.id);
    setUser(appUser);
    setLoading(false);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, sess) => {
        loadUser(sess);
      }
    );

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      loadUser(sess);
    });

    return () => subscription.unsubscribe();
  }, [loadUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    if (data.user) {
      // Fetch role to set online
      const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).single();
      const role = roleData?.role || "customer";
      
      // Set worker online with location on login
      await setWorkerOnline(data.user.id, role, true);

      supabase.from("activity_logs").insert({
        user_id: data.user.id, action: "User Login",
        detail: "User signed in", entity_type: "user", entity_id: data.user.id,
      }).then(() => {});
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string, role: UserRole) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role },
      },
    });
    if (error) throw error;
  }, []);

  const logout = useCallback(async () => {
    // Set worker offline before logging out
    if (user) {
      await setWorkerOnline(user.id, user.role, false);
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, [user]);

  const refreshProfile = useCallback(async () => {
    if (session?.user) {
      const appUser = await fetchAppUser(session.user.id);
      setUser(appUser);
    }
  }, [session]);

  return (
    <AuthContext.Provider value={{ user, session, isAuthenticated: !!user, loading, login, signup, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
