// Customer Selector Modal — two-step flow.
//   Step 1: pick a customer (or walk-in guest).
//   Step 2: pick the vehicle for this invoice, with an "Add Car" inline form
//           that uses the same make/model/variant catalog as /user-detail.
// Returning a vehicle here is what makes the Vehicle Service History report
// accurate: every sale gets pinned to the exact car it was performed on.
'use client';

import { useState, useEffect, useCallback } from 'react';
import { POSCustomer, POSCarDetails } from '../types';
import { Search, X, User, Car, Plus, ArrowLeft, Loader2, Check } from 'lucide-react';
import Select, { type SingleValue, type StylesConfig } from 'react-select';
import toast from 'react-hot-toast';
import { searchCustomers, getAllCustomers, addCarToCustomer } from '../services/posCustomerService';
import AddCustomerModal from './AddCustomerModal';
import {
  listCarMakes,
  listCarModels,
  listCarVariants,
  type CarMake,
  type CarModel,
  type CarVariant,
} from '../services/posCarService';

interface CustomerSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (customer: POSCustomer | null, vehicle?: string) => void;
  currentCustomer?: POSCustomer | null;
}

const getCarsArray = (carDetails?: POSCarDetails | POSCarDetails[]): POSCarDetails[] => {
  if (!carDetails) return [];
  if (Array.isArray(carDetails)) return carDetails;
  return [carDetails];
};

const carLabel = (c: POSCarDetails) =>
  `${c.brand || ''} ${c.model || ''}`.trim() + (c.numberPlate ? ` · ${c.numberPlate}` : '');

const carValue = (c: POSCarDetails) => `${c.brand || ''} ${c.model || ''}`.trim();

type Option = { value: string; label: string };

const selectStyles: StylesConfig<Option, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: 38,
    borderRadius: 8,
    borderColor: state.isFocused ? '#DC2626' : '#e5e7eb',
    boxShadow: state.isFocused ? '0 0 0 1px #FCA5A5' : 'none',
    fontSize: 14,
    '&:hover': { borderColor: state.isFocused ? '#DC2626' : '#d1d5db' },
  }),
  menu: (base) => ({ ...base, zIndex: 100 }),
  option: (base, state) => ({
    ...base,
    fontSize: 13,
    backgroundColor: state.isSelected ? '#DC2626' : state.isFocused ? '#FEE2E2' : 'white',
    color: state.isSelected ? 'white' : '#111827',
  }),
};

