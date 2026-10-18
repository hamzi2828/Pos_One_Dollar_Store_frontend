// Customer Selector Modal — pick an existing customer, add a new one, or
// check out as a walk-in guest. Picking a customer selects them straight away.
'use client';

import { useState, useEffect, useCallback } from 'react';
import { POSCustomer } from '../types';
import { Search, X, User, Plus, Loader2 } from 'lucide-react';
import { searchCustomers, getAllCustomers } from '../services/posCustomerService';
import AddCustomerModal from './AddCustomerModal';

interface CustomerSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (customer: POSCustomer | null) => void;
  currentCustomer?: POSCustomer | null;
}

export default function CustomerSelector({
  isOpen,
  onClose,
  onSelect,
  currentCustomer,
}: CustomerSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<POSCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllCustomers();
      setCustomers(data);
    } catch (error) {
      console.error('Failed to load customers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    try {
      setLoading(true);
      const data = await searchCustomers(query);
      setCustomers(data);
    } catch (error) {
      console.error('Failed to search customers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (searchQuery.trim()) {
      const t = setTimeout(() => handleSearch(searchQuery), 250);
      return () => clearTimeout(t);
    }
    loadCustomers();
  }, [searchQuery, isOpen, handleSearch, loadCustomers]);

  const pickCustomer = (customer: POSCustomer) => {
    onSelect(customer);
    onClose();
  };

  const handleGuest = () => {
    onSelect(null);
    onClose();
  };

  const handleCustomerCreated = (newCustomer: POSCustomer) => {
    setShowAddCustomerModal(false);
    pickCustomer(newCustomer);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Select Customer</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddCustomerModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-900 bg-honey-500 rounded-lg hover:bg-honey-600"
            >
              <Plus className="h-4 w-4" />
              Add Customer
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <ListStage
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          customers={customers}
          loading={loading}
          currentCustomer={currentCustomer}
          onPick={pickCustomer}
          onGuest={handleGuest}
        />
      </div>

      <AddCustomerModal
        isOpen={showAddCustomerModal}
        onClose={() => setShowAddCustomerModal(false)}
        onCustomerCreated={handleCustomerCreated}
      />
    </div>
  );
}

// ---------------- Customer list ----------------

function ListStage({
  searchQuery,
  setSearchQuery,
  customers,
  loading,
  currentCustomer,
  onPick,
  onGuest,
}: {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  customers: POSCustomer[];
  loading: boolean;
  currentCustomer?: POSCustomer | null;
  onPick: (c: POSCustomer) => void;
  onGuest: () => void;
}) {
  return (
    <>
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, or email..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-honey-500 focus:border-transparent"
            autoFocus
          />
        </div>
      </div>

      <div className="p-4 border-b border-gray-200">
        <button
          onClick={onGuest}
          className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
            !currentCustomer ? 'border-honey-500 bg-red-50' : 'border-gray-200 hover:border-honey-500/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
              <User className="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">Walk-in Customer</div>
              <div className="text-sm text-gray-500">Guest checkout (no customer record)</div>
            </div>
          </div>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-honey-700 mx-auto" />
            <p className="mt-2 text-gray-500">Loading customers...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No customers found</p>
            {searchQuery && <p className="text-sm mt-2">Try a different search term</p>}
          </div>
        ) : (
          <div className="space-y-2">
            {customers.map((customer) => (
              <button
                key={customer._id}
                onClick={() => onPick(customer)}
                className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                  currentCustomer?._id === customer._id
                    ? 'border-honey-500 bg-red-50'
                    : 'border-gray-200 hover:border-honey-500/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-honey-500/10 rounded-full flex items-center justify-center">
                    <span className="text-honey-700 font-semibold text-lg">
                      {customer.firstName?.charAt(0) || 'C'}
                      {customer.lastName?.charAt(0) || ''}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900">
                      {customer.firstName} {customer.lastName}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      {customer.phone && <span>{customer.phone}</span>}
                      {customer.email && <span className="truncate">{customer.email}</span>}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
