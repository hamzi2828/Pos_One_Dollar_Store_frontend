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
      { key: 'pos_orders', label: 'POS Orders', actions: ['view', 'create', 'edit', 'delete', 'export'] },
      { key: 'pos_gifts', label: 'POS Gifts', actions: ['view', 'create'] },
      { key: 'till', label: 'Till & Cash Closing', actions: ['view', 'create', 'edit'] },
      { key: 'till_verify', label: 'Verify Cash Closing', actions: ['view', 'edit', 'export'] },
      { key: 'sale_counters', label: 'Sale Counters', actions: ['view', 'create', 'edit', 'delete'] },
    ],
  },
  {
    key: 'purchasing',
    label: 'Purchasing & Vendors',
    iconKey: 'purchasing',
    groups: [
      { key: 'purchase_orders', label: 'Purchase Orders', actions: ['view', 'create', 'edit', 'delete', 'export'] },
      { key: 'goods_receiving', label: 'Goods Receiving', actions: ['view', 'create', 'edit'] },
      { key: 'vendors', label: 'Vendors & Ledger', actions: ['view', 'create', 'edit', 'delete', 'export'] },
      { key: 'vendor_payments', label: 'Vendor Payments', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'consignment', label: 'Consignment', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'vendor_returns', label: 'Vendor Returns', actions: ['view', 'create', 'edit', 'delete'] },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory & Warehouse',
    iconKey: 'inventory',
    groups: [
      { key: 'racks', label: 'Racks & Shelves', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'stock_putaway', label: 'Put-away / Move', actions: ['view', 'create'] },
      { key: 'stock_movements', label: 'Stock Movements', actions: ['view', 'export'] },
      { key: 'damages', label: 'Damaged Stock', actions: ['view', 'create', 'edit', 'delete', 'export'] },
      { key: 'shop_use', label: 'Shop Use', actions: ['view', 'create', 'delete'] },
      { key: 'stock_adjustments', label: 'Stock Adjustments', actions: ['view', 'create'] },
    ],
  },
  {
    key: 'reports',
    label: 'Reports',
    iconKey: 'reports',
    groups: [
      { key: 'report_sales', label: 'Sales Reports', actions: ['view', 'export'] },
      { key: 'report_cost_analysis', label: 'Cost Analysis', actions: ['view', 'export'] },
      { key: 'report_stock', label: 'Stock', actions: ['view', 'export'] },
      { key: 'report_expenses', label: 'Expenses', actions: ['view', 'export'] },
      { key: 'report_receivables', label: 'Receivables', actions: ['view', 'export'] },
      { key: 'report_cash_in_hand', label: 'Cash in Hand', actions: ['view', 'export'] },
      { key: 'report_demand', label: 'Demand List', actions: ['view', 'edit', 'export'] },
      { key: 'report_trends', label: 'Sales Trends', actions: ['view', 'export'] },
      { key: 'report_slow_moving', label: 'Slow Moving', actions: ['view', 'edit', 'export'] },
      { key: 'report_footfall', label: 'Footfall', actions: ['view', 'create', 'edit', 'delete', 'export'] },
      { key: 'report_category_performance', label: 'Category Performance', actions: ['view', 'export'] },
      { key: 'report_cash_closing', label: 'Cash Closing', actions: ['view', 'export'] },
      { key: 'report_stock_movement', label: 'Stock Timeline', actions: ['view', 'export'] },
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
      { key: 'discounts', label: 'Discounts', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'price_tiers', label: 'Price Tiers', actions: ['view', 'create', 'edit', 'delete'] },
    ],
  },
  {
    key: 'customer_management',
    label: 'Customers',
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
      { key: 'assets', label: 'Assets', actions: ['view', 'create', 'edit', 'delete', 'export'] },
      { key: 'investments', label: 'Investment', actions: ['view', 'create', 'edit', 'delete', 'export'] },
    ],
  },
  {
    key: 'hr',
    label: 'HR',
    iconKey: 'hr',
    groups: [
      { key: 'employees', label: 'Employees', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'shifts', label: 'Shifts & Roster', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'hr_policies', label: 'HR Policies', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'attendance', label: 'Attendance', actions: ['view', 'create', 'edit', 'export'] },
      { key: 'payroll', label: 'Payroll & Advances', actions: ['view', 'create', 'edit', 'delete', 'export'] },
      { key: 'category_assignments', label: 'Category Staff', actions: ['view', 'edit'] },
    ],
  },
  {
    key: 'system_settings',
    label: 'System Settings',
    iconKey: 'system',
    groups: [
      { key: 'roles', label: 'Roles & Permissions', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'staff', label: 'Staff Users', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'activity_log', label: 'Activity Log', actions: ['view', 'export'] },
      { key: 'settings', label: 'Settings', actions: ['view', 'edit'] },
      { key: 'notifications', label: 'Notifications', actions: ['view', 'edit'] },
      { key: 'whatsapp', label: 'WhatsApp', actions: ['view', 'edit'] },
    ],
  },
  {
    key: 'desktop',
    label: 'Desktop app',
    iconKey: 'desktop',
    groups: [
      { key: 'attendance_kiosk', label: 'Attendance (fingerprint)', actions: ['view', 'create'] },
      { key: 'desktop_pos', label: 'Sales on the counter PC (works offline)', actions: ['view', 'create'] },
    ],
  },
  {
    key: 'website',
    label: 'Website',
    iconKey: 'website',
    groups: [
      { key: 'website', label: 'Website', actions: ['view', 'edit'] },
    ],
  },
];

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
