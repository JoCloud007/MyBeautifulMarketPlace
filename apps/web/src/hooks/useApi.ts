import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToastStore } from '@/stores/useToastStore';
import type { Product, Category, Forecast, ForecastStats, Flavor, Dependency, User, AvailabilityZone, Zone, Application, ContinuityLevel, OperatingSystem, OsVersion, ProductVariant, UpgradePath, ForecastTrend, ResourceByZone, ProductDemand, Instance, InstanceStatus, HealthCheck, HealthStatus, MaintenanceWindow, MaintenanceStatus, ApplicationCompliance, TopologyData, MaintenanceAlert, MaintenanceRecommendation, MaintenanceImpact, OrchestratorStats } from '@cloudmarket/shared-types';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

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
    console.error('API Error:', message);
    if (error.response?.data?.details) {
      console.error('Validation details:', JSON.stringify(error.response.data.details, null, 2));
    }
    return Promise.reject(error);
  }
);

// Native fetch helper (replaces Axios for GET queries — fixes headless-browser loading issues)
async function fetchJson<T>(url: string, params?: Record<string, any>): Promise<T> {
  let fullUrl = `${API_URL}/api${url}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) searchParams.append(k, String(v));
    });
    if (searchParams.toString()) fullUrl += '?' + searchParams.toString();
  }
  const res = await fetch(fullUrl);
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    if (contentType.includes('application/json')) {
      try {
        const body = await res.json();
        message = body?.error || body?.message || message;
      } catch { /* ignore parse errors */ }
    } else {
      try {
        const text = await res.text();
        if (text) message = text.slice(0, 200);
      } catch { /* ignore */ }
    }
    throw new Error(message);
  }
  if (!contentType.includes('application/json')) {
    throw new Error(`Expected JSON response but received ${contentType || 'unknown content type'}`);
  }
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
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
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
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      addToast('Product updated', 'success');
    },
    onError: (err: any) => {
      console.error('Update product error:', err);
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
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
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

export function useFlavors() {
  return useQuery<Flavor[]>({
    queryKey: ['flavors'],
    queryFn: () => fetchJson('/flavors'),
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
      queryClient.invalidateQueries({ queryKey: ['forecast-trends'] });
      queryClient.invalidateQueries({ queryKey: ['resources-by-zone'] });
      queryClient.invalidateQueries({ queryKey: ['demand-heatmap'] });
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
      queryClient.invalidateQueries({ queryKey: ['forecast-trends'] });
      queryClient.invalidateQueries({ queryKey: ['resources-by-zone'] });
      queryClient.invalidateQueries({ queryKey: ['demand-heatmap'] });
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
      queryClient.invalidateQueries({ queryKey: ['forecast-trends'] });
      queryClient.invalidateQueries({ queryKey: ['resources-by-zone'] });
      queryClient.invalidateQueries({ queryKey: ['demand-heatmap'] });
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

// ========== AVAILABILITY ZONES ==========

export function useAvailabilityZones() {
  return useQuery<AvailabilityZone[]>({
    queryKey: ['availability-zones'],
    queryFn: () => fetchJson('/availability-zones'),
    retry: 3,
    retryDelay: 2000,
  });
}

export function useCreateAvailabilityZone() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (payload: Partial<AvailabilityZone>) => {
      const { data } = await api.post('/availability-zones', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-zones'] });
      addToast('Availability zone created successfully', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Error during creation';
      addToast(msg, 'error');
    },
  });
}

export function useUpdateAvailabilityZone() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<AvailabilityZone>) => {
      const { data } = await api.patch(`/availability-zones/${id}`, payload);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['availability-zones'], (old: AvailabilityZone[] | undefined) =>
        old?.map((az) => (az.id === variables.id ? data : az)) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ['availability-zones'] });
      addToast('Availability zone updated', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Error during update';
      addToast(msg, 'error');
    },
  });
}

export function useDeleteAvailabilityZone() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/availability-zones/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData(['availability-zones'], (old: AvailabilityZone[] | undefined) =>
        old?.filter((az) => az.id !== id) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ['availability-zones'] });
      addToast('Availability zone deleted', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Unable to delete this availability zone';
      addToast(msg, 'error');
    },
  });
}

// ========== ZONES ==========

export function useZones() {
  return useQuery<Zone[]>({
    queryKey: ['zones'],
    queryFn: () => fetchJson('/zones'),
    retry: 3,
    retryDelay: 2000,
  });
}

export function useCreateZone() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (payload: Partial<Zone>) => {
      const { data } = await api.post('/zones', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      addToast('Zone created successfully', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Error during creation';
      addToast(msg, 'error');
    },
  });
}

export function useUpdateZone() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<Zone>) => {
      const { data } = await api.put(`/zones/${id}`, payload);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['zones'], (old: Zone[] | undefined) =>
        old?.map((z) => (z.id === variables.id ? data : z)) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      addToast('Zone updated', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Error during update';
      addToast(msg, 'error');
    },
  });
}

export function useDeleteZone() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/zones/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData(['zones'], (old: Zone[] | undefined) =>
        old?.filter((z) => z.id !== id) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      addToast('Zone deleted', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Unable to delete this zone';
      addToast(msg, 'error');
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

// ========== APPLICATIONS ==========

export function useApplications() {
  return useQuery<Application[]>({
    queryKey: ['applications'],
    queryFn: () => fetchJson('/applications'),
    retry: 3,
    retryDelay: 2000,
  });
}

export function useApplication(id: string, options?: { enabled?: boolean }) {
  return useQuery<Application>({
    queryKey: ['application', id],
    queryFn: () => fetchJson(`/applications/${id}`),
    enabled: options?.enabled !== undefined ? options.enabled : !!id,
    retry: 3,
    retryDelay: 2000,
  });
}

export function useCreateApplication() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (payload: Partial<Application>) => {
      const { data } = await api.post('/applications', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      addToast('Application created successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Error during creation', 'error');
    },
  });
}

export function useUpdateApplication() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<Application>) => {
      const { data } = await api.patch(`/applications/${id}`, payload);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['applications'], (old: Application[] | undefined) =>
        old?.map((a) => (a.id === variables.id ? data : a)) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      addToast('Application updated', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Error during update', 'error');
    },
  });
}

export function useDeleteApplication() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/applications/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData(['applications'], (old: Application[] | undefined) =>
        old?.filter((a) => a.id !== id) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      addToast('Application deleted', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Unable to delete this application', 'error');
    },
  });
}

// ========== CONTINUITY LEVELS ==========

export function useContinuityLevels() {
  return useQuery<ContinuityLevel[]>({
    queryKey: ['continuity-levels'],
    queryFn: () => fetchJson('/continuity-levels'),
    retry: 3,
    retryDelay: 2000,
  });
}

export function useUpdateContinuityLevel() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<ContinuityLevel>) => {
      const { data } = await api.patch(`/continuity-levels/${id}`, payload);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['continuity-levels'], (old: ContinuityLevel[] | undefined) =>
        old?.map((cl) => (cl.id === variables.id ? data : cl)) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ['continuity-levels'] });
      addToast('Continuity level updated', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Error during update', 'error');
    },
  });
}

// ========== OPERATING SYSTEMS ==========

export function useOperatingSystems() {
  return useQuery<OperatingSystem[]>({
    queryKey: ['operating-systems'],
    queryFn: () => fetchJson('/os'),
    retry: 3,
    retryDelay: 2000,
  });
}

export function useOperatingSystem(id: string) {
  return useQuery<OperatingSystem>({
    queryKey: ['operating-system', id],
    queryFn: () => fetchJson(`/os/${id}`),
    enabled: !!id,
    retry: 3,
    retryDelay: 2000,
  });
}

export function useCreateOS() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (payload: Partial<OperatingSystem>) => {
      const { data } = await api.post('/os', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operating-systems'] });
      addToast('OS created successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Error during creation', 'error');
    },
  });
}

export function useUpdateOS() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<OperatingSystem>) => {
      const { data } = await api.put(`/os/${id}`, payload);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['operating-systems'], (old: OperatingSystem[] | undefined) =>
        old?.map((o) => (o.id === variables.id ? data : o)) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ['operating-systems'] });
      addToast('OS updated', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Error during update', 'error');
    },
  });
}

export function useDeleteOS() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/os/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData(['operating-systems'], (old: OperatingSystem[] | undefined) =>
        old?.filter((o) => o.id !== id) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ['operating-systems'] });
      addToast('OS deleted', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Unable to delete this OS', 'error');
    },
  });
}

// ========== OS VERSIONS ==========

export function useOSVersions(osId: string) {
  return useQuery<OsVersion[]>({
    queryKey: ['os-versions', osId],
    queryFn: () => fetchJson(`/os/${osId}/versions`),
    enabled: !!osId,
    retry: 3,
    retryDelay: 2000,
  });
}

export function useCreateOSVersion() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async ({ osId, ...payload }: { osId: string } & Partial<OsVersion>) => {
      const { data } = await api.post(`/os/${osId}/versions`, payload);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['os-versions', variables.osId] });
      queryClient.invalidateQueries({ queryKey: ['operating-systems'] });
      addToast('Version created successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Error during creation', 'error');
    },
  });
}

export function useUpdateOSVersion() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async ({ osId, versionId, ...payload }: { osId: string; versionId: string } & Partial<OsVersion>) => {
      const { data } = await api.put(`/os/${osId}/versions/${versionId}`, payload);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['os-versions', variables.osId] });
      queryClient.invalidateQueries({ queryKey: ['operating-systems'] });
      addToast('Version updated', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Error during update', 'error');
    },
  });
}

export function useDeleteOSVersion() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async ({ osId, versionId }: { osId: string; versionId: string }) => {
      await api.delete(`/os/${osId}/versions/${versionId}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['os-versions', variables.osId] });
      queryClient.invalidateQueries({ queryKey: ['operating-systems'] });
      addToast('Version deleted', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Unable to delete this version', 'error');
    },
  });
}

