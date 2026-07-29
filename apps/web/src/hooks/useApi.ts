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
    const message = error.response?.data?.error || error.response?.data?.message || error.message || 'Erreur réseau';
    // Don't toast on 404s for normal queries — handled per-query
    if (error.response?.status !== 404) {
      console.error('API Error:', message);
    }
    return Promise.reject(error);
  }
);

// ========== PRODUCTS ==========

export function useProducts(filters?: { category?: string; os?: string; search?: string }) {
  return useQuery<Product[]>({
    queryKey: ['products', filters],
    queryFn: async () => {
      const { data } = await api.get('/products', { params: filters });
      return data;
    },
  });
}

export function useProduct(slug: string) {
  return useQuery<Product>({
    queryKey: ['product', slug],
    queryFn: async () => {
      const { data } = await api.get(`/products/${slug}`);
      return data;
    },
    enabled: !!slug,
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
      addToast('Produit créé avec succès', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Erreur lors de la création du produit', 'error');
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      addToast('Produit mis à jour', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Erreur lors de la mise à jour', 'error');
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      addToast('Produit supprimé', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Impossible de supprimer ce produit', 'error');
    },
  });
}

// ========== CATEGORIES ==========

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get('/categories');
      return data;
    },
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
      addToast('Catégorie créée avec succès', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Erreur lors de la création', 'error');
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      addToast('Catégorie mise à jour', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Erreur lors de la mise à jour', 'error');
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      addToast('Catégorie supprimée', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Impossible de supprimer cette catégorie', 'error');
    },
  });
}

// ========== FLAVORS ==========

export function useFlavors(productId?: string) {
  return useQuery<Flavor[]>({
    queryKey: ['flavors', productId],
    queryFn: async () => {
      const { data } = await api.get('/flavors', { params: productId ? { productId } : undefined });
      return data;
    },
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
      addToast('Flavor créé avec succès', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Erreur lors de la création', 'error');
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
      addToast('Flavor mis à jour', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Erreur lors de la mise à jour', 'error');
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
      addToast('Flavor supprimé', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Impossible de supprimer ce flavor', 'error');
    },
  });
}

// ========== DEPENDENCIES ==========

export function useDependencies() {
  return useQuery<Dependency[]>({
    queryKey: ['dependencies'],
    queryFn: async () => {
      const { data } = await api.get('/dependencies');
      return data;
    },
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
      addToast('Dépendance créée avec succès', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Erreur lors de la création', 'error');
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
      addToast('Dépendance mise à jour', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Erreur lors de la mise à jour', 'error');
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
      addToast('Dépendance supprimée', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Impossible de supprimer cette dépendance', 'error');
    },
  });
}

// ========== FORECASTS ==========

export function useForecasts() {
  return useQuery<Forecast[]>({
    queryKey: ['forecasts'],
    queryFn: async () => {
      const { data } = await api.get('/forecasts');
      return data;
    },
  });
}

export function useForecastStats() {
  return useQuery<ForecastStats>({
    queryKey: ['forecast-stats'],
    queryFn: async () => {
      const { data } = await api.get('/forecasts/stats');
      return data;
    },
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
      addToast('Demande de forecast créée', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Erreur lors de la création', 'error');
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
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['forecasts'] });
      queryClient.invalidateQueries({ queryKey: ['forecast-stats'] });
      const status = (variables as any).status;
      if (status === 'APPROVED') addToast('Demande approuvée', 'success');
      else if (status === 'REJECTED') addToast('Demande rejetée', 'warning');
      else addToast('Demande mise à jour', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Erreur lors de la mise à jour', 'error');
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forecasts'] });
      queryClient.invalidateQueries({ queryKey: ['forecast-stats'] });
      addToast('Demande supprimée', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Impossible de supprimer cette demande', 'error');
    },
  });
}

// ========== USERS ==========

export function useUsers() {
  return useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get('/users');
      return data;
    },
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
      addToast('Utilisateur créé avec succès', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Erreur lors de la création', 'error');
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      addToast('Utilisateur mis à jour', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Erreur lors de la mise à jour', 'error');
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      addToast('Utilisateur supprimé', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Impossible de supprimer cet utilisateur', 'error');
    },
  });
}

// ========== ADMIN ==========

export function useAdminDashboard() {
  return useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/admin/dashboard');
      return data;
    },
  });
}

export function useAdminProducts() {
  return useQuery<Product[]>({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const { data } = await api.get('/admin/products');
      return data;
    },
  });
}

export function useAdminForecasts() {
  return useQuery<Forecast[]>({
    queryKey: ['admin-forecasts'],
    queryFn: async () => {
      const { data } = await api.get('/admin/forecasts');
      return data;
    },
  });
}

export function useAdminCategories() {
  return useQuery<Category[]>({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data } = await api.get('/admin/categories');
      return data;
    },
  });
}

export function useAdminFlavors() {
  return useQuery<Flavor[]>({
    queryKey: ['admin-flavors'],
    queryFn: async () => {
      const { data } = await api.get('/admin/flavors');
      return data;
    },
  });
}

export function useAdminDependencies() {
  return useQuery<Dependency[]>({
    queryKey: ['admin-dependencies'],
    queryFn: async () => {
      const { data } = await api.get('/admin/dependencies');
      return data;
    },
  });
}

export function useAdminUsers() {
  return useQuery<User[]>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data } = await api.get('/admin/users');
      return data;
    },
  });
}

export { api };
