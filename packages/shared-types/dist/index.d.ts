export declare enum ApprovalStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED"
}
export declare enum DependencyType {
    REQUIRED = "REQUIRED",
    RECOMMENDED = "RECOMMENDED"
}
export declare enum Environment {
    PRD = "PRD",
    DEV = "DEV",
    STG = "STG"
}
export declare enum ResiliencyLevel {
    STANDARD = "STANDARD",
    HA = "HA",
    MULTI_AZ = "MULTI_AZ"
}
export declare enum ComputeType {
    PHYSICAL = "PHYSICAL",
    VIRTUAL = "VIRTUAL"
}
export declare enum LifecyclePhase {
    RELEASED = "RELEASED",
    NORMAL_SUPPORT = "NORMAL_SUPPORT",
    EXTENDED_SUPPORT = "EXTENDED_SUPPORT",
    NO_SUPPORT = "NO_SUPPORT",
    EOL = "EOL"
}
export declare enum MigrationType {
    IN_PLACE = "IN_PLACE",
    REBUILD = "REBUILD",
    BLUE_GREEN = "BLUE_GREEN",
    SNAPSHOT = "SNAPSHOT"
}
export declare enum AvailabilityType {
    STANDARD = "STANDARD",
    RECOMMENDED = "RECOMMENDED",
    RESTRICTED = "RESTRICTED",
    ON_DEMAND = "ON_DEMAND"
}
export declare enum InstanceStatus {
    PENDING = "PENDING",
    PROVISIONING = "PROVISIONING",
    RUNNING = "RUNNING",
    STOPPED = "STOPPED",
    TERMINATED = "TERMINATED"
}
export declare enum HealthStatus {
    HEALTHY = "HEALTHY",
    DEGRADED = "DEGRADED",
    UNHEALTHY = "UNHEALTHY"
}
export declare enum MaintenanceStatus {
    SCHEDULED = "SCHEDULED",
    IN_PROGRESS = "IN_PROGRESS",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED"
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
export interface OperatingSystem {
    id: string;
    family: string;
    name: string;
    slug: string;
    isActive: boolean;
    availabilityType: AvailabilityType;
    versions: OsVersion[];
    zones: OperatingSystemZone[];
    createdAt: string;
    updatedAt: string;
}
export interface OsVersion {
    id: string;
    osId: string;
    os: OperatingSystem;
    version: string;
    releaseDate: string;
    normalSupportEnd: string;
    extendedSupportEnd: string;
    eolDate: string;
    phase: LifecyclePhase;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface ProductVariant {
    id: string;
    productId: string;
    product: Product;
    name: string;
    osId: string;
    os: OperatingSystem;
    osVersionId: string;
    osVersion: OsVersion;
    flavorId: string;
    flavor: Flavor;
    availabilityZones: ProductVariantAvailabilityZone[];
    zones: ProductVariantZone[];
    continuityLevelId: string | null;
    continuityLevel: ContinuityLevel | null;
    instances: Instance[];
    isActive: boolean;
    availabilityType: AvailabilityType;
    createdAt: string;
    updatedAt: string;
}
export interface ProductVariantAvailabilityZone {
    variantId: string;
    variant: ProductVariant;
    availabilityZoneId: string;
    availabilityZone: AvailabilityZone;
}
export interface Zone {
    id: string;
    name: string;
    slug: string;
    description?: string;
    isActive: boolean;
    availabilityZones: ZoneAvailabilityZone[];
    products: ProductZone[];
    flavors: FlavorZone[];
    operatingSystems: OperatingSystemZone[];
    createdAt: string;
    updatedAt: string;
}
export interface ZoneAvailabilityZone {
    zoneId: string;
    availabilityZoneId: string;
    availabilityZone: AvailabilityZone;
}
export interface ProductVariantZone {
    variantId: string;
    zoneId: string;
    zone: Zone;
}
export interface ProductZone {
    productId: string;
    zoneId: string;
    zone: Zone;
}
export interface FlavorZone {
    flavorId: string;
    zoneId: string;
    zone: Zone;
}
export interface OperatingSystemZone {
    operatingSystemId: string;
    zoneId: string;
    zone: Zone;
}
export interface UpgradePath {
    id: string;
    fromProductId: string;
    toProductId: string;
    fromVersion: string;
    toVersion: string;
    migrationType: MigrationType;
    notes: string | null;
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
    computeType: ComputeType | null;
    variants: ProductVariant[];
    dependencies: Dependency[];
    dependentProducts: Dependency[];
    upgradeFrom: UpgradePath[];
    upgradeTo: UpgradePath[];
    zones: ProductZone[];
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
    zones: FlavorZone[];
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
export interface ContinuityLevel {
    id: string;
    name: string;
    rtoMinutes: number;
    rpoMinutes: number;
    description: string | null;
    color: string;
    createdAt: string;
}
export interface Application {
    id: string;
    name: string;
    description: string | null;
    continuityLevelId: string;
    continuityLevel: ContinuityLevel;
    owner: string;
    createdAt: string;
    updatedAt: string;
}
export interface Instance {
    id: string;
    name: string;
    description: string | null;
    forecastId: string | null;
    forecast: Forecast | null;
    applicationId: string;
    application: Application;
    productId: string;
    product: Product;
    variantId: string | null;
    variant: ProductVariant | null;
    flavorId: string;
    flavor: Flavor;
    azCode: string;
    az: AvailabilityZone;
    status: InstanceStatus;
    environment: Environment;
    ipAddress: string | null;
    hostname: string | null;
    metadata: any;
    createdAt: string;
    updatedAt: string;
    startedAt: string | null;
    stoppedAt: string | null;
    terminatedAt: string | null;
}
export interface HealthCheck {
    id: string;
    instanceId: string;
    instance: Instance;
    status: HealthStatus;
    cpuPercent: number;
    memoryPercent: number;
    diskPercent: number;
    responseTimeMs: number;
    checkedAt: string;
    createdAt: string;
}
export interface MaintenanceWindow {
    id: string;
    instanceId: string | null;
    instance: Instance | null;
    applicationId: string | null;
    application: Application | null;
    title: string;
    description: string | null;
    startTime: string;
    endTime: string;
    status: MaintenanceStatus;
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
    resiliency: ResiliencyLevel;
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
    applicationId: string;
    application: Application;
    environment: Environment;
}
export interface User {
    id: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'USER';
    createdAt: string;
    updatedAt: string;
}
export interface AvailabilityZone {
    id: string;
    code: string;
    name: string;
    city: string;
    country: string;
    region: string;
    latitude: number;
    longitude: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface ProductFilters {
    category?: string;
    computeType?: string;
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
        availabilityZones: number;
        zones: number;
        applications: number;
        continuityLevels: number;
    };
    recentForecasts: Forecast[];
}
export interface ForecastTrend {
    date: string;
    created: number;
    approved: number;
}
export interface ResourceByZone {
    azCode: string;
    vcpu: number;
    ramGb: number;
}
export interface ProductDemand {
    productId: string;
    productName: string;
    azCode: string;
    count: number;
}
export type ComplianceSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
export type ComplianceCategory = 'INSTANCE_COUNT' | 'AZ_DISTRIBUTION' | 'RESILIENCY' | 'HEALTH' | 'ENVIRONMENT';
export type ComplianceStatus = 'COMPLIANT' | 'AT_RISK' | 'NON_COMPLIANT';
export interface ComplianceGap {
    id: string;
    applicationId: string;
    severity: ComplianceSeverity;
    category: ComplianceCategory;
    message: string;
    recommendation: string;
}
export interface ComplianceMetrics {
    totalInstances: number;
    runningInstances: number;
    uniqueAZs: number;
    maxResiliency: ResiliencyLevel | null;
    unhealthyInstances: number;
    degradedInstances: number;
    prdInstances: number;
}
export interface ApplicationCompliance {
    applicationId: string;
    applicationName: string;
    continuityLevel: ContinuityLevel;
    score: number;
    status: ComplianceStatus;
    gaps: ComplianceGap[];
    metrics: ComplianceMetrics;
}
export type TopologyNodeType = 'APPLICATION' | 'PRODUCT';
export interface TopologyNode {
    id: string;
    name: string;
    type: TopologyNodeType;
    category?: string;
    continuityLevel?: string;
    continuityColor?: string;
    instanceCount?: number;
}
export type TopologyEdgeType = 'INSTANCE' | 'DEPENDENCY' | 'RELATED';
export interface TopologyEdge {
    id: string;
    source: string;
    target: string;
    type: TopologyEdgeType;
    label?: string;
}
export interface TopologyData {
    nodes: TopologyNode[];
    edges: TopologyEdge[];
}
export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
export type AlertCategory = 'LIFECYCLE' | 'COMPLIANCE' | 'HEALTH' | 'SCHEDULING' | 'MAINTENANCE';
export interface MaintenanceAlert {
    id: string;
    severity: AlertSeverity;
    category: AlertCategory;
    title: string;
    message: string;
    affectedResource: {
        type: 'APPLICATION' | 'INSTANCE' | 'PRODUCT' | 'MAINTENANCE_WINDOW';
        id: string;
        name: string;
    };
    suggestedAction: string;
    createdAt: string;
    expiresAt?: string;
}
export interface MaintenanceRecommendation {
    id: string;
    priority: number;
    title: string;
    description: string;
    category: AlertCategory;
    affectedApplicationId: string;
    affectedApplicationName: string;
    suggestedWindow: {
        startTime: string;
        endTime: string;
        durationHours: number;
        reason: string;
    };
    rationale: string[];
    estimatedImpact: 'LOW' | 'MEDIUM' | 'HIGH';
}
export interface MaintenanceImpact {
    canProceed: boolean;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    affectedApplications: {
        applicationId: string;
        applicationName: string;
        continuityLevel: string;
        runningInstances: number;
        impact: string;
    }[];
    complianceImpact: {
        currentScore: number;
        projectedScore: number;
        gapsCreated: string[];
    };
    conflictingWindows: {
        id: string;
        title: string;
        startTime: string;
        endTime: string;
    }[];
    lifecycleWarnings: {
        productId: string;
        productName: string;
        phase: LifecyclePhase;
        warning: string;
    }[];
    recommendations: string[];
}
export interface OrchestratorStats {
    totalAlerts: number;
    criticalAlerts: number;
    warningAlerts: number;
    infoAlerts: number;
    recommendations: number;
    upcomingMaintenanceWindows: number;
    overdueWindows: number;
    lifecycleTransitions30Days: number;
    unhealthyInstances: number;
}