// ========== PRODUCT VARIANTS ==========

export function useProductVariants(productId: string) {
  return useQuery<ProductVariant[]>({
    queryKey: ['product-variants', productId],
    queryFn: () => fetchJson(`/products/${productId}/variants`),
    enabled: !!productId,
    retry: 3,
    retryDelay: 2000,
  });
}

export function useCreateVariant() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async ({ productId, ...payload }: { productId: string } & Partial<ProductVariant>) => {
      const { data } = await api.post(`/products/${productId}/variants`, payload);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product-variants', variables.productId] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      addToast('Variant created successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Error during creation', 'error');
    },
  });
}

export function useUpdateVariant() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<ProductVariant>) => {
      const { data } = await api.put(`/variants/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variants'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      addToast('Variant updated', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Error during update', 'error');
    },
  });
}

export function useDeleteVariant() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/variants/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variants'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      addToast('Variant deleted', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Unable to delete this variant', 'error');
    },
  });
}

// ========== UPGRADE PATHS ==========

export function useUpgradePaths(productId: string) {
  return useQuery<UpgradePath[]>({
    queryKey: ['upgrade-paths', productId],
    queryFn: () => fetchJson(`/products/${productId}/upgrade-paths`),
    enabled: !!productId,
    retry: 3,
    retryDelay: 2000,
  });
}

export function useCreateUpgradePath() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async ({ productId, ...payload }: { productId: string } & Partial<UpgradePath>) => {
      const { data } = await api.post(`/products/${productId}/upgrade-paths`, payload);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['upgrade-paths', variables.productId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      addToast('Upgrade path created successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Error during creation', 'error');
    },
  });
}

export function useDeleteUpgradePath() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async ({ productId, pathId }: { productId: string; pathId: string }) => {
      await api.delete(`/products/${productId}/upgrade-paths/${pathId}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['upgrade-paths', variables.productId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      addToast('Upgrade path deleted', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Unable to delete this upgrade path', 'error');
    },
  });
}