export default function CustomerSelector({
  isOpen,
  onClose,
  onSelect,
  currentCustomer,
}: CustomerSelectorProps) {
  const [stage, setStage] = useState<'list' | 'vehicle'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<POSCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);

  // Stage 2 state
  const [picked, setPicked] = useState<POSCustomer | null>(null);
  const [pickedVehicle, setPickedVehicle] = useState<string>('');
  const [showAddCarForm, setShowAddCarForm] = useState(false);

  // Add-car form
  const [makes, setMakes] = useState<CarMake[]>([]);
  const [modelsByMake, setModelsByMake] = useState<Record<string, CarModel[]>>({});
  const [variantsByModel, setVariantsByModel] = useState<Record<string, CarVariant[]>>({});
  const [formMakeId, setFormMakeId] = useState('');
  const [formMakeName, setFormMakeName] = useState('');
  const [formModelId, setFormModelId] = useState('');
  const [formModelName, setFormModelName] = useState('');
  const [formVariantId, setFormVariantId] = useState('');
  const [formVariantName, setFormVariantName] = useState('');
  const [formPlate, setFormPlate] = useState('');
  const [savingCar, setSavingCar] = useState(false);

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

  // Reset everything when the modal opens/closes.
  useEffect(() => {
    if (!isOpen) return;
    setStage('list');
    setPicked(null);
    setPickedVehicle('');
    setShowAddCarForm(false);
    setFormMakeId(''); setFormMakeName('');
    setFormModelId(''); setFormModelName('');
    setFormVariantId(''); setFormVariantName('');
    setFormPlate('');
    loadCustomers();
  }, [isOpen, loadCustomers]);

  useEffect(() => {
    if (!isOpen || stage !== 'list') return;
    if (searchQuery.trim()) {
      const t = setTimeout(() => handleSearch(searchQuery), 250);
      return () => clearTimeout(t);
    }
    loadCustomers();
  }, [searchQuery, isOpen, stage, handleSearch, loadCustomers]);

  // Lazy-load the car catalog the first time the Add Car form opens.
  useEffect(() => {
    if (!showAddCarForm || makes.length > 0) return;
    listCarMakes()
      .then((m) => setMakes(m))
      .catch(() => toast.error('Failed to load car brands'));
  }, [showAddCarForm, makes.length]);

  const pickCustomer = (customer: POSCustomer) => {
    setPicked(customer);
    const cars = getCarsArray(customer.carDetails);
    // Auto-select when there's exactly one car; the user can still change it.
    setPickedVehicle(cars.length === 1 ? carValue(cars[0]) : '');
    setStage('vehicle');
    setShowAddCarForm(false);
  };

  const handleGuest = () => {
    onSelect(null);
    onClose();
  };

  const handleCustomerCreated = (newCustomer: POSCustomer) => {
    setShowAddCustomerModal(false);
    // Jump straight to the vehicle-pick stage for the freshly created customer.
    pickCustomer(newCustomer);
  };

  const confirmSelection = () => {
    if (!picked) return;
    onSelect(picked, pickedVehicle || undefined);
    onClose();
  };

  // -- Add Car form handlers --

  const handleMakeChange = async (opt: SingleValue<Option>) => {
    const make = makes.find((m) => m.id === opt?.value);
    setFormMakeId(make?.id || '');
    setFormMakeName(make?.name || '');
    setFormModelId(''); setFormModelName('');
    setFormVariantId(''); setFormVariantName('');
    if (make && !modelsByMake[make.id]) {
      try {
        const list = await listCarModels(make.id);
        setModelsByMake((p) => ({ ...p, [make.id]: list }));
      } catch {
        toast.error('Failed to load car models');
      }
    }
  };

  const handleModelChange = async (opt: SingleValue<Option>) => {
    const list = modelsByMake[formMakeId] || [];
    const model = list.find((m) => m.id === opt?.value);
    setFormModelId(model?.id || '');
    setFormModelName(model?.name || '');
    setFormVariantId(''); setFormVariantName('');
    if (model && !variantsByModel[model.id]) {
      try {
        const v = await listCarVariants(model.id);
        setVariantsByModel((p) => ({ ...p, [model.id]: v }));
      } catch {
        // silent — variants are optional
      }
    }
  };

  const handleVariantChange = (opt: SingleValue<Option>) => {
    const list = variantsByModel[formModelId] || [];
    const variant = list.find((v) => v.id === opt?.value);
    setFormVariantId(variant?.id || '');
    setFormVariantName(variant?.name || '');
  };

  const saveNewCar = async () => {
    if (!picked) return;
    if (!formMakeName) return toast.error('Pick a brand');
    if (!formModelName) return toast.error('Pick a model');

    const model = [formModelName, formVariantName].filter(Boolean).join(' ');
    const plate = formPlate.trim();

    // Local dedup check — bail before hitting the API for a better UX.
    const existingCars = getCarsArray(picked.carDetails);
    const duplicate = existingCars.find((c) => {
      const sameBrand = (c.brand || '').toLowerCase() === formMakeName.toLowerCase();
      const sameModel = (c.model || '').toLowerCase() === model.toLowerCase();
      const samePlate = plate && (c.numberPlate || '').toLowerCase() === plate.toLowerCase();
      if (samePlate) return true;
      if (sameBrand && sameModel) {
        if (plate && (c.numberPlate || '').trim()) return samePlate;
        return true;
      }
      return false;
    });
    if (duplicate) {
      toast.error(
        `This car is already on ${picked.firstName}'s garage${
          duplicate.numberPlate ? ` (plate: ${duplicate.numberPlate})` : ''
        }.`,
      );
      return;
    }

    try {
      setSavingCar(true);
      const updated = await addCarToCustomer(picked._id, {
        brand: formMakeName,
        model,
        numberPlate: formPlate.trim(),
      });
      // Replace the picked customer with the fresh record so the new car
      // shows up in the list, and auto-select it for this invoice.
      setPicked({
        ...picked,
        carDetails: Array.isArray(updated.carDetails) ? updated.carDetails : picked.carDetails,
      });
      const addedValue = [formMakeName, model].filter(Boolean).join(' ').trim();
      setPickedVehicle(addedValue);
      setShowAddCarForm(false);
      setFormMakeId(''); setFormMakeName('');
      setFormModelId(''); setFormModelName('');
      setFormVariantId(''); setFormVariantName('');
      setFormPlate('');
      toast.success('Car added to customer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add car');
    } finally {
      setSavingCar(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {stage === 'vehicle' && (
              <button
                onClick={() => {
                  setStage('list');
                  setPicked(null);
                  setShowAddCarForm(false);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
                title="Back"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            )}
            <h2 className="text-xl font-bold text-gray-900">
              {stage === 'list' ? 'Select Customer' : 'Select Vehicle for Invoice'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {stage === 'list' && (
              <button
                onClick={() => setShowAddCustomerModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#DC2626] rounded-lg hover:bg-[#b91c1c]"
              >
                <Plus className="h-4 w-4" />
                Add Customer
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {stage === 'list' ? (
          <ListStage
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            customers={customers}
            loading={loading}
            currentCustomer={currentCustomer}
            onPick={pickCustomer}
            onGuest={handleGuest}
          />
        ) : (
          picked && (
            <VehicleStage
              picked={picked}
              pickedVehicle={pickedVehicle}
              setPickedVehicle={setPickedVehicle}
              showAddCarForm={showAddCarForm}
              setShowAddCarForm={setShowAddCarForm}
              makes={makes}
              modelsByMake={modelsByMake}
              variantsByModel={variantsByModel}
              formMakeId={formMakeId}
              formModelId={formModelId}
              formVariantId={formVariantId}
              formPlate={formPlate}
              setFormPlate={setFormPlate}
              onMakeChange={handleMakeChange}
              onModelChange={handleModelChange}
              onVariantChange={handleVariantChange}
              onSaveCar={saveNewCar}
              savingCar={savingCar}
              onConfirm={confirmSelection}
              onSkip={() => {
                onSelect(picked);
                onClose();
              }}
            />
          )
        )}
      </div>

      <AddCustomerModal
        isOpen={showAddCustomerModal}
        onClose={() => setShowAddCustomerModal(false)}
        onCustomerCreated={handleCustomerCreated}
      />
    </div>
  );
}

// ---------------- Stage 1: customer list ----------------

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
            placeholder="Search by name, phone, car brand, model, or plate number..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#DC2626] focus:border-transparent"
            autoFocus
          />
        </div>
      </div>

      <div className="p-4 border-b border-gray-200">
        <button
          onClick={onGuest}
          className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
            !currentCustomer ? 'border-[#DC2626] bg-red-50' : 'border-gray-200 hover:border-[#DC2626]/50'
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
            <Loader2 className="h-8 w-8 animate-spin text-[#DC2626] mx-auto" />
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
                    ? 'border-[#DC2626] bg-red-50'
                    : 'border-gray-200 hover:border-[#DC2626]/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#DC2626]/10 rounded-full flex items-center justify-center">
                    <span className="text-[#DC2626] font-semibold text-lg">
                      {customer.firstName?.charAt(0) || 'C'}
                      {customer.lastName?.charAt(0) || ''}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900">
                      {customer.firstName} {customer.lastName}
                    </div>
                    {(() => {
                      const cars = getCarsArray(customer.carDetails);
                      if (cars.length === 0) return null;
                      return (
                        <div className="space-y-0.5 mt-1">
                          {cars.map((car, index) => (
                            <div key={index} className="flex items-center gap-1 text-sm text-[#DC2626] font-medium">
                              <Car className="h-3.5 w-3.5 flex-shrink-0" />
                              <span>
                                {car.brand} {car.model}
                                {car.numberPlate && (
                                  <span className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-700">
                                    {car.numberPlate}
                                  </span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
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

// ---------------- Stage 2: vehicle pick + add ----------------

function VehicleStage({
  picked,
  pickedVehicle,
  setPickedVehicle,
  showAddCarForm,
  setShowAddCarForm,
  makes,
  modelsByMake,
  variantsByModel,
  formMakeId,
  formModelId,
  formVariantId,
  formPlate,
  setFormPlate,
  onMakeChange,
  onModelChange,
  onVariantChange,
  onSaveCar,
  savingCar,
  onConfirm,
  onSkip,
}: {
  picked: POSCustomer;
  pickedVehicle: string;
  setPickedVehicle: (v: string) => void;
  showAddCarForm: boolean;
  setShowAddCarForm: (v: boolean) => void;
  makes: CarMake[];
  modelsByMake: Record<string, CarModel[]>;
  variantsByModel: Record<string, CarVariant[]>;
  formMakeId: string;
  formModelId: string;
  formVariantId: string;
  formPlate: string;
  setFormPlate: (v: string) => void;
  onMakeChange: (opt: SingleValue<Option>) => void;
  onModelChange: (opt: SingleValue<Option>) => void;
  onVariantChange: (opt: SingleValue<Option>) => void;
  onSaveCar: () => void;
  savingCar: boolean;
  onConfirm: () => void;
  onSkip: () => void;
}) {
  const cars = getCarsArray(picked.carDetails);
  const makeOptions: Option[] = makes.map((m) => ({ value: m.id, label: m.name }));
  const modelOptions: Option[] = (modelsByMake[formMakeId] || []).map((m) => ({
    value: m.id,
    label: m.name,
  }));
  const variantOptions: Option[] = (variantsByModel[formModelId] || []).map((v) => ({
    value: v.id,
    label: v.name + (v.yearStart ? ` (${v.yearStart}${v.yearEnd ? `–${v.yearEnd}` : '+'})` : ''),
  }));

  return (
    <>
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#DC2626]/10 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-[#DC2626] font-semibold">
              {picked.firstName?.charAt(0) || 'C'}
              {picked.lastName?.charAt(0) || ''}
            </span>
          </div>
          <div>
            <div className="font-semibold text-gray-900">
              {picked.firstName} {picked.lastName}
            </div>
            <div className="text-xs text-gray-500">
              {picked.phone}
              {picked.email && ` · ${picked.email}`}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {cars.length === 0 && !showAddCarForm && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            This customer has no cars on file. Add one to tag this sale for service history.
          </div>
        )}

        {cars.length > 0 && (
          <div className="space-y-2">
            {cars.map((car, i) => {
              const value = carValue(car);
              const isPicked = pickedVehicle === value;
              return (
                <button
                  key={`${car.brand}-${car.model}-${car.numberPlate}-${i}`}
                  onClick={() => setPickedVehicle(value)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                    isPicked
                      ? 'border-[#DC2626] bg-red-50'
                      : 'border-gray-200 hover:border-[#DC2626]/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isPicked ? 'bg-[#DC2626] text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      <Car className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {car.brand} {car.model}
                      </div>
                      {car.numberPlate && (
                        <div className="text-xs text-gray-500 mt-0.5">Plate: {car.numberPlate}</div>
                      )}
                    </div>
                    {isPicked && <Check className="h-5 w-5 text-[#DC2626]" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {!showAddCarForm ? (
          <button
            onClick={() => setShowAddCarForm(true)}
            className="w-full text-left p-3 rounded-lg border-2 border-dashed border-gray-300 hover:border-[#DC2626] hover:bg-red-50 transition-colors flex items-center gap-3 text-sm text-gray-600"
          >
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <Plus className="h-5 w-5 text-gray-500" />
            </div>
            <span className="font-medium">Add New Car to {picked.firstName}</span>
          </button>
        ) : (
          <div className="p-3 rounded-lg border border-gray-200 bg-white space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                <Car className="h-4 w-4 text-[#DC2626]" /> Add Car
              </span>
              <button
                onClick={() => setShowAddCarForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Brand <span className="text-red-500">*</span>
                </label>
                <Select
                  options={makeOptions}
                  value={makeOptions.find((o) => o.value === formMakeId) || null}
                  onChange={onMakeChange}
                  placeholder={makes.length === 0 ? 'Loading…' : 'Select brand'}
                  isDisabled={savingCar || makes.length === 0}
                  isClearable
                  styles={selectStyles}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Model <span className="text-red-500">*</span>
                </label>
                <Select
                  options={modelOptions}
                  value={modelOptions.find((o) => o.value === formModelId) || null}
                  onChange={onModelChange}
                  placeholder={!formMakeId ? 'Pick a brand first' : 'Select model'}
                  isDisabled={savingCar || !formMakeId}
                  isClearable
                  styles={selectStyles}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Variant <span className="text-gray-400 text-[10px]">(optional)</span>
                </label>
                <Select
                  options={variantOptions}
                  value={variantOptions.find((o) => o.value === formVariantId) || null}
                  onChange={onVariantChange}
                  placeholder={
                    !formModelId
                      ? 'Pick a model first'
                      : variantOptions.length === 0
                      ? 'No variants'
                      : 'Select variant'
                  }
                  isDisabled={savingCar || !formModelId || variantOptions.length === 0}
                  isClearable
                  styles={selectStyles}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Number Plate</label>
                <input
                  type="text"
                  value={formPlate}
                  onChange={(e) => setFormPlate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#DC2626]"
                  placeholder="ABC-1234"
                  disabled={savingCar}
                />
              </div>
            </div>
            <button
              onClick={onSaveCar}
              disabled={savingCar}
              className="w-full px-3 py-2 text-sm font-medium text-white bg-[#DC2626] rounded-lg hover:bg-[#b91c1c] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {savingCar ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Save Car
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-200 flex items-center justify-between gap-2">
        <button
          onClick={onSkip}
          className="px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          Skip — no vehicle
        </button>
        <button
          onClick={onConfirm}
          disabled={!pickedVehicle}
          className="px-4 py-2 text-sm font-medium text-white bg-[#DC2626] rounded-lg hover:bg-[#b91c1c] disabled:opacity-50 flex items-center gap-1.5"
        >
          <Check className="h-4 w-4" />
          Use This Vehicle
        </button>
      </div>
    </>
  );
}
