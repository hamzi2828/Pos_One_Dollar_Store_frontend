// Add Customer Modal for POS — name, email, phone and customer type/source.
'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Loader2, User, Plus, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { createOrFindCustomer } from '../services/posCustomerService';
import { POSCustomer } from '../types';
import { SearchSelect } from '@/components/ui/SearchSelect';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerCreated: (customer: POSCustomer) => void;
}

type CustomerType = 'online' | 'walk-in';
type CustomerSource = 'facebook' | 'tiktok' | 'instagram' | 'word-of-mouth' | '';

// Simple email shape check — backend still owns the final validation.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AddCustomerModal({
  isOpen,
  onClose,
  onCustomerCreated,
}: AddCustomerModalProps) {
  const [customerType, setCustomerType] = useState<CustomerType>('walk-in');
  const [source, setSource] = useState<CustomerSource>('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const submitLock = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form on open.
  useEffect(() => {
    if (!isOpen) return;
    setCustomerType('walk-in');
    setSource('');
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setError(null);
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLock.current) return;
    setError(null);

    if (!firstName.trim()) return setError('First name is required');
    if (!email.trim()) return setError('Email is required');
    if (!EMAIL_RE.test(email.trim())) return setError('Enter a valid email address');
    if (!phone.trim()) return setError('Phone is required');
    if (customerType === 'online' && !source) {
      return setError('Please select a source for online customer');
    }

    submitLock.current = true;
    setLoading(true);
    try {
      const response = await createOrFindCustomer({
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        email: email.trim(),
        phone: phone.trim(),
      });

      const created = response.data;

      const posCustomer: POSCustomer = {
        _id: created._id,
        firstName: created.firstName,
        lastName: created.lastName || '',
        email: created.email || email.trim(),
        phone: created.phone || phone.trim(),
        customerType,
        source: customerType === 'online' ? source : undefined,
      };

      toast.success('Customer created successfully');
      onCustomerCreated(posCustomer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create customer';
      setError(msg);
      toast.error(msg);
    } finally {
      submitLock.current = false;
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900">Add New Customer</h2>
          <button onClick={onClose} disabled={loading} className="text-gray-400 hover:text-gray-600 disabled:opacity-60 disabled:cursor-not-allowed">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Customer Type */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-honey-700" />
              <h3 className="text-sm font-semibold text-gray-900">Customer Type</h3>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="customerType"
                  value="walk-in"
                  checked={customerType === 'walk-in'}
                  onChange={(e) => {
                    setCustomerType(e.target.value as CustomerType);
                    setSource('');
                  }}
                  className="w-4 h-4 text-honey-700"
                  disabled={loading}
                />
                <span className="text-sm text-gray-700">Walk-in</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="customerType"
                  value="online"
                  checked={customerType === 'online'}
                  onChange={(e) => setCustomerType(e.target.value as CustomerType)}
                  className="w-4 h-4 text-honey-700"
                  disabled={loading}
                />
                <span className="text-sm text-gray-700">Online</span>
              </label>
            </div>
            {customerType === 'online' && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Source <span className="text-red-500">*</span>
                </label>
                <SearchSelect
                  value={source}
                  onChange={(e) => setSource(e.target.value as CustomerSource)}
                  className="w-full md:w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-honey-500"
                  disabled={loading}
                >
                  <option value="">Select source...</option>
                  <option value="facebook">Facebook</option>
                  <option value="tiktok">TikTok</option>
                  <option value="instagram">Instagram</option>
                  <option value="word-of-mouth">Word of Mouth</option>
                </SearchSelect>
              </div>
            )}
          </div>

          {/* Personal Information */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-honey-700" />
              <h3 className="text-sm font-semibold text-gray-900">Personal Information</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-honey-500"
                  placeholder="John"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-honey-500"
                  placeholder="Doe"
                  disabled={loading}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5 text-gray-400" />
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-honey-500"
                  placeholder="john@example.com"
                  disabled={loading}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-honey-500"
                  placeholder="+92 300 1234567"
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        </form>

        <div className="p-4 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            aria-busy={loading}
            className="px-4 py-2 bg-honey-500 text-gray-900 rounded-lg hover:bg-honey-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Creating…
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Create Customer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
