// Add Customer Modal for POS — mirrors the /user-detail?tab=garage car picker
// (make → model → variant from the admin catalog) so counter-created customers
// slot into the same data model as self-signup users.
'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, Car, User, Plus, Trash2, Mail } from 'lucide-react';
import Select, { type SingleValue, type StylesConfig } from 'react-select';
import toast from 'react-hot-toast';
import { createOrFindCustomer } from '../services/posCustomerService';
import { POSCustomer, POSCarDetails } from '../types';
import {
  listCarMakes,
  listCarModels,
  listCarVariants,
  type CarMake,
  type CarModel,
  type CarVariant,
} from '../services/posCarService';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerCreated: (customer: POSCustomer) => void;
}

interface CarFormData {
  id: string;
  makeId: string;
  makeName: string;
  modelId: string;
  modelName: string;
  variantId: string;
  variantName: string;
  numberPlate: string;
}

type CustomerType = 'online' | 'walk-in';
type CustomerSource = 'facebook' | 'tiktok' | 'instagram' | 'word-of-mouth' | '';
type Option = { value: string; label: string };

const emptyCar = (): CarFormData => ({
  id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
  makeId: '',
  makeName: '',
  modelId: '',
  modelName: '',
  variantId: '',
  variantName: '',
  numberPlate: '',
});

