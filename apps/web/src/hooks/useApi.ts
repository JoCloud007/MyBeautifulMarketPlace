import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToastStore } from '@/stores/useToastStore';
import type { Product, Category, Forecast, ForecastStats, Flavor, Dependency, User } from '@cloudmarket/shared-types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Global API error handler
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.response?.data?.message || error.message || 'Network error';
    // Don't toast on 404s for normal queries — handled per-query
    if (error.response?.status !== 404) {
      console.error('API Error:', message);
      if (error.response?.data?.details) {
        console.error('Validation details:', JSON.stringify(error.response.data.details, null, 2));
      }
    }
    return Promise.reject(error);
  }
);

// Native fetch helper (replaces Axios for GET queries — fixes headless-browser loading issues)
async function fetchJson<T>(url: string, params?: Record<string, any>): Promise<T> {
  let fullUrl = `/api${url}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) searchParams.append(k, String(v));
    });
    if (searchParams.toString()) fullUrl += '?' + searchParams.toString();
  }
  const res = await fetch(fullUrl);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ========== PRODUCTS ==========

export function useProducts(filters?: { category?: string; os?: string; search?: string }) {
  return useQuery<Product[]>({
    queryKey: ['products', filters],
    queryFn: () => fetchJson('/products', filters),
    retry: 3,
    retryDelay: 2000,
  });
}

export function useProduct(slug: string) {
  return useQuery<Product>({
    queryKey: ['product', slug],
    queryFn: () => fetchJson(`/products/${slug}`),
    enabled: !!slug,
    retry: 3,
    retryDelay: 2000,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (payload: Partial<Product>) => {
      const { data } = await api.post('/products', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      addToast('Product created successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Error creating product', 'error');
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<Product>) => {
      const { data } = await api.patch(`/products/${id}`, payload);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['products'], (old: Product[] | undefined) =>
        old?.map((p) => (p.id === variables.id ? data : p)) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ['products'] });
      addToast('Product updated', 'success');
    },
    onError: (err: any) => {
      console.error('Update forecast error:', err);
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Error during update';
      addToast(msg, 'error');
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/products/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData(['products'], (old: Product[] | undefined) =>
        old?.filter((p) => p.id !== id) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ['products'] });
      addToast('Product deleted', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Unable to delete this product', 'error');
    },
  });
}

// ========== CATEGORIES ==========

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => fetchJson('/categories'),
    retry: 3,
    retryDelay: 2000,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (payload: Partial<Category>) => {
      const { data } = await api.post('/categories', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      addToast('Category created successfully', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Error during creation';
      addToast(msg, 'error');
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<Category>) => {
      const { data } = await api.patch(`/categories/${id}`, payload);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['categories'], (old: Category[] | undefined) =>
        old?.map((c) => (c.id === variables.id ? data : c)) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      addToast('Category updated', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Error during update', 'error');
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/categories/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData(['categories'], (old: Category[] | undefined) =>
        old?.filter((c) => c.id !== id) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      addToast('Category deleted', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Unable to delete this category', 'error');
    },
  });
}

// ========== FLAVORS ==========

export function useFlavors(productId?: string) {
  return useQuery<Flavor[]>({
    queryKey: ['flavors', productId],
    queryFn: () => fetchJson('/flavors', productId ? { productId } : undefined),
    retry: 3,
    retryDelay: 2000,
  });
}

export function useCreateFlavor() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (payload: Partial<Flavor>) => {
      const { data } = await api.post('/flavors', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flavors'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      addToast('Flavor created successfully', 'success');
    },
    onError: (err: any) => {
      console.error('Create forecast error:', err);
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Error during creation';
      addToast(msg, 'error');
    },
  });
}

export function useUpdateFlavor() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<Flavor>) => {
      const { data } = await api.patch(`/flavors/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flavors'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      addToast('Flavor updated', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Error during update', 'error');
    },
  });
}

export function useDeleteFlavor() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/flavors/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flavors'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      addToast('Flavor deleted', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Unable to delete this flavor', 'error');
    },
  });
}

// ========== DEPENDENCIES ==========

export function useDependencies() {
  return useQuery<Dependency[]>({
    queryKey: ['dependencies'],
    queryFn: () => fetchJson('/dependencies'),
    retry: 3,
    retryDelay: 2000,
  });
}

export function useCreateDependency() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (payload: Partial<Dependency>) => {
      const { data } = await api.post('/dependencies', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dependencies'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      addToast('Dependency created successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Error during creation', 'error');
    },
  });
}