// ========== FORECAST ANALYTICS ==========

export function useForecastTrends(days: number = 30) {
  return useQuery<ForecastTrend[]>({
    queryKey: ['forecast-trends', days],
    queryFn: () => fetchJson('/forecasts/trends', { days: String(days) }),
    retry: 3,
    retryDelay: 2000,
  });
}

export function useResourcesByZone() {
  return useQuery<ResourceByZone[]>({
    queryKey: ['resources-by-zone'],
    queryFn: () => fetchJson('/forecasts/resources-by-zone'),
    retry: 3,
    retryDelay: 2000,
  });
}

export function useDemandHeatmap() {
  return useQuery<ProductDemand[]>({
    queryKey: ['demand-heatmap'],
    queryFn: () => fetchJson('/forecasts/demand-heatmap'),
    retry: 3,
    retryDelay: 2000,
  });
}

// ========== INSTANCES ==========

export function useInstances(filters?: { applicationId?: string; productId?: string; status?: InstanceStatus; environment?: string }) {
  return useQuery<Instance[]>({
    queryKey: ['instances', filters],
    queryFn: () => fetchJson('/instances', filters),
    retry: 3,
    retryDelay: 2000,
  });
}

export function useInstance(id: string) {
  return useQuery<Instance>({
    queryKey: ['instance', id],
    queryFn: () => fetchJson(`/instances/${id}`),
    enabled: !!id,
    retry: 3,
    retryDelay: 2000,
  });
}

