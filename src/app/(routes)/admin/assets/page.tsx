'use client';

import { useEffect, useState, useCallback } from 'react';
import AllAssets from './components/AllAssets';
import { assetService } from './services/assetService';
import type { AssetUI, CreateAssetPayload } from './services/assetService';

const AssetsPage = () => {
  const [assets, setAssets] = useState<AssetUI[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Toast state
  const [toast, setToast] = useState<{ show: boolean; msg: string; type: 'success' | 'error' | 'info' }>({
    show: false,
    msg: '',
    type: 'success',
  });

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type }), 2500);
  };

  // Load assets (AllAssets does its own client-side filter/search, so we pull a
  // single large page; swap to a paginated table if assets grow into the thousands).
  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items } = await assetService.listAssets({ page: 1, limit: 200 });
      setAssets(items);
    } catch (e) {
      console.error('Failed to load assets', e);
      setError('Could not fetch assets from server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // Add handler
  const handleAdd = async (payload: CreateAssetPayload) => {
    try {
      await assetService.createAsset(payload);
      showToast('Asset added successfully', 'success');
      await loadAssets();
    } catch (e) {
      console.error('Failed to add asset', e);
      showToast('Failed to add asset', 'error');
    }
  };

  // Edit handler
  const handleEdit = async (id: string, payload: Partial<CreateAssetPayload>) => {
    try {
      await assetService.updateAsset(id, payload);
      showToast('Asset updated successfully', 'success');
      await loadAssets();
    } catch (e) {
      console.error('Failed to update asset', e);
      showToast('Failed to update asset', 'error');
    }
  };

  // Delete handler
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;

    const prev = assets;
    setAssets((a) => a.filter((x) => x.id !== id));

    try {
      await assetService.deleteAsset(id);
      showToast('Asset deleted successfully', 'success');
    } catch (e) {
      console.error('Failed to delete asset', e);
      setAssets(prev);
      showToast('Failed to delete asset', 'error');
    }
  };

  return (
    <>
      {toast.show && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow ${
            toast.type === 'success'
              ? 'bg-green-50 text-gray-800 border-l-4 border-green-400'
              : toast.type === 'error'
              ? 'bg-red-50 text-red-700 border-l-4 border-red-500'
              : 'bg-blue-50 text-blue-700 border-l-4 border-blue-500'
          }`}
        >
          <div className="flex items-center">
            <span className="font-medium">{toast.msg}</span>
            <button onClick={() => setToast({ show: false, msg: '', type: toast.type })} className="ml-3 text-gray-400 hover:text-gray-600">
              ×
            </button>
          </div>
        </div>
      )}

      <AllAssets
        assets={assets}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        loading={loading}
        error={error}
        currency={'PKR'}
      />
    </>
  );
};

export default AssetsPage;
