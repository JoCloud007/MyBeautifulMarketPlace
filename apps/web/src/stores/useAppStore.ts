import { create } from 'zustand';

export type SortOption = 'newest' | 'name' | 'category';
export type ViewMode = 'flat' | 'grouped';

interface AppState {
  filters: {
    category?: string;
    os?: string;
    flavor?: string;
    search?: string;
    computeType?: string;
  };
  sortBy: SortOption;
  viewMode: ViewMode;
  compactMode: boolean;
  geoOrderId: string | null;
  setFilters: (filters: Partial<AppState['filters']>) => void;
  removeFilter: (key: keyof AppState['filters']) => void;
  clearFilters: () => void;
  setSortBy: (sort: SortOption) => void;
  setViewMode: (mode: ViewMode) => void;
  setCompactMode: (mode: boolean) => void;
  setGeoOrderId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  filters: {},
  sortBy: 'newest',
  viewMode: 'flat',
  compactMode: false,
  geoOrderId: null,
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
  setViewMode: (viewMode) => set({ viewMode }),
  setCompactMode: (compactMode) => set({ compactMode }),
  setGeoOrderId: (geoOrderId) => set({ geoOrderId }),
}));