export function useCreateInstance() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (payload: Partial<Instance>) => {
      const { data } = await api.post('/instances', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] });
      queryClient.invalidateQueries({ queryKey: ['instance-stats'] });
      addToast('Instance created successfully', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Error during creation';
      addToast(msg, 'error');
    },
  });
}

export function useUpdateInstance() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<Instance>) => {
      const { data } = await api.patch(`/instances/${id}`, payload);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['instances'], (old: Instance[] | undefined) =>
        old?.map((i) => (i.id === variables.id ? data : i)) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ['instances'] });
      queryClient.invalidateQueries({ queryKey: ['instance-stats'] });
      addToast('Instance updated', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Error during update';
      addToast(msg, 'error');
    },
  });
}

export function useDeleteInstance() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/instances/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData(['instances'], (old: Instance[] | undefined) =>
        old?.filter((i) => i.id !== id) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ['instances'] });
      queryClient.invalidateQueries({ queryKey: ['instance-stats'] });
      addToast('Instance deleted', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Unable to delete this instance';
      addToast(msg, 'error');
    },
  });
}

export function useInstanceStats() {
  return useQuery<{
    total: number;
    pending: number;
    provisioning: number;
    running: number;
    stopped: number;
    terminated: number;
  }>({
    queryKey: ['instance-stats'],
    queryFn: () => fetchJson('/instances/stats'),
    retry: 3,
    retryDelay: 2000,
  });
}

// ========== HEALTH CHECKS ==========

export function useHealthChecks(filters?: { instanceId?: string; status?: HealthStatus }) {
  return useQuery<HealthCheck[]>({
    queryKey: ['health-checks', filters],
    queryFn: () => fetchJson('/health-checks', filters),
    retry: 3,
    retryDelay: 2000,
  });
}

export function useHealthCheckStats() {
  return useQuery<{
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  }>({
    queryKey: ['health-check-stats'],
    queryFn: () => fetchJson('/health-checks/stats'),
    retry: 3,
    retryDelay: 2000,
  });
}

export function useCreateHealthCheck() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (payload: Partial<HealthCheck>) => {
      const { data } = await api.post('/health-checks', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health-checks'] });
      queryClient.invalidateQueries({ queryKey: ['health-check-stats'] });
      addToast('Health check recorded', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Error during creation';
      addToast(msg, 'error');
    },
  });
}

