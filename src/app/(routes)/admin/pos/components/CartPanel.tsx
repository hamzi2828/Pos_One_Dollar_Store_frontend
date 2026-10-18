// Cart Panel Component
'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { POSCart, POSCustomer, POSTax, POSCarDetails } from '../types';
import CartItem from './CartItem';
import { ShoppingCart, Trash2, Archive, ChevronDown, Check, Receipt, Car, Percent, X, Wrench, Loader2 } from 'lucide-react';
import { getCurrencySymbol } from '../utils/currency';

// Helper to get cars array
const getCarsArray = (carDetails?: POSCarDetails | POSCarDetails[]): POSCarDetails[] => {
  if (!carDetails) return [];
  if (Array.isArray(carDetails)) return carDetails;
  return [carDetails];
};

interface CartPanelProps {
  cart: POSCart;
  customer?: POSCustomer | null;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onUpdateUnitPrice?: (itemId: string, newPrice: number, minPrice: number) => void;
  onClearCart: () => void;
  onHoldCart: () => void;
  onCheckout: () => void;
  onSelectCustomer: () => void;
  currency?: string;
  availableTaxes?: POSTax[];
  selectedTaxIds?: string[];
  onTaxSelectionChange?: (taxIds: string[]) => void;
  onApplyDiscount?: (discount: number, discountType: 'fixed' | 'percentage' | null, discountReason?: string) => void;
  onAddCustomItem?: (
    description: string,
    salePrice: number,
    costPrice?: number
  ) => void;
  serviceVehicle?: string;
  onSelectVehicle?: (vehicle: string) => void;
  /** Hold Order is saving. */
  holding?: boolean;
  /** Payment window is open / payment is going through. */
  paying?: boolean;
}

