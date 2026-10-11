import { create } from 'zustand';

export type SortOption = 'newest' | 'name' | 'category';
export type ViewMode = 'flat' | 'grouped';
export type CompactMode = 'off' | 'rows' | 'mini' | 'tiles';

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
  compactMode: CompactMode;
  geoOrderId: string | null;
  setFilters: (filters: Partial<AppState['filters']>) => void;
  removeFilter: (key: keyof AppState['filters']) => void;
  clearFilters: () => void;
  setSortBy: (sort: SortOption) => void;
  setViewMode: (mode: ViewMode) => void;
  setCompactMode: (mode: CompactMode) => void;
  cycleCompactMode: () => void;
  setGeoOrderId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  filters: {},
  sortBy: 'newest',
  viewMode: 'flat',
  compactMode: 'mini',
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
  cycleCompactMode: () =>
    set((state) => {
      const order: CompactMode[] = ['off', 'rows', 'mini', 'tiles'];
      const next = order[(order.indexOf(state.compactMode) + 1) % order.length];
      return { compactMode: next };
    }),
  setGeoOrderId: (geoOrderId) => set({ geoOrderId }),
}));
