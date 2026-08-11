export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum DependencyType {
  REQUIRED = 'REQUIRED',
  RECOMMENDED = 'RECOMMENDED',
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categoryId: string;
  category: Category;
  flavors: Flavor[];
  dependencies: Dependency[];
  dependentProducts: Dependency[];
  documentation: string | null;
  roadmap: string | null;
  os: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Flavor {
  id: string;
  name: string;
  vcpu: number;
  ramGb: number;
  description: string | null;
  productId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Dependency {
  id: string;
  productId: string;
  product: Product;
  dependsOnId: string;
  dependsOn: Product;
  type: DependencyType;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Forecast {
  id: string;
  productId: string;
  product: Product;
  flavorId: string;
  flavor: Flavor;
  requestedBy: string;
  requesterEmail: string;
  quantity: number;
  status: ApprovalStatus;
  justification: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  requestedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'USER';
  createdAt: string;
  updatedAt: string;
}

export interface ProductFilters {
  category?: string;
  os?: string;
  flavor?: string;
  search?: string;
}

export interface ForecastStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export interface AdminDashboard {
  counts: {
    products: number;
    categories: number;
    forecasts: number;
    users: number;
  };
  recentForecasts: Forecast[];
}
