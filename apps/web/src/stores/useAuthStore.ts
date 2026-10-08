import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Role } from '@cloudmarket/shared-types';

export interface SimulatedUser {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  managerId: string | null;
}

interface AuthState {
  user: SimulatedUser | null;
  activeRole: Role | null;
  setUser: (user: SimulatedUser | null) => void;
  setActiveRole: (role: Role | null) => void;
}

/**
 * Simulated auth: the user picks an identity from the seeded user list
 * (or enters an ad-hoc name/email). No real authentication — this drives
 * the role-switcher and the forecast lifecycle queues.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      activeRole: null,
      setUser: (user) => set({ user, activeRole: user?.roles[0] ?? null }),
      setActiveRole: (role) => set({ activeRole: role }),
    }),
    { name: 'cloudmarket-auth' }
  )
);
