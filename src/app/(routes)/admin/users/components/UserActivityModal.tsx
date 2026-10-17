'use client';

import { useState, useEffect } from 'react';
import {
  X, Loader2, LogIn, ShoppingCart, Heart, Package, Star,
  UserCog, Trash2, MapPin, Car, MessageSquare, Mail, Ticket,
  RefreshCw, Undo2, CreditCard, Shield, Activity, Eye,
  BookOpen, Wrench, FileText, Globe, LayoutGrid, Search as SearchIcon,
} from 'lucide-react';
import { auditLogService, type AuditLogEntry, type AuditSummary } from '../service/auditLogService';

interface Props {
  userId: string;
  userName: string;
  onClose: () => void;
}

const ACTION_CONFIG: Record<string, { label: string; icon: typeof Activity; color: string }> = {
  login:                  { label: 'Logged in',              icon: LogIn,         color: 'text-green-600 bg-green-50' },
  signup:                 { label: 'Signed up',              icon: LogIn,         color: 'text-green-600 bg-green-50' },
  google_login:           { label: 'Google login',           icon: LogIn,         color: 'text-green-600 bg-green-50' },
  stack_auth_sync:        { label: 'Auth synced',            icon: LogIn,         color: 'text-green-600 bg-green-50' },
  google_oauth_callback:  { label: 'Google OAuth',           icon: LogIn,         color: 'text-green-600 bg-green-50' },
  update_profile:         { label: 'Updated profile',        icon: UserCog,       color: 'text-blue-600 bg-blue-50' },
  delete_account:         { label: 'Deleted account',        icon: Trash2,        color: 'text-red-600 bg-red-50' },
  add_address:            { label: 'Added address',          icon: MapPin,        color: 'text-blue-600 bg-blue-50' },
  update_address:         { label: 'Updated address',        icon: MapPin,        color: 'text-blue-600 bg-blue-50' },
  delete_address:         { label: 'Deleted address',        icon: MapPin,        color: 'text-red-600 bg-red-50' },
  add_car:                { label: 'Added car',              icon: Car,           color: 'text-indigo-600 bg-indigo-50' },
  update_car:             { label: 'Updated car',            icon: Car,           color: 'text-indigo-600 bg-indigo-50' },
  remove_car:             { label: 'Removed car',            icon: Car,           color: 'text-red-600 bg-red-50' },
  add_to_cart:            { label: 'Added to cart',          icon: ShoppingCart,  color: 'text-amber-600 bg-amber-50' },
  update_cart:            { label: 'Updated cart',           icon: ShoppingCart,  color: 'text-amber-600 bg-amber-50' },
  update_cart_item:       { label: 'Updated cart item',      icon: ShoppingCart,  color: 'text-amber-600 bg-amber-50' },
  remove_from_cart:       { label: 'Removed from cart',      icon: ShoppingCart,  color: 'text-red-600 bg-red-50' },
  clear_cart:             { label: 'Cleared cart',           icon: ShoppingCart,  color: 'text-red-600 bg-red-50' },
  merge_guest_cart:       { label: 'Merged guest cart',      icon: ShoppingCart,  color: 'text-amber-600 bg-amber-50' },
  add_to_wishlist:        { label: 'Added to wishlist',      icon: Heart,         color: 'text-pink-600 bg-pink-50' },
  toggle_wishlist:        { label: 'Toggled wishlist',       icon: Heart,         color: 'text-pink-600 bg-pink-50' },
  remove_from_wishlist:   { label: 'Removed from wishlist',  icon: Heart,         color: 'text-red-600 bg-red-50' },
  place_order:            { label: 'Placed order',           icon: Package,       color: 'text-purple-600 bg-purple-50' },
  initiate_checkout:      { label: 'Started checkout',       icon: CreditCard,    color: 'text-purple-600 bg-purple-50' },
  create_review:          { label: 'Posted review',          icon: Star,          color: 'text-yellow-600 bg-yellow-50' },
  update_review:          { label: 'Updated review',         icon: Star,          color: 'text-yellow-600 bg-yellow-50' },
  delete_review:          { label: 'Deleted review',         icon: Star,          color: 'text-red-600 bg-red-50' },
  create_return:          { label: 'Requested return',       icon: Undo2,         color: 'text-orange-600 bg-orange-50' },
  create_preorder:        { label: 'Created preorder',       icon: Package,       color: 'text-purple-600 bg-purple-50' },
  cancel_preorder:        { label: 'Cancelled preorder',     icon: Package,       color: 'text-red-600 bg-red-50' },
  submit_contact:         { label: 'Submitted contact',      icon: MessageSquare, color: 'text-teal-600 bg-teal-50' },
  newsletter_subscribe:   { label: 'Subscribed newsletter',  icon: Mail,          color: 'text-teal-600 bg-teal-50' },
  newsletter_unsubscribe: { label: 'Unsubscribed',           icon: Mail,          color: 'text-gray-600 bg-gray-50' },
  apply_discount:         { label: 'Applied discount',       icon: Ticket,        color: 'text-emerald-600 bg-emerald-50' },
  post_blog_comment:      { label: 'Blog comment',           icon: MessageSquare, color: 'text-teal-600 bg-teal-50' },
  admin_update_user_status: { label: 'Status changed (admin)', icon: Shield,      color: 'text-red-600 bg-red-50' },
  admin_update_user_role:   { label: 'Role changed (admin)',   icon: Shield,      color: 'text-red-600 bg-red-50' },
  admin_delete_user:        { label: 'Deleted (admin)',        icon: Shield,      color: 'text-red-600 bg-red-50' },
  // View/Browse actions
  view_product:             { label: 'Viewed product',         icon: Eye,          color: 'text-gray-600 bg-gray-50' },
  browse_products:          { label: 'Browsed products',       icon: LayoutGrid,   color: 'text-gray-600 bg-gray-50' },
  browse_categories:        { label: 'Browsed categories',     icon: LayoutGrid,   color: 'text-gray-600 bg-gray-50' },
  view_cart:                { label: 'Viewed cart',            icon: ShoppingCart,  color: 'text-amber-600 bg-amber-50' },
  view_wishlist:            { label: 'Viewed wishlist',        icon: Heart,         color: 'text-pink-600 bg-pink-50' },
  view_orders:              { label: 'Viewed orders',          icon: Package,       color: 'text-purple-600 bg-purple-50' },
  view_order_detail:        { label: 'Viewed order detail',    icon: Package,       color: 'text-purple-600 bg-purple-50' },
  view_profile:             { label: 'Viewed profile',         icon: UserCog,       color: 'text-blue-600 bg-blue-50' },
  view_addresses:           { label: 'Viewed addresses',       icon: MapPin,        color: 'text-blue-600 bg-blue-50' },
  view_cars:                { label: 'Viewed cars',            icon: Car,           color: 'text-indigo-600 bg-indigo-50' },
  view_reviews:             { label: 'Viewed reviews',         icon: Star,          color: 'text-yellow-600 bg-yellow-50' },
  view_returns:             { label: 'Viewed returns',         icon: Undo2,         color: 'text-orange-600 bg-orange-50' },
  view_preorders:           { label: 'Viewed preorders',       icon: Package,       color: 'text-purple-600 bg-purple-50' },
  browse_blogs:             { label: 'Browsed blogs',          icon: BookOpen,      color: 'text-gray-600 bg-gray-50' },
  view_blog:                { label: 'Read blog',              icon: BookOpen,      color: 'text-gray-600 bg-gray-50' },
  view_services:            { label: 'Viewed services',        icon: Wrench,        color: 'text-gray-600 bg-gray-50' },
  view_page:                { label: 'Viewed page',            icon: FileText,      color: 'text-gray-600 bg-gray-50' },
  view_settings:            { label: 'Loaded settings',        icon: Globe,         color: 'text-gray-500 bg-gray-50' },
  browse_car_makes:         { label: 'Browsed car makes',      icon: Car,           color: 'text-gray-600 bg-gray-50' },
  admin_view_users:         { label: 'Viewed users (admin)',   icon: SearchIcon,    color: 'text-gray-600 bg-gray-50' },
};

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatDetails(details: Record<string, unknown> | null) {
  if (!details) return null;
  return Object.entries(details)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');
}