export function useUpdateHealthCheck() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<HealthCheck>) => {
      const { data } = await api.patch(`/health-checks/${id}`, payload);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['health-checks'], (old: HealthCheck[] | undefined) =>
        old?.map((h) => (h.id === variables.id ? data : h)) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ['health-checks'] });
      queryClient.invalidateQueries({ queryKey: ['health-check-stats'] });
      addToast('Health check updated', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Error during update';
      addToast(msg, 'error');
    },
  });
}

export function useDeleteHealthCheck() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/health-checks/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData(['health-checks'], (old: HealthCheck[] | undefined) =>
        old?.filter((h) => h.id !== id) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ['health-checks'] });
      queryClient.invalidateQueries({ queryKey: ['health-check-stats'] });
      addToast('Health check deleted', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Unable to delete this health check';
      addToast(msg, 'error');
    },
  });
}

// ========== MAINTENANCE WINDOWS ==========

export function useMaintenanceWindows(filters?: { instanceId?: string; applicationId?: string; status?: MaintenanceStatus }) {
  return useQuery<MaintenanceWindow[]>({
    queryKey: ['maintenance-windows', filters],
    queryFn: () => fetchJson('/maintenance-windows', filters),
    retry: 3,
    retryDelay: 2000,
  });
}

export function useMaintenanceWindowStats() {
  return useQuery<{
    total: number;
    scheduled: number;
    inProgress: number;
    completed: number;
    cancelled: number;
  }>({
    queryKey: ['maintenance-window-stats'],
    queryFn: () => fetchJson('/maintenance-windows/stats'),
    retry: 3,
    retryDelay: 2000,
  });
}

export function useCreateMaintenanceWindow() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (payload: Partial<MaintenanceWindow>) => {
      const { data } = await api.post('/maintenance-windows', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-windows'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-window-stats'] });
      addToast('Maintenance window created', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Error during creation';
      addToast(msg, 'error');
    },
  });
}

export function useUpdateMaintenanceWindow() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<MaintenanceWindow>) => {
      const { data } = await api.patch(`/maintenance-windows/${id}`, payload);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['maintenance-windows'], (old: MaintenanceWindow[] | undefined) =>
        old?.map((w) => (w.id === variables.id ? data : w)) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ['maintenance-windows'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-window-stats'] });
      addToast('Maintenance window updated', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Error during update';
      addToast(msg, 'error');
    },
  });
}

export function useDeleteMaintenanceWindow() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/maintenance-windows/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData(['maintenance-windows'], (old: MaintenanceWindow[] | undefined) =>
        old?.filter((w) => w.id !== id) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ['maintenance-windows'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-window-stats'] });
      addToast('Maintenance window deleted', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Unable to delete this maintenance window';
      addToast(msg, 'error');
    },
  });
}

// ========== COMPLIANCE ==========

export function useCompliance() {
  return useQuery<ApplicationCompliance[]>({
    queryKey: ['compliance'],
    queryFn: () => fetchJson('/compliance'),
    retry: 3,
    retryDelay: 2000,
  });
}

// ========== TOPOLOGY ==========

export function useTopology() {
  return useQuery<TopologyData>({
    queryKey: ['topology'],
    queryFn: () => fetchJson('/topology'),
    retry: 3,
    retryDelay: 2000,
  });
}

// ========== MAINTENANCE ORCHESTRATOR ==========

export function useMaintenanceAlerts() {
  return useQuery<MaintenanceAlert[]>({
    queryKey: ['maintenance-alerts'],
    queryFn: () => fetchJson('/maintenance-orchestrator/alerts'),
    retry: 3,
    retryDelay: 2000,
  });
}

export function useMaintenanceSchedule() {
  return useQuery<MaintenanceRecommendation[]>({
    queryKey: ['maintenance-schedule'],
    queryFn: () => fetchJson('/maintenance-orchestrator/schedule'),
    retry: 3,
    retryDelay: 2000,
  });
}