export default function CartPanel({
  cart,
  customer,
  onUpdateQuantity,
  onRemoveItem,
  onUpdateUnitPrice,
  onClearCart,
  onHoldCart,
  onCheckout,
  onSelectCustomer,
  currency = 'PKR',
  availableTaxes = [],
  selectedTaxIds = [],
  onTaxSelectionChange,
  onApplyDiscount,
  onAddCustomItem,
  serviceVehicle,
  onSelectVehicle,
  holding = false,
  paying = false,
}: CartPanelProps) {
  const busy = holding || paying;
  const symbol = getCurrencySymbol(currency);
  const isEmpty = cart.items.length === 0;
  const [showTaxDropdown, setShowTaxDropdown] = useState(false);
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountValue, setDiscountValue] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customDescription, setCustomDescription] = useState('');
  const [customSalePrice, setCustomSalePrice] = useState('');
  const [customCostPrice, setCustomCostPrice] = useState('');

  const handleTaxToggle = (taxId: string) => {
    if (!onTaxSelectionChange) return;

    if (selectedTaxIds.includes(taxId)) {
      onTaxSelectionChange(selectedTaxIds.filter(id => id !== taxId));
    } else {
      onTaxSelectionChange([...selectedTaxIds, taxId]);
    }
  };

  const selectedTaxNames = availableTaxes
    .filter(t => selectedTaxIds.includes(t.taxId))
    .map(t => t.name)
    .join(', ');

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Current Order
          </h2>
          {!isEmpty && (
            <button
              onClick={onClearCart}
              disabled={busy}
              className="text-red-500 hover:text-red-700 p-1 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Clear cart"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Customer Selection */}
        <button
          onClick={onSelectCustomer}
          className="w-full text-left px-3 py-2 border border-gray-300 rounded-lg hover:border-[#DC2626] transition-colors"
        >
          <div className="text-xs text-gray-500 mb-0.5">Customer</div>
          <div className="text-sm font-medium text-gray-900">
            {customer
              ? `${customer.firstName} ${customer.lastName}`
              : 'Walk-in Customer (Guest)'}
          </div>
          {(() => {
            if (!customer) return null;
            const cars = getCarsArray(customer.carDetails);
            if (cars.length === 0) return null;
            return (
              <div className="space-y-0.5 mt-1">
                {cars.map((car, index) => (
                  <div key={index} className="flex items-center gap-1 text-xs text-[#DC2626]">
                    <Car className="h-3 w-3 flex-shrink-0" />
                    <span>
                      {car.brand} {car.model}
                      {car.numberPlate && (
                        <span className="ml-1 text-gray-600">({car.numberPlate})</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
          {customer?.phone && (
            <div className="text-xs text-gray-500 mt-0.5">{customer.phone}</div>
          )}
        </button>

        {/* Service Vehicle selector — tags the sale (and every item on
            it) to a specific car. Shows when the customer has known cars. */}
        {customer && onSelectVehicle && (() => {
          const cars = getCarsArray(customer.carDetails);
          if (cars.length === 0) return null;
          const options = cars.map((c) => ({
            key: [c.brand, c.model, c.numberPlate].filter(Boolean).join(' | '),
            label: `${c.brand || ''} ${c.model || ''}`.trim() + (c.numberPlate ? ` (${c.numberPlate})` : ''),
            value: `${c.brand || ''} ${c.model || ''}`.trim(),
          }));
          return (
            <div className="mt-2">
              <label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                <Car className="h-3 w-3 text-[#DC2626]" /> Service Vehicle
              </label>
              <select
                value={serviceVehicle || ''}
                onChange={(e) => onSelectVehicle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#DC2626]"
              >
                <option value="">— pick a vehicle —</option>
                {options.map((o) => (
                  <option key={o.key} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">
                Items on this order will be tagged to this vehicle.
              </p>
            </div>
          );
        })()}
      </div>

      {/* Add Custom Item */}
      {onAddCustomItem && (
        <div className="px-4 pt-3 border-b border-gray-200 pb-3">
          {!showCustomForm ? (
            <button
              onClick={() => setShowCustomForm(true)}
              className="w-full text-left px-3 py-2 border border-dashed border-gray-300 rounded-lg hover:border-[#DC2626] hover:bg-red-50 transition-colors flex items-center gap-2 text-sm text-gray-600"
            >
              <Wrench className="h-4 w-4" />
              Add Custom
            </button>
          ) : (
            <div className="space-y-2 bg-gray-50 p-3 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Wrench className="h-4 w-4" /> Add Custom
                </span>
                <button
                  onClick={() => {
                    setShowCustomForm(false);
                    setCustomDescription('');
                    setCustomSalePrice('');
                    setCustomCostPrice('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              </div>
              <input
                type="text"
                placeholder="Description (e.g. Screen Repair, Item Name)"
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                className="text-sm border rounded px-2 py-1.5 w-full"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder={`Sale Price (${symbol})`}
                  value={customSalePrice}
                  onChange={(e) => setCustomSalePrice(e.target.value)}
                  className="text-sm border rounded px-2 py-1.5 w-full"
                />
                <input
                  type="number"
                  min="0"
                  placeholder={`Cost Price (${symbol})`}
                  value={customCostPrice}
                  onChange={(e) => setCustomCostPrice(e.target.value)}
                  className="text-sm border rounded px-2 py-1.5 w-full text-orange-600"
                />
              </div>
              <p className="text-xs text-gray-500">Cost price is optional — used for margin reporting</p>


              {customer && getCarsArray(customer.carDetails).length > 0 && !serviceVehicle && (
                <p className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded px-2 py-1">
                  Pick a Service Vehicle above so this item is tracked in history.
                </p>
              )}
              <button
                onClick={() => {
                  const salePrice = parseFloat(customSalePrice);
                  const costPrice = customCostPrice ? parseFloat(customCostPrice) : undefined;
                  if (!customDescription.trim()) { toast.error('Please enter a description'); return; }
                  if (!salePrice || salePrice <= 0) { toast.error('Please enter a valid sale price'); return; }
                  onAddCustomItem(customDescription.trim(), salePrice, costPrice);
                  setShowCustomForm(false);
                  setCustomDescription('');
                  setCustomSalePrice('');
                  setCustomCostPrice('');
                }}
                className="text-sm bg-[#DC2626] text-white px-3 py-1.5 rounded hover:bg-[#b91c1c] w-full"
              >
                Add to Order
              </button>
            </div>
          )}
        </div>
      )}

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-4">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <ShoppingCart className="h-16 w-16 mb-4" />
            <p className="text-center">Cart is empty</p>
            <p className="text-sm text-center mt-2">
              Add products to start a new order
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {cart.items.map((item) => (
              <CartItem
                key={item.id}
                item={item}
                onUpdateQuantity={onUpdateQuantity}
                onRemove={onRemoveItem}
                onUpdateUnitPrice={onUpdateUnitPrice}
                currency={currency}
              />
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      {!isEmpty && (
        <div className="border-t border-gray-200 p-4 space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">{symbol}{cart.subtotal.toFixed(2)}</span>
            </div>

            {/* Tax Selector */}
            {availableTaxes.length > 0 && onTaxSelectionChange ? (
              <div className="relative">
                <button
                  onClick={() => setShowTaxDropdown(!showTaxDropdown)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">
                      {selectedTaxIds.length > 0
                        ? selectedTaxNames
                        : 'Select Tax'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{symbol}{cart.tax.toFixed(2)}</span>
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showTaxDropdown ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Dropdown */}
                {showTaxDropdown && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                    {availableTaxes.length === 0 ? (
                      <div className="p-3 text-sm text-gray-500 text-center">
                        No taxes configured
                      </div>
                    ) : (
                      <div className="py-1">
                        {availableTaxes.map((tax) => (
                          <button
                            key={tax.taxId}
                            onClick={() => handleTaxToggle(tax.taxId)}
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                selectedTaxIds.includes(tax.taxId)
                                  ? 'bg-[#DC2626] border-[#DC2626]'
                                  : 'border-gray-300'
                              }`}>
                                {selectedTaxIds.includes(tax.taxId) && (
                                  <Check className="h-3 w-3 text-white" />
                                )}
                              </div>
                              <div className="text-left">
                                <div className="text-sm font-medium text-gray-900">{tax.name}</div>
                                {tax.description && (
                                  <div className="text-xs text-gray-500">{tax.description}</div>
                                )}
                              </div>
                            </div>
                            <span className="text-sm font-medium text-gray-600">
                              {tax.rate}%
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="border-t border-gray-100 p-2">
                      <button
                        onClick={() => setShowTaxDropdown(false)}
                        className="w-full px-3 py-1.5 text-sm text-[#DC2626] hover:bg-red-50 rounded transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Fallback for legacy single tax display
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  Tax ({cart.taxRate}%)
                </span>
                <span className="font-medium">{symbol}{cart.tax.toFixed(2)}</span>
              </div>
            )}

            {/* Show applied taxes breakdown if multiple */}
            {cart.appliedTaxes && cart.appliedTaxes.length > 1 && (
              <div className="pl-4 space-y-1 border-l-2 border-gray-100">
                {cart.appliedTaxes.map((appliedTax) => (
                  <div key={appliedTax.taxId} className="flex justify-between text-xs text-gray-500">
                    <span>{appliedTax.name} ({appliedTax.rate}%)</span>
                    <span>{symbol}{appliedTax.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Discount Section */}
            {onApplyDiscount && (
              <div className="space-y-2">
                {!showDiscountInput && cart.discount === 0 ? (
                  <button
                    onClick={() => setShowDiscountInput(true)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                  >
                    <Percent size={14} />
                    Add Discount
                  </button>
                ) : showDiscountInput ? (
                  <div className="space-y-2 bg-gray-50 p-2 rounded-lg">
                    <div className="flex items-center gap-2">
                      <select
                        value={discountType}
                        onChange={(e) => setDiscountType(e.target.value as 'fixed' | 'percentage')}
                        className="text-sm border rounded px-2 py-1"
                      >
                        <option value="fixed">Fixed ({symbol})</option>
                        <option value="percentage">Percentage (%)</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        className="text-sm border rounded px-2 py-1 w-24"
                      />
                      <button
                        onClick={() => { setShowDiscountInput(false); setDiscountValue(''); setDiscountReason(''); }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Reason (optional)"
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                      className="text-sm border rounded px-2 py-1 w-full"
                    />
                    <button
                      onClick={() => {
                        const val = parseFloat(discountValue) || 0;
                        const discount = discountType === 'percentage'
                          ? (cart.subtotal * Math.min(val, 100)) / 100
                          : Math.min(val, cart.subtotal);
                        onApplyDiscount(discount, discountType, discountReason);
                        setShowDiscountInput(false);
                      }}
                      className="text-sm bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 w-full"
                    >
                      Apply Discount
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-between text-sm text-green-600">
                    <span className="flex items-center gap-1">
                      Discount
                      <button
                        onClick={() => { onApplyDiscount(0, null); setDiscountValue(''); setDiscountReason(''); }}
                        className="text-red-400 hover:text-red-600"
                        title="Remove discount"
                      >
                        <X size={14} />
                      </button>
                    </span>
                    <span className="font-medium">-{symbol}{cart.discount.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total</span>
              <span>{symbol}{cart.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              onClick={onCheckout}
              disabled={busy}
              aria-busy={paying}
              className="w-full bg-[#DC2626] text-white py-3 rounded-lg font-semibold hover:bg-[#b91c1c] transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-[#DC2626]"
            >
              {paying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing payment…
                </>
              ) : (
                'Process Payment'
              )}
            </button>
            <button
              onClick={onHoldCart}
              disabled={busy}
              aria-busy={holding}
              className="w-full border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-white"
            >
              {holding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Holding order…
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4" />
                  Hold Order
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
