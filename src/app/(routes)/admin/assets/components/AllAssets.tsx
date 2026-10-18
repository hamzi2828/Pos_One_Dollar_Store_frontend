'use client';

import { useRef, useState } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiTruck, FiTool, FiHome, FiMonitor, FiPackage, FiMoreVertical } from 'react-icons/fi';
import { Loader2 } from 'lucide-react';
import type { AssetUI, AssetType, AssetStatus, CreateAssetPayload } from '../services/assetService';

interface AllAssetsProps {
  assets: AssetUI[];
  // May return a promise: the form / row then shows a spinner until it settles.
  onAdd: (asset: CreateAssetPayload) => void | Promise<void>;
  onEdit: (id: string, asset: Partial<CreateAssetPayload>) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  loading: boolean;
  error: string | null;
  currency: string;
}

const assetTypes: { value: AssetType; label: string; icon: React.ReactNode }[] = [
  { value: 'vehicle', label: 'Vehicle', icon: <FiTruck className="w-4 h-4" /> },
  { value: 'equipment', label: 'Equipment', icon: <FiTool className="w-4 h-4" /> },
  { value: 'property', label: 'Property', icon: <FiHome className="w-4 h-4" /> },
  { value: 'electronics', label: 'Electronics', icon: <FiMonitor className="w-4 h-4" /> },
  { value: 'furniture', label: 'Furniture', icon: <FiPackage className="w-4 h-4" /> },
  { value: 'other', label: 'Other', icon: <FiPackage className="w-4 h-4" /> },
];

const assetStatuses: { value: AssetStatus; label: string; color: string }[] = [
  { value: 'active', label: 'Active', color: 'bg-green-100 text-green-800' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'sold', label: 'Sold', color: 'bg-blue-100 text-blue-800' },
  { value: 'disposed', label: 'Disposed', color: 'bg-gray-100 text-gray-800' },
];

const formatCurrency = (amount: number, currency: string) => {
  if (currency === 'PKR' || currency === 'Rs') {
    return `Rs ${amount.toLocaleString()}`;
  }
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
};

const getTypeIcon = (type: AssetType) => {
  const found = assetTypes.find(t => t.value === type);
  return found?.icon || <FiPackage className="w-4 h-4" />;
};

const getStatusBadge = (status: AssetStatus) => {
  const found = assetStatuses.find(s => s.value === status);
  return found || { label: status, color: 'bg-gray-100 text-gray-800' };
};

