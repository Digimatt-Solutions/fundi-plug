import React, { createContext, useContext, useState, useCallback } from "react";

export type UserRole = "customer" | "worker" | "admin";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

interface AuthContextType {
  user: AppUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, role: UserRole) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(() => {
    const saved = localStorage.getItem("skillhub_user");
    return saved ? JSON.parse(saved) : null;
  });

  const login = useCallback(async (email: string, _password: string) => {
    // Mock login - will be replaced with Supabase
    const mockUser: AppUser = {
      id: crypto.randomUUID(),
      email,
      name: email.split("@")[0],
      role: email.includes("admin") ? "admin" : email.includes("worker") ? "worker" : "customer",
      avatar: undefined,
    };
    setUser(mockUser);
    localStorage.setItem("skillhub_user", JSON.stringify(mockUser));
  }, []);

  const signup = useCallback(async (email: string, _password: string, name: string, role: UserRole) => {
    const mockUser: AppUser = { id: crypto.randomUUID(), email, name, role };
    setUser(mockUser);
    localStorage.setItem("skillhub_user", JSON.stringify(mockUser));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("skillhub_user");
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
