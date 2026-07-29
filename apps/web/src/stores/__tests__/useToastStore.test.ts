import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useToastStore } from '@/stores/useToastStore';

describe('useToastStore', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with empty toasts', () => {
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it('addToast creates a toast with unique id', () => {
    const { addToast } = useToastStore.getState();
    addToast('Hello', 'info');
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Hello');
    expect(toasts[0].type).toBe('info');
    expect(toasts[0].id).toMatch(/^toast-/);
  });

  it('addToast supports all toast types', () => {
    const { addToast } = useToastStore.getState();
    addToast('Success', 'success');
    addToast('Error', 'error');
    addToast('Warning', 'warning');
    addToast('Info', 'info');
    const toasts = useToastStore.getState().toasts;
    expect(toasts.map(t => t.type)).toEqual(['success', 'error', 'warning', 'info']);
  });

  it('addToast assigns default duration of 4000ms', () => {
    const { addToast } = useToastStore.getState();
    addToast('Test', 'info');
    expect(useToastStore.getState().toasts[0].duration).toBe(4000);
  });

  it('addToast accepts custom duration', () => {
    const { addToast } = useToastStore.getState();
    addToast('Test', 'info', 8000);
    expect(useToastStore.getState().toasts[0].duration).toBe(8000);
  });

  it('auto-removes toast after duration', () => {
    const { addToast } = useToastStore.getState();
    addToast('Auto remove', 'info', 3000);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(3000);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('removeToast removes specific toast by id', () => {
    const { addToast, removeToast } = useToastStore.getState();
    addToast('A', 'info');
    addToast('B', 'error');
    const id = useToastStore.getState().toasts[0].id;
    removeToast(id);
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('B');
  });

  it('clearToasts removes all toasts', () => {
    const { addToast, clearToasts } = useToastStore.getState();
    addToast('A', 'info');
    addToast('B', 'error');
    clearToasts();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('generates unique ids for multiple toasts', () => {
    const { addToast } = useToastStore.getState();
    addToast('First', 'info');
    addToast('Second', 'info');
    const [t1, t2] = useToastStore.getState().toasts;
    expect(t1.id).not.toBe(t2.id);
  });
});