export function useUpdateDependency() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<Dependency>) => {
      const { data } = await api.patch(`/dependencies/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dependencies'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      addToast('Dependency updated', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Error during update', 'error');
    },
  });
}

export function useDeleteDependency() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/dependencies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dependencies'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      addToast('Dependency deleted', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Unable to delete this dependency', 'error');
    },
  });
}

// ========== FORECASTS ==========

export function useForecasts() {
  return useQuery<Forecast[]>({
    queryKey: ['forecasts'],
    queryFn: () => fetchJson('/forecasts'),
    retry: 3,
    retryDelay: 2000,
  });
}

export function useForecastStats() {
  return useQuery<ForecastStats>({
    queryKey: ['forecast-stats'],
    queryFn: () => fetchJson('/forecasts/stats'),
    retry: 3,
    retryDelay: 2000,
  });
}

export function useCreateForecast() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (payload: Partial<Forecast>) => {
      const { data } = await api.post('/forecasts', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forecasts'] });
      queryClient.invalidateQueries({ queryKey: ['forecast-stats'] });
      addToast('Forecast request created', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Error during creation', 'error');
    },
  });
}

export function useUpdateForecast() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<Forecast>) => {
      const { data } = await api.patch(`/forecasts/${id}`, payload);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['forecasts'], (old: Forecast[] | undefined) =>
        old?.map((f) => (f.id === variables.id ? data : f)) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ['forecasts'] });
      queryClient.invalidateQueries({ queryKey: ['forecast-stats'] });
      const status = (variables as any).status;
      if (status === 'APPROVED') addToast('Request approved', 'success');
      else if (status === 'REJECTED') addToast('Request rejected', 'warning');
      else addToast('Request updated', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Error during update', 'error');
    },
  });
}

export function useDeleteForecast() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/forecasts/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData(['forecasts'], (old: Forecast[] | undefined) =>
        old?.filter((f) => f.id !== id) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ['forecasts'] });
      queryClient.invalidateQueries({ queryKey: ['forecast-stats'] });
      addToast('Request deleted', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Unable to delete this request', 'error');
    },
  });
}

// ========== USERS ==========

export function useUsers() {
  return useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => fetchJson('/users'),
    retry: 3,
    retryDelay: 2000,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (payload: Partial<User>) => {
      const { data } = await api.post('/users', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      addToast('User created successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Error during creation', 'error');
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<User>) => {
      const { data } = await api.patch(`/users/${id}`, payload);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['users'], (old: User[] | undefined) =>
        old?.map((u) => (u.id === variables.id ? data : u)) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ['users'] });
      addToast('User updated', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Error during update', 'error');
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData(['users'], (old: User[] | undefined) =>
        old?.filter((u) => u.id !== id) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ['users'] });
      addToast('User deleted', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Unable to delete this user', 'error');
    },
  });
}

// ========== ADMIN ==========

export function useAdminDashboard() {
  return useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => fetchJson('/admin/dashboard'),
    retry: 3,
    retryDelay: 2000,
  });
}

export function useAdminProducts() {
  return useQuery<Product[]>({
    queryKey: ['admin-products'],
    queryFn: () => fetchJson('/admin/products'),
    retry: 3,
    retryDelay: 2000,
  });
}

export function useAdminForecasts() {
  return useQuery<Forecast[]>({
    queryKey: ['admin-forecasts'],
    queryFn: () => fetchJson('/admin/forecasts'),
    retry: 3,
    retryDelay: 2000,
  });
}

export function useAdminCategories() {
  return useQuery<Category[]>({
    queryKey: ['admin-categories'],
    queryFn: () => fetchJson('/admin/categories'),
    retry: 3,
    retryDelay: 2000,
  });
}

export function useAdminFlavors() {
  return useQuery<Flavor[]>({
    queryKey: ['admin-flavors'],
    queryFn: () => fetchJson('/admin/flavors'),
    retry: 3,
    retryDelay: 2000,
  });
}

export function useAdminDependencies() {
  return useQuery<Dependency[]>({
    queryKey: ['admin-dependencies'],
    queryFn: () => fetchJson('/admin/dependencies'),
    retry: 3,
    retryDelay: 2000,
  });
}

export function useAdminUsers() {
  return useQuery<User[]>({
    queryKey: ['admin-users'],
    queryFn: () => fetchJson('/admin/users'),
    retry: 3,
    retryDelay: 2000,
  });
}

export { api };
