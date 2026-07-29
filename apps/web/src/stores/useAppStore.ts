import { create } from 'zustand';

export type SortOption = 'newest' | 'name' | 'category';

interface AppState {
  filters: {
    category?: string;
    os?: string;
    flavor?: string;
    search?: string;
  };
  sortBy: SortOption;
  setFilters: (filters: Partial<AppState['filters']>) => void;
  removeFilter: (key: keyof AppState['filters']) => void;
  clearFilters: () => void;
  setSortBy: (sort: SortOption) => void;
}

export const useAppStore = create<AppState>((set) => ({
  filters: {},
  sortBy: 'newest',
  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),
  removeFilter: (key) =>
    set((state) => {
      const next = { ...state.filters };
      delete next[key];
      return { filters: next };
    }),
  clearFilters: () => set({ filters: {} }),
  setSortBy: (sortBy) => set({ sortBy }),
}));