export default function UserActivityModal({ userId, userName, onClose }: Props) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [actionFilter, setActionFilter] = useState('');

  const fetchData = async (p = 1, action = '') => {
    try {
      const [logsRes, summaryRes] = await Promise.all([
        auditLogService.getUserLogs(userId, p, 30, action || undefined),
        p === 1 ? auditLogService.getUserSummary(userId) : null,
      ]);
      if (p === 1) {
        setLogs(logsRes.data);
        if (summaryRes) setSummary(summaryRes.data);
      } else {
        setLogs((prev) => [...prev, ...logsRes.data]);
      }
      setTotalPages(logsRes.pagination.totalPages);
      setPage(p);
    } catch (err) {
      console.error('Failed to fetch audit data:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchData(1, actionFilter);
  }, [userId, actionFilter]);

  const loadMore = () => {
    if (page >= totalPages) return;
    setLoadingMore(true);
    fetchData(page + 1, actionFilter);
  };

  // Get unique actions for filter dropdown
  const uniqueActions = summary?.breakdown.map((b) => b._id) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Activity Log</h2>
            <p className="text-xs text-gray-500">{userName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Summary */}
            {summary && (
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900">{summary.totalActions}</p>
                    <p className="text-[10px] text-gray-500">Total Actions</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900">{summary.breakdown.length}</p>
                    <p className="text-[10px] text-gray-500">Action Types</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-gray-900">{summary.lastActivity ? timeAgo(summary.lastActivity) : '—'}</p>
                    <p className="text-[10px] text-gray-500">Last Active</p>
                  </div>
                </div>

                {/* Top actions breakdown */}
                {summary.breakdown.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {summary.breakdown.slice(0, 6).map((b) => {
                      const config = ACTION_CONFIG[b._id];
                      return (
                        <span key={b._id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                          {config?.label || b._id}
                          <span className="text-gray-400">{b.count}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Filter */}
            {uniqueActions.length > 1 && (
              <div className="px-4 py-2 border-b border-gray-100">
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300"
                >
                  <option value="">All actions</option>
                  {uniqueActions.map((a) => (
                    <option key={a} value={a}>{ACTION_CONFIG[a]?.label || a}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Timeline */}
            {logs.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No activity recorded yet</p>
              </div>
            ) : (
              <div className="px-4 py-3">
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gray-200" />

                  <div className="space-y-3">
                    {logs.map((log) => {
                      const config = ACTION_CONFIG[log.action] || { label: log.action, icon: Activity, color: 'text-gray-600 bg-gray-50' };
                      const Icon = config.icon;
                      const detailStr = formatDetails(log.details);
                      const failed = log.statusCode && log.statusCode >= 400;

                      return (
                        <div key={log._id} className="relative flex gap-3 pl-1">
                          {/* Dot */}
                          <div className={`relative z-10 w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0 ${config.color}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          {/* Content */}
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-gray-900">{config.label}</span>
                              {failed && (
                                <span className="px-1 py-0.5 text-[9px] font-medium bg-red-100 text-red-600 rounded">FAILED</span>
                              )}
                              <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">{timeAgo(log.createdAt)}</span>
                            </div>
                            {detailStr && (
                              <p className="text-[10px] text-gray-500 mt-0.5 truncate">{detailStr}</p>
                            )}
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[9px] text-gray-400 font-mono">{log.method} {log.path}</span>
                              {log.ipAddress && (
                                <span className="text-[9px] text-gray-300">{log.ipAddress.replace('::ffff:', '')}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Load more */}
                {page < totalPages && (
                  <div className="text-center mt-4">
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      {loadingMore ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      Load More
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