// Simple email shape check — backend still owns the final validation.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const selectStyles: StylesConfig<Option, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: 38,
    borderRadius: 8,
    borderColor: state.isFocused ? '#DC2626' : '#e5e7eb',
    boxShadow: state.isFocused ? '0 0 0 1px #FCA5A5' : 'none',
    fontSize: 14,
    backgroundColor: 'white',
    '&:hover': { borderColor: state.isFocused ? '#DC2626' : '#d1d5db' },
  }),
  valueContainer: (base) => ({ ...base, padding: '0 10px' }),
  menu: (base) => ({ ...base, zIndex: 100 }),
  option: (base, state) => ({
    ...base,
    fontSize: 13,
    backgroundColor: state.isSelected ? '#DC2626' : state.isFocused ? '#FEE2E2' : 'white',
    color: state.isSelected ? 'white' : '#111827',
  }),
};

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
  const [cars, setCars] = useState<CarFormData[]>([emptyCar()]);

  const [makes, setMakes] = useState<CarMake[]>([]);
  // Per-car caches: modelId/variantId → list
  const [modelsByMake, setModelsByMake] = useState<Record<string, CarModel[]>>({});
  const [variantsByModel, setVariantsByModel] = useState<Record<string, CarVariant[]>>({});

  const [loading, setLoading] = useState(false);
  const [makesLoading, setMakesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form + load makes on open.
  useEffect(() => {
    if (!isOpen) return;
    setCustomerType('walk-in');
    setSource('');
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setCars([emptyCar()]);
    setError(null);

    setMakesLoading(true);
    listCarMakes()
      .then((m) => setMakes(m))
      .catch(() => toast.error('Failed to load car brands'))
      .finally(() => setMakesLoading(false));
  }, [isOpen]);

  const loadModelsFor = async (makeId: string) => {
    if (modelsByMake[makeId]) return modelsByMake[makeId];
    try {
      const list = await listCarModels(makeId);
      setModelsByMake((p) => ({ ...p, [makeId]: list }));
      return list;
    } catch {
      toast.error('Failed to load car models');
      return [];
    }
  };

  const loadVariantsFor = async (modelId: string) => {
    if (variantsByModel[modelId]) return variantsByModel[modelId];
    try {
      const list = await listCarVariants(modelId);
      setVariantsByModel((p) => ({ ...p, [modelId]: list }));
      return list;
    } catch {
      // Variant is optional — silent failure.
      return [];
    }
  };

  const updateCar = (id: string, patch: Partial<CarFormData>) => {
    setCars((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const handleMakeChange = async (id: string, opt: SingleValue<Option>) => {
    const make = makes.find((m) => m.id === opt?.value);
    updateCar(id, {
      makeId: make?.id || '',
      makeName: make?.name || '',
      modelId: '',
      modelName: '',
      variantId: '',
      variantName: '',
    });
    if (make) await loadModelsFor(make.id);
  };

  const handleModelChange = async (id: string, opt: SingleValue<Option>) => {
    const car = cars.find((c) => c.id === id);
    if (!car) return;
    const model = (modelsByMake[car.makeId] || []).find((m) => m.id === opt?.value);
    updateCar(id, {
      modelId: model?.id || '',
      modelName: model?.name || '',
      variantId: '',
      variantName: '',
    });
    if (model) await loadVariantsFor(model.id);
  };

  const handleVariantChange = (id: string, opt: SingleValue<Option>) => {
    const car = cars.find((c) => c.id === id);
    if (!car) return;
    const variant = (variantsByModel[car.modelId] || []).find((v) => v.id === opt?.value);
    updateCar(id, {
      variantId: variant?.id || '',
      variantName: variant?.name || '',
    });
  };

  const addCar = () => setCars((prev) => [...prev, emptyCar()]);
  const removeCar = (id: string) =>
    setCars((prev) => (prev.length <= 1 ? prev : prev.filter((c) => c.id !== id)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim()) return setError('First name is required');
    if (!email.trim()) return setError('Email is required');
    if (!EMAIL_RE.test(email.trim())) return setError('Enter a valid email address');
    if (!phone.trim()) return setError('Phone is required');
    if (customerType === 'online' && !source) {
      return setError('Please select a source for online customer');
    }
    const firstCar = cars[0];
    if (!firstCar.makeName) return setError('Car 1: Brand is required');
    if (!firstCar.modelName) return setError('Car 1: Model is required');

    setLoading(true);
    try {
      const vehicleName = [firstCar.makeName, firstCar.modelName, firstCar.variantName]
        .filter(Boolean)
        .join(' ');

      const response = await createOrFindCustomer({
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        email: email.trim(),
        phone: phone.trim(),
        vehicleName,
      });

      const created = response.data;
      const carDetails: POSCarDetails[] = cars
        .filter((c) => c.makeName && c.modelName)
        .map((c) => ({
          brand: c.makeName,
          model: [c.modelName, c.variantName].filter(Boolean).join(' '),
          numberPlate: c.numberPlate.trim(),
        }));

      const posCustomer: POSCustomer = {
        _id: created._id,
        firstName: created.firstName,
        lastName: created.lastName || '',
        email: created.email || email.trim(),
        phone: created.phone || phone.trim(),
        carDetails: created.carDetails || carDetails,
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
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const makeOptions: Option[] = makes.map((m) => ({ value: m.id, label: m.name }));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900">Add New Customer</h2>
          <button onClick={onClose} disabled={loading} className="text-gray-400 hover:text-gray-600">
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
              <User className="h-4 w-4 text-[#DC2626]" />
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
                  className="w-4 h-4 text-[#DC2626]"
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
                  className="w-4 h-4 text-[#DC2626]"
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
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as CustomerSource)}
                  className="w-full md:w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#DC2626]"
                  disabled={loading}
                >
                  <option value="">Select source...</option>
                  <option value="facebook">Facebook</option>
                  <option value="tiktok">TikTok</option>
                  <option value="instagram">Instagram</option>
                  <option value="word-of-mouth">Word of Mouth</option>
                </select>
              </div>
            )}
          </div>

          {/* Personal Information */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-[#DC2626]" />
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#DC2626]"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#DC2626]"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#DC2626]"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#DC2626]"
                  placeholder="+92 300 1234567"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Car Details */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Car className="h-4 w-4 text-[#DC2626]" />
                <h3 className="text-sm font-semibold text-gray-900">Car Details</h3>
                <span className="text-xs text-gray-500">
                  ({cars.length} {cars.length === 1 ? 'vehicle' : 'vehicles'})
                </span>
              </div>
              <button
                type="button"
                onClick={addCar}
                disabled={loading}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#DC2626] bg-red-50 rounded hover:bg-red-100 disabled:opacity-50"
              >
                <Plus className="h-3 w-3" /> Add Car
              </button>
            </div>

            <div className="space-y-3">
              {cars.map((car, index) => {
                const makeOpt = makeOptions.find((o) => o.value === car.makeId) || null;
                const modelOptions: Option[] = (modelsByMake[car.makeId] || []).map((m) => ({
                  value: m.id,
                  label: m.name,
                }));
                const modelOpt = modelOptions.find((o) => o.value === car.modelId) || null;
                const variantOptions: Option[] = (variantsByModel[car.modelId] || []).map((v) => ({
                  value: v.id,
                  label: v.name + (v.yearStart ? ` (${v.yearStart}${v.yearEnd ? `–${v.yearEnd}` : '+'})` : ''),
                }));
                const variantOpt = variantOptions.find((o) => o.value === car.variantId) || null;

                return (
                  <div
                    key={car.id}
                    className={`p-3 rounded-lg ${cars.length > 1 ? 'border border-gray-200 bg-white' : ''}`}
                  >
                    {cars.length > 1 && (
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-600">Car {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeCar(car.id)}
                          disabled={loading}
                          className="flex items-center gap-1 px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="h-3 w-3" /> Remove
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Brand <span className="text-red-500">*</span>
                        </label>
                        <Select
                          options={makeOptions}
                          value={makeOpt}
                          onChange={(opt) => handleMakeChange(car.id, opt)}
                          placeholder={makesLoading ? 'Loading brands...' : 'Select brand'}
                          isDisabled={loading || makesLoading}
                          isClearable
                          styles={selectStyles}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Model <span className="text-red-500">*</span>
                        </label>
                        <Select
                          options={modelOptions}
                          value={modelOpt}
                          onChange={(opt) => handleModelChange(car.id, opt)}
                          placeholder={!car.makeId ? 'Pick a brand first' : 'Select model'}
                          isDisabled={loading || !car.makeId}
                          isClearable
                          styles={selectStyles}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Variant <span className="text-gray-400 text-xs">(optional)</span>
                        </label>
                        <Select
                          options={variantOptions}
                          value={variantOpt}
                          onChange={(opt) => handleVariantChange(car.id, opt)}
                          placeholder={!car.modelId ? 'Pick a model first' : variantOptions.length === 0 ? 'No variants' : 'Select variant'}
                          isDisabled={loading || !car.modelId || variantOptions.length === 0}
                          isClearable
                          styles={selectStyles}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Number Plate
                        </label>
                        <input
                          type="text"
                          value={car.numberPlate}
                          onChange={(e) => updateCar(car.id, { numberPlate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#DC2626]"
                          placeholder="ABC-1234"
                          disabled={loading}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </form>

        <div className="p-4 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-[#DC2626] text-white rounded-lg hover:bg-[#B91C1C] disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Creating...
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
