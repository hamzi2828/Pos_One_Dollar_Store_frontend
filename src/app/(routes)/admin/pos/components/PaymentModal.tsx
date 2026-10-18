// Payment Modal Component
'use client';

import { useState, useEffect, useRef } from 'react';
import { PaymentMethodType, POSCart, POSCustomer, CustomerInfo } from '../types';
import { X, CreditCard, Banknote, Building2, Upload, Loader2, Check, AlertCircle, User, Phone } from 'lucide-react';
import { uploadBankTransferScreenshot } from '../services/posUploadService';
import { getCurrencySymbol } from '../utils/currency';

interface PaymentModalProps {
  isOpen: boolean;
  cart: POSCart;
  customer?: POSCustomer | null;
  onClose: () => void;
  onConfirm: (
    paymentMethod: PaymentMethodType,
    cashAmount?: number,
    bankTransferScreenshot?: string,
    isPartialPayment?: boolean,
    paidAmount?: number,
    customerInfo?: CustomerInfo
  ) => void | Promise<void>;
  currency?: string;
  /** Payment is being saved by the page (keeps the window locked). */
  processing?: boolean;
}

export default function PaymentModal({
  isOpen,
  cart,
  customer,
  onClose,
  onConfirm,
  currency = 'PKR',
  processing: processingFromPage = false,
}: PaymentModalProps) {
  const symbol = getCurrencySymbol(currency);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('cash');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [localProcessing, setProcessing] = useState(false);
  const processing = localProcessing || processingFromPage;
  // Blocks a second click before React has re-rendered the disabled button.
  const confirmLock = useRef(false);
  const [bankScreenshotFile, setBankScreenshotFile] = useState<File | null>(null);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCashReceived('');
      setBankScreenshotFile(null);
      setScreenshotError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const cashAmount = parseFloat(cashReceived) || 0;
  const change = cashAmount - cart.total;
  // Partial payment: when paid amount is less than total (including 0)
  const isPartialPayment = (paymentMethod === 'cash' || paymentMethod === 'bank_transfer') && cashAmount < cart.total;
  const pendingAmount = isPartialPayment ? cart.total - cashAmount : 0;

  // For partial payments (including 0), require a customer to be selected
  const canDoPartialPayment = isPartialPayment && customer;

  // Allow 0 payment if customer is selected (full pending)
  const isValidCash = paymentMethod === 'cash' && (cashAmount >= cart.total || !!canDoPartialPayment);
  const isValidBankTransfer = paymentMethod === 'bank_transfer' && (cashAmount >= cart.total || !!canDoPartialPayment);
  const isValidCard = paymentMethod === 'card';
  const canProceed = isValidCard || isValidCash || isValidBankTransfer;

  const handleConfirm = async () => {
    if (!canProceed || confirmLock.current) return;
    confirmLock.current = true;
    setProcessing(true);
    setScreenshotError(null);

    try {
      let screenshotUrl: string | undefined;
      if (paymentMethod === 'bank_transfer' && bankScreenshotFile) {
        try {
          const result = await uploadBankTransferScreenshot(bankScreenshotFile);
          screenshotUrl = result.url;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to upload screenshot';
          setScreenshotError(msg);
          setProcessing(false);
          confirmLock.current = false;
          return;
        }
      }

      // Build customer info from selected customer if available
      let customerInfo: CustomerInfo | undefined;
      if (customer) {
        customerInfo = {
          name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
          phone: customer.phone || '',
          customerType: customer.customerType,
          source: customer.source
        };
      }

      await onConfirm(
        paymentMethod,
        (paymentMethod === 'cash' || paymentMethod === 'bank_transfer') ? cashAmount : undefined,
        screenshotUrl,
        isPartialPayment,
        isPartialPayment ? cashAmount : undefined,
        customerInfo
      );
    } finally {
      confirmLock.current = false;
      setProcessing(false);
    }
  };

  const handleScreenshotSelect = (file: File | null) => {
    if (!file) return;
    setScreenshotError(null);
    if (!file.type.startsWith('image/')) { setScreenshotError('Please select an image file'); return; }
    if (file.size > 10 * 1024 * 1024) { setScreenshotError('File must be less than 10MB'); return; }
    setBankScreenshotFile(file);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Payment</h2>
            <span className="text-xl font-bold text-green-600">{symbol}{cart.total.toFixed(2)}</span>
            {customer && <span className="text-xs text-gray-500 ml-2">({customer.firstName} {customer.lastName})</span>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={processing}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <fieldset disabled={processing} aria-busy={processing} className="p-4 space-y-4 min-w-0 disabled:[&_button]:cursor-not-allowed">
          {/* Customer Details (Read-only) */}
          {customer ? (
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                <User className="h-3 w-3" />
                Customer Details
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="font-medium text-gray-900">{customer.firstName} {customer.lastName}</span>
                  {customer.customerType && (
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                      customer.customerType === 'online'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {customer.customerType === 'online' ? 'Online' : 'Walk-in'}
                    </span>
                  )}
                  {customer.customerType === 'online' && customer.source && (
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                      customer.source === 'facebook' ? 'bg-blue-100 text-blue-800' :
                      customer.source === 'tiktok' ? 'bg-gray-900 text-white' :
                      customer.source === 'instagram' ? 'bg-pink-100 text-pink-800' :
                      customer.source === 'word-of-mouth' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {customer.source === 'facebook' ? 'Facebook' :
                       customer.source === 'tiktok' ? 'TikTok' :
                       customer.source === 'instagram' ? 'Instagram' :
                       customer.source === 'word-of-mouth' ? 'Word of Mouth' :
                       customer.source}
                    </span>
                  )}
                </div>
                {customer.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-700">{customer.phone}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-center">
              <p className="text-sm text-yellow-700">No customer selected</p>
              <p className="text-xs text-yellow-600">Walk-in customer checkout</p>
            </div>
          )}

          {/* Payment Methods */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setPaymentMethod('cash')}
              className={`p-2 rounded-lg border-2 transition-colors ${
                paymentMethod === 'cash' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'
              }`}
            >
              <Banknote className="h-5 w-5 mx-auto text-gray-700" />
              <div className="text-xs font-medium mt-1">Cash</div>
            </button>
            <button
              onClick={() => setPaymentMethod('card')}
              className={`p-2 rounded-lg border-2 transition-colors ${
                paymentMethod === 'card' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <CreditCard className="h-5 w-5 mx-auto text-gray-700" />
              <div className="text-xs font-medium mt-1">Card</div>
            </button>
            <button
              onClick={() => setPaymentMethod('bank_transfer')}
              className={`p-2 rounded-lg border-2 transition-colors ${
                paymentMethod === 'bank_transfer' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'
              }`}
            >
              <Building2 className="h-5 w-5 mx-auto text-gray-700" />
              <div className="text-xs font-medium mt-1">Bank</div>
            </button>
          </div>

          {/* Cash Payment */}
          {paymentMethod === 'cash' && (
            <div className="space-y-3">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">{symbol}</span>
                <input
                  type="number"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-lg"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {customer && (
                  <button
                    onClick={() => setCashReceived('0')}
                    className="py-1.5 text-xs bg-orange-100 text-orange-700 border border-orange-300 rounded hover:bg-orange-200"
                  >
                    Full Pending
                  </button>
                )}
                {[cart.total, Math.ceil(cart.total / 10) * 10, Math.ceil(cart.total / 50) * 50, Math.ceil(cart.total / 100) * 100].slice(0, customer ? 4 : 4).map((amt, i) => (
                  <button
                    key={i}
                    onClick={() => setCashReceived(amt.toString())}
                    className="py-1.5 text-xs border border-gray-300 rounded hover:bg-blue-50 hover:border-blue-400"
                  >
                    {symbol}{amt.toFixed(0)}
                  </button>
                ))}
              </div>
              {cashAmount >= cart.total ? (
                cashAmount > 0 && (
                  <div className="flex justify-between items-center bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <span className="text-sm text-green-700">Change:</span>
                    <span className="text-lg font-bold text-green-700">{symbol}{change.toFixed(2)}</span>
                  </div>
                )
              ) : (
                <div className={`rounded-lg px-3 py-2 ${customer ? 'bg-orange-50 border border-orange-200' : 'bg-red-50 border border-red-300'}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-green-600">Paid: {symbol}{cashAmount.toFixed(2)}</span>
                    <span className="text-sm font-bold text-red-600">Pending: {symbol}{pendingAmount.toFixed(2)}</span>
                  </div>
                  {!customer ? (
                    <div className="mt-2 p-2 bg-red-100 rounded text-center">
                      <AlertCircle className="h-4 w-4 text-red-600 mx-auto mb-1" />
                      <p className="text-xs text-red-700 font-medium">Customer Required for Partial Payment</p>
                      <p className="text-xs text-red-600">Please select a customer first</p>
                    </div>
                  ) : (
                    <p className="text-xs text-orange-600 mt-1">Pending saved under {customer.firstName} {customer.lastName}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Card Payment */}
          {paymentMethod === 'card' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              Take the card payment on the card machine. Full amount: {symbol}{cart.total.toFixed(2)}
            </div>
          )}

          {/* Bank Transfer */}
          {paymentMethod === 'bank_transfer' && (
            <div className="space-y-3">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">{symbol}</span>
                <input
                  type="number"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder={cart.total.toFixed(2)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-lg"
                />
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {customer && (
                  <button
                    onClick={() => setCashReceived('0')}
                    className="py-1.5 text-xs bg-orange-100 text-orange-700 border border-orange-300 rounded hover:bg-orange-200"
                  >
                    Full Pending
                  </button>
                )}
                <button onClick={() => setCashReceived(cart.total.toFixed(2))} className="py-1.5 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200">Exact</button>
                {[Math.ceil(cart.total / 10) * 10, Math.ceil(cart.total / 50) * 50, Math.ceil(cart.total / 100) * 100].slice(0, customer ? 2 : 3).map((amt) => (
                  <button key={amt} onClick={() => setCashReceived(amt.toString())} className="py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50">{symbol}{amt}</button>
                ))}
              </div>
              {cashAmount < cart.total && (
                <div className={`rounded-lg px-3 py-2 ${customer ? 'bg-orange-50 border border-orange-200' : 'bg-red-50 border border-red-300'}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-green-600">Paid: {symbol}{cashAmount.toFixed(2)}</span>
                    <span className="text-sm font-bold text-red-600">Pending: {symbol}{pendingAmount.toFixed(2)}</span>
                  </div>
                  {!customer ? (
                    <div className="mt-2 p-2 bg-red-100 rounded text-center">
                      <AlertCircle className="h-4 w-4 text-red-600 mx-auto mb-1" />
                      <p className="text-xs text-red-700 font-medium">Customer Required for Partial Payment</p>
                      <p className="text-xs text-red-600">Please select a customer first</p>
                    </div>
                  ) : (
                    <p className="text-xs text-orange-600 mt-1">Pending saved under {customer.firstName} {customer.lastName}</p>
                  )}
                </div>
              )}
              {/* Screenshot Upload */}
              <div className="flex items-center gap-2">
                {bankScreenshotFile ? (
                  <div className="flex-1 flex items-center gap-2 bg-green-50 border border-green-200 rounded px-2 py-1.5">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-green-700 truncate flex-1">{bankScreenshotFile.name}</span>
                    <button onClick={() => setBankScreenshotFile(null)} className="text-red-500"><X className="h-3 w-3" /></button>
                  </div>
                ) : (
                  <label className="flex-1 flex items-center gap-2 border border-dashed border-purple-300 rounded px-3 py-1.5 cursor-pointer hover:bg-purple-50">
                    <Upload className="h-4 w-4 text-purple-400" />
                    <span className="text-xs text-purple-600">Screenshot (optional)</span>
                    <input type="file" accept="image/*" onChange={(e) => handleScreenshotSelect(e.target.files?.[0] || null)} className="hidden" />
                  </label>
                )}
              </div>
              {screenshotError && <p className="text-xs text-red-600">{screenshotError}</p>}
            </div>
          )}

          {/* Confirm Button */}
          <button
            onClick={handleConfirm}
            disabled={!canProceed || processing}
            className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-colors ${
              canProceed
                ? (processing ? 'cursor-wait opacity-80 ' : '') + (isPartialPayment
                  ? 'bg-orange-600 text-white hover:bg-orange-700'
                  : paymentMethod === 'bank_transfer'
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : paymentMethod === 'cash'
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700')
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {processing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing payment… please wait
              </span>
            ) : isPartialPayment ? (
              `Pay ${symbol}${cashAmount.toFixed(0)} (Pending: ${symbol}${pendingAmount.toFixed(0)})`
            ) : paymentMethod === 'card' ? (
              'Process Card Payment'
            ) : (
              `Complete Payment`
            )}
          </button>
        </fieldset>
      </div>
    </div>
  );
}