export function useMaintenanceImpact() {
  return useMutation<MaintenanceImpact, Error, { applicationId: string; startTime: string; endTime: string; affectedInstanceIds?: string[] }>({
    mutationFn: async (payload) => {
      const { data } = await api.post('/maintenance-orchestrator/impact', payload);
      return data;
    },
  });
}

export function useOrchestratorStats() {
  return useQuery<OrchestratorStats>({
    queryKey: ['orchestrator-stats'],
    queryFn: () => fetchJson('/maintenance-orchestrator/stats'),
    retry: 3,
    retryDelay: 2000,
  });
}


export function useCreateOperatingSystem() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (payload: Partial<OperatingSystem>) => {
      const { data } = await api.post('/os', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operating-systems'] });
      addToast('OS created successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Error creating OS', 'error');
    },
  });
}

export function useUpdateOperatingSystem() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<OperatingSystem>) => {
      const { data } = await api.put(`/os/${id}`, payload);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['operating-systems'], (old: OperatingSystem[] | undefined) =>
        old?.map((o) => (o.id === variables.id ? data : o)) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ['operating-systems'] });
      queryClient.invalidateQueries({ queryKey: ['operating-system', variables.id] });
      addToast('OS updated', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Error updating OS', 'error');
    },
  });
}

export function useDeleteOperatingSystem() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/os/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operating-systems'] });
      addToast('OS deleted', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Unable to delete this OS', 'error');
    },
  });
}

// ========== OS VERSIONS ==========

export function useOsVersions(osId?: string) {
  return useQuery<OsVersion[]>({
    queryKey: ['os-versions', osId],
    queryFn: () => fetchJson(`/os/${osId}/versions`),
    enabled: !!osId,
    retry: 3,
    retryDelay: 2000,
  });
}

export function useCreateOsVersion() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async ({ osId, ...payload }: { osId: string } & Partial<OsVersion>) => {
      const { data } = await api.post(`/os/${osId}/versions`, payload);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['os-versions', variables.osId] });
      queryClient.invalidateQueries({ queryKey: ['operating-system', variables.osId] });
      queryClient.invalidateQueries({ queryKey: ['operating-systems'] });
      addToast('Version created successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Error creating version', 'error');
    },
  });
}

export function useUpdateOsVersion() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async ({ osId, versionId, ...payload }: { osId: string; versionId: string } & Partial<OsVersion>) => {
      const { data } = await api.put(`/os/${osId}/versions/${versionId}`, payload);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['os-versions', variables.osId] });
      queryClient.invalidateQueries({ queryKey: ['operating-system', variables.osId] });
      queryClient.invalidateQueries({ queryKey: ['operating-systems'] });
      addToast('Version updated', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Error updating version', 'error');
    },
  });
}

export function useDeleteOsVersion() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async ({ osId, versionId }: { osId: string; versionId: string }) => {
      await api.delete(`/os/${osId}/versions/${versionId}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['os-versions', variables.osId] });
      queryClient.invalidateQueries({ queryKey: ['operating-system', variables.osId] });
      queryClient.invalidateQueries({ queryKey: ['operating-systems'] });
      addToast('Version deleted', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Unable to delete this version', 'error');
    },
  });
}


export function useCreateProductVariant() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async ({ productId, ...payload }: { productId: string } & Partial<ProductVariant>) => {
      const { data } = await api.post(`/products/${productId}/variants`, payload);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product-variants', variables.productId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['product', variables.productId] });
      addToast('Variant created successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Error creating variant', 'error');
    },
  });
}

export function useUpdateProductVariant() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<ProductVariant>) => {
      const { data } = await api.put(`/variants/${id}`, payload);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['product-variants'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['variant', data.id] });
      addToast('Variant updated', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Error updating variant', 'error');
    },
  });
}

export function useDeleteProductVariant() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/variants/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variants'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      addToast('Variant deleted', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Unable to delete this variant', 'error');
    },
  });
}

export { api };
