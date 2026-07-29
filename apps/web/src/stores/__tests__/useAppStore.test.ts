import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/stores/useAppStore';

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({ filters: {}, sortBy: 'newest' });
  });

  it('has default empty filters and newest sort', () => {
    const state = useAppStore.getState();
    expect(state.filters).toEqual({});
    expect(state.sortBy).toBe('newest');
  });

  it('setFilters adds a single filter', () => {
    useAppStore.getState().setFilters({ category: 'Compute' });
    expect(useAppStore.getState().filters).toEqual({ category: 'Compute' });
  });

  it('setFilters merges with existing filters', () => {
    const { setFilters } = useAppStore.getState();
    setFilters({ category: 'Compute' });
    setFilters({ os: 'Linux' });
    expect(useAppStore.getState().filters).toEqual({
      category: 'Compute',
      os: 'Linux',
    });
  });

  it('setFilters overwrites existing filter key', () => {
    const { setFilters } = useAppStore.getState();
    setFilters({ category: 'Compute' });
    setFilters({ category: 'Storage' });
    expect(useAppStore.getState().filters.category).toBe('Storage');
  });

  it('removeFilter removes a specific filter key', () => {
    const { setFilters, removeFilter } = useAppStore.getState();
    setFilters({ category: 'Compute', os: 'Linux', search: 'vm' });
    removeFilter('os');
    expect(useAppStore.getState().filters).toEqual({
      category: 'Compute',
      search: 'vm',
    });
  });

  it('removeFilter is safe for non-existent key', () => {
    const { removeFilter } = useAppStore.getState();
    removeFilter('category' as keyof typeof useAppStore.getState.filters);
    expect(useAppStore.getState().filters).toEqual({});
  });

  it('clearFilters resets all filters', () => {
    const { setFilters, clearFilters } = useAppStore.getState();
    setFilters({ category: 'Compute', os: 'Linux' });
    clearFilters();
    expect(useAppStore.getState().filters).toEqual({});
    expect(useAppStore.getState().sortBy).toBe('newest');
  });

  it('setSortBy updates sort option', () => {
    const { setSortBy } = useAppStore.getState();
    setSortBy('name');
    expect(useAppStore.getState().sortBy).toBe('name');
    setSortBy('category');
    expect(useAppStore.getState().sortBy).toBe('category');
    setSortBy('newest');
    expect(useAppStore.getState().sortBy).toBe('newest');
  });

  it('filters persist sortBy independently', () => {
    const { setFilters, setSortBy, clearFilters } = useAppStore.getState();
    setSortBy('name');
    setFilters({ category: 'Compute' });
    clearFilters();
    expect(useAppStore.getState().sortBy).toBe('name');
    expect(useAppStore.getState().filters).toEqual({});
  });
});
