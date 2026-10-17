export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'export';

export interface PermissionGroup {
  key: string;
  label: string;
  actions: PermissionAction[];
}

export interface PermissionSection {
  key: string;
  label: string;
  iconKey: string;
  groups: PermissionGroup[];
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Record<string, PermissionAction[]>;
  userCount: number;
  isSystem?: boolean;
  createdAt: string;
}

/**
 * Mirrors the admin sidebar structure: each section becomes a heading,
 * each item underneath becomes a permission group (tab).
 */
export const PERMISSION_SECTIONS: PermissionSection[] = [
  {
    key: 'main',
    label: 'Main',
    iconKey: 'main',
    groups: [
      { key: 'dashboard', label: 'Dashboard', actions: ['view'] },
      { key: 'pos', label: 'POS', actions: ['view', 'create', 'edit', 'delete', 'export'] },
      { key: 'pos_orders', label: 'POS Orders', actions: ['view', 'create', 'edit', 'delete', 'export'] },
    ],
  },
  {
    key: 'reports',
    label: 'Reports',
    iconKey: 'reports',
    groups: [
      { key: 'report_sales', label: 'Sales Reports', actions: ['view', 'export'] },
      { key: 'report_purchases', label: 'Purchase Reports', actions: ['view', 'export'] },
      { key: 'report_cost_analysis', label: 'Cost Analysis', actions: ['view', 'export'] },
      { key: 'report_stock', label: 'Stock', actions: ['view', 'export'] },
      { key: 'report_expenses', label: 'Expenses', actions: ['view', 'export'] },
      { key: 'report_vendor_payments', label: 'Vendor Payments', actions: ['view', 'export'] },
      { key: 'report_receivables', label: 'Receivables', actions: ['view', 'export'] },
      { key: 'report_cash_in_hand', label: 'Cash in Hand', actions: ['view', 'export'] },
    ],
  },
  {
    key: 'product_management',
    label: 'Product Management',
    iconKey: 'products',
    groups: [
      { key: 'products', label: 'Products', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'product_categories', label: 'Categories', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'product_attributes', label: 'Attributes', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'product_stock', label: 'Stock', actions: ['view', 'create', 'edit', 'delete'] },
    ],
  },
  {
    key: 'customer_management',
    label: 'Customer Management',
    iconKey: 'customers',
    groups: [
      { key: 'customers', label: 'Customers', actions: ['view', 'create', 'edit', 'delete'] },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    iconKey: 'finance',
    groups: [
      { key: 'banks', label: 'Banks', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'expenses', label: 'Expenses', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'procurement', label: 'Procurement', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'assets', label: 'Assets', actions: ['view', 'create', 'edit', 'delete'] },
    ],
  },
  {
    key: 'system_settings',
    label: 'System Settings',
    iconKey: 'system',
    groups: [
      { key: 'roles', label: 'Roles & Permissions', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'activity_log', label: 'Activity Log', actions: ['view', 'export'] },
      { key: 'settings', label: 'Settings', actions: ['view', 'edit'] },
    ],
  },
];

/** Flat list of every permission group — used for stats, coverage, etc. */
export const PERMISSION_GROUPS: PermissionGroup[] = PERMISSION_SECTIONS.flatMap((s) => s.groups);

export const ACTION_COLORS: Record<PermissionAction, string> = {
  view: 'bg-blue-50 text-blue-700 border-blue-200',
  create: 'bg-green-50 text-green-700 border-green-200',
  edit: 'bg-amber-50 text-amber-700 border-amber-200',
  delete: 'bg-red-50 text-red-700 border-red-200',
  export: 'bg-purple-50 text-purple-700 border-purple-200',
};

/** Build a permission map that grants every action for every group. */
export function buildAllPermissions(): Record<string, PermissionAction[]> {
  return PERMISSION_GROUPS.reduce<Record<string, PermissionAction[]>>((acc, g) => {
    acc[g.key] = [...g.actions];
    return acc;
  }, {});
}
