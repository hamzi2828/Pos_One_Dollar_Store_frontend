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
 * Fallback copy of the backend catalogue (pos_backend/src/constants/rolePermissions.js).
 * The pages load the live list from GET /admin/roles/catalogue (see useCatalogue.ts)
 * and only use this copy when that call fails.
 */
export const PERMISSION_SECTIONS: PermissionSection[] = [
  {
    key: 'main',
    label: 'Main',
    iconKey: 'main',
    groups: [
      { key: 'dashboard', label: 'Dashboard', actions: ['view', 'export'] },
      { key: 'pos', label: 'POS', actions: ['view', 'create', 'edit', 'delete', 'export'] },
      { key: 'orders', label: 'Online Orders', actions: ['view', 'create', 'edit', 'delete', 'export'] },
      { key: 'pos_orders', label: 'POS Orders', actions: ['view', 'create', 'edit', 'delete', 'export'] },
      { key: 'preorders', label: 'Pre-Orders', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'returns', label: 'Returns', actions: ['view', 'create', 'edit', 'delete'] },
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
      { key: 'report_labour_revenue', label: 'Labour Revenue', actions: ['view', 'export'] },
      { key: 'report_stock', label: 'Stock', actions: ['view', 'export'] },
      { key: 'report_vehicle_history', label: 'Vehicle History', actions: ['view', 'export'] },
      { key: 'report_expenses', label: 'Expenses', actions: ['view', 'export'] },
      { key: 'report_vendor_payments', label: 'Vendor Payments', actions: ['view', 'export'] },
      { key: 'report_salary', label: 'Salary', actions: ['view', 'export'] },
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
      { key: 'stock_receive', label: 'Receive Stock', actions: ['view', 'create'] },
      { key: 'stock_transfers', label: 'Stock Transfers', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'reviews', label: 'Reviews', actions: ['view', 'edit', 'delete'] },
      { key: 'discounts', label: 'Discounts', actions: ['view', 'create', 'edit', 'delete'] },
    ],
  },
  {
    key: 'customer_management',
    label: 'Customer Management',
    iconKey: 'customers',
    groups: [
      { key: 'customers', label: 'Customers', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'subscribers', label: 'Subscribers', actions: ['view', 'edit', 'delete', 'export'] },
      { key: 'queries', label: 'Contact Queries', actions: ['view', 'edit', 'delete'] },
    ],
  },
  {
    key: 'content_management',
    label: 'Content Management',
    iconKey: 'content',
    groups: [
      { key: 'hero_slides', label: 'Hero Slides', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'blogs', label: 'All Blogs', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'blog_categories', label: 'Categories', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'blog_authors', label: 'Authors', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'blog_settings', label: 'Blog Settings', actions: ['view', 'edit'] },
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
      { key: 'networks', label: 'Easyload Networks', actions: ['view', 'create', 'edit', 'delete'] },
    ],
  },
  {
    key: 'hr',
    label: 'HR & Payroll',
    iconKey: 'hr',
    groups: [
      { key: 'employees', label: 'Employees', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'attendance', label: 'Attendance', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'salary', label: 'Salary', actions: ['view', 'create', 'edit', 'delete', 'export'] },
    ],
  },
  {
    key: 'system_settings',
    label: 'System Settings',
    iconKey: 'system',
    groups: [
      { key: 'roles', label: 'Roles & Permissions', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'staff', label: 'Staff Users', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'branches', label: 'Branches', actions: ['view'] },
      { key: 'activity_log', label: 'Activity Log', actions: ['view', 'export'] },
      { key: 'services', label: 'Services', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'shipping', label: 'Shipping', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'pages', label: 'Dynamic Pages', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'guidelines', label: 'Guidelines', actions: ['view', 'create', 'edit', 'delete'] },
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
