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
  availabilityZones: ProductAvailabilityZone[];
  documentation: string | null;
  roadmap: string | null;
  os: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductAvailabilityZone {
  id: string;
  productId: string;
  availabilityZoneId: string;
  availabilityZone: any;
  code?: string;
  createdAt: string;
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

export interface ForecastLine {
  id: string;
  forecastId: string;
  productId: string;
  product: Product;
  flavorId: string;
  flavor: Flavor;
  azCode: string;
  quantity: number;
  metadata?: any;
}

export interface Forecast {
  id: string;
  requestedBy: string;
  requesterEmail: string;
  targetDate?: string;
  lines: ForecastLine[];
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