export default function AllAssets({ assets, onAdd, onEdit, onDelete, loading, error, currency }: AllAssetsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<AssetType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<AssetStatus | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetUI | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveLockRef = useRef(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deleteLockRef = useRef(false);

  const [formData, setFormData] = useState<CreateAssetPayload>({
    name: '',
    type: 'vehicle',
    purchasePrice: 0,
    purchaseDate: new Date().toISOString().split('T')[0],
    status: 'active',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'vehicle',
      purchasePrice: 0,
      purchaseDate: new Date().toISOString().split('T')[0],
      status: 'active',
    });
  };

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || asset.type === filterType;
    const matchesStatus = filterStatus === 'all' || asset.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const totalValue = filteredAssets.reduce((sum, asset) => sum + (asset.currentValue || asset.purchasePrice), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveLockRef.current) return;
    saveLockRef.current = true;
    setSaving(true);
    try {
      if (editingAsset) {
        await onEdit(editingAsset.id, formData);
        setEditingAsset(null);
      } else {
        await onAdd(formData);
      }
    } finally {
      saveLockRef.current = false;
      setSaving(false);
      setShowAddModal(false);
      resetForm();
    }
  };

  const handleDeleteClick = async (id: string) => {
    setOpenDropdown(null);
    if (deleteLockRef.current) return;
    deleteLockRef.current = true;
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      deleteLockRef.current = false;
      setDeletingId(null);
    }
  };

  const closeModal = () => {
    if (saveLockRef.current) return;
    setShowAddModal(false);
  };

  const openEditModal = (asset: AssetUI) => {
    setEditingAsset(asset);
    setFormData({
      name: asset.name,
      type: asset.type,
      description: asset.description,
      purchasePrice: asset.purchasePrice,
      currentValue: asset.currentValue,
      purchaseDate: asset.purchaseDate.split('T')[0],
      vendor: asset.vendor,
      location: asset.location,
      serialNumber: asset.serialNumber,
      status: asset.status,
      notes: asset.notes,
    });
    setShowAddModal(true);
    setOpenDropdown(null);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Company Assets</h1>
          <p className="text-sm text-gray-500 mt-1">Track and manage company-owned assets</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingAsset(null);
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[#dc2626] text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <FiPlus className="w-4 h-4" />
          Add Asset
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">Total Assets</p>
          <p className="text-2xl font-bold text-gray-900">{assets.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">Total Value</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalValue, currency)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">Active Assets</p>
          <p className="text-2xl font-bold text-green-600">{assets.filter(a => a.status === 'active').length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">In Maintenance</p>
          <p className="text-2xl font-bold text-yellow-600">{assets.filter(a => a.status === 'maintenance').length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as AssetType | 'all')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
        >
          <option value="all">All Types</option>
          {assetTypes.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as AssetStatus | 'all')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
        >
          <option value="all">All Status</option>
          {assetStatuses.map(status => (
            <option key={status.value} value={status.value}>{status.label}</option>
          ))}
        </select>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#dc2626]"></div>
          <span className="ml-3 text-gray-600">Loading assets...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredAssets.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <FiPackage className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No assets found</h3>
          <p className="text-gray-500 mb-4">Add your first company asset to get started</p>
          <button
            onClick={() => {
              resetForm();
              setEditingAsset(null);
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#dc2626] text-white rounded-lg hover:bg-red-700"
          >
            <FiPlus className="w-4 h-4" />
            Add Asset
          </button>
        </div>
      )}

      {/* Assets Table */}
      {!loading && filteredAssets.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asset</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purchase Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purchase Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredAssets.map((asset) => {
                  const statusBadge = getStatusBadge(asset.status);
                  return (
                    <tr key={asset.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
                            {getTypeIcon(asset.type)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{asset.name}</p>
                            {asset.serialNumber && (
                              <p className="text-xs text-gray-500">SN: {asset.serialNumber}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="capitalize text-sm text-gray-700">{asset.type}</span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        {formatCurrency(asset.purchasePrice, currency)}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        {asset.currentValue ? formatCurrency(asset.currentValue, currency) : '-'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {new Date(asset.purchaseDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusBadge.color}`}>
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="relative flex justify-end">
                          <button
                            onClick={() => setOpenDropdown(openDropdown === asset.id ? null : asset.id)}
                            disabled={deletingId === asset.id}
                            aria-busy={deletingId === asset.id}
                            title={deletingId === asset.id ? 'Deleting…' : undefined}
                            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {deletingId === asset.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <FiMoreVertical className="w-4 h-4" />
                            )}
                          </button>
                          {openDropdown === asset.id && (
                            <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                              <button
                                onClick={() => openEditModal(asset)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <FiEdit2 className="w-4 h-4" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteClick(asset.id)}
                                disabled={!!deletingId}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                <FiTrash2 className="w-4 h-4" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingAsset ? 'Edit Asset' : 'Add New Asset'}
              </h3>
              <button
                onClick={closeModal}
                disabled={saving}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4">
              <fieldset disabled={saving} className="min-w-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Asset Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="e.g., Toyota Corolla 2020"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as AssetType })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    {assetTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as AssetStatus })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    {assetStatuses.map(status => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Value</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.currentValue || ''}
                    onChange={(e) => setFormData({ ...formData, currentValue: parseFloat(e.target.value) || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
                  <input
                    type="text"
                    value={formData.serialNumber || ''}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="e.g., VIN, Serial #"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                  <input
                    type="text"
                    value={formData.vendor || ''}
                    onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Purchased from"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={formData.location || ''}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Where is it located?"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Brief description of the asset"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Additional notes"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  aria-busy={saving}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#dc2626] text-white rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving
                    ? editingAsset ? 'Updating…' : 'Adding…'
                    : editingAsset ? 'Update Asset' : 'Add Asset'}
                </button>
              </div>
              </fieldset>
            </form>
          </div>
        </div>
      )}

      {/* Click outside to close dropdown */}
      {openDropdown && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setOpenDropdown(null)}
        />
      )}
    </div>
  );
}
