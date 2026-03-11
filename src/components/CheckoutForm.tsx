import React, { useEffect, useRef, useState } from 'react';
import { useCartStore } from '../store/useCartStore';
import { CustomerInfo, Order } from '../types/cart';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, ArrowRight, Send, Download } from 'lucide-react';
import { UserRegistration } from '@/data/userRegistration';
import { fetchAddressesByUserId } from '@/services/lookUpService';
import { Address } from '@/data/address';
import html2pdf from 'html2pdf.js';
import { InvoicePreview } from '@/pages/InvoicePreview';
import { calculateDeliveryFee } from '@/lib/deliveryPricing';
import { resolveDeliveryDistanceKm } from '@/services/distanceService';
import { fetchCustomerLoyaltyTotal } from '@/services/orderService';

interface CheckoutFormProps {
  onBack: () => void;
  onSuccess: (order: Order) => void;
  user?: UserRegistration | null;
}

const DEFAULT_DISTANCE_KM = 4;
const LOYALTY_POINT_TO_RAND = 0.33;
const DELIVERY_ORIGIN_ADDRESS =
  import.meta.env.VITE_DELIVERY_ORIGIN_ADDRESS || 'Vereeniging, South Africa';

const isFilled = (value?: string) => Boolean(value && value.trim().length > 0);
const isValidAddress = (address: Address) =>
  isFilled(address.street) && isFilled(address.city) && isFilled(address.postal_code);
const formatLocation = (street: string, city: string, postalCode: string) =>
  `${street.trim()}, ${city.trim()}, ${postalCode.trim()}`;

const CheckoutForm: React.FC<CheckoutFormProps> = ({ onBack, onSuccess, user }) => {
  const initialLocation =
    user?.address && isValidAddress(user.address)
      ? formatLocation(user.address.street, user.address.city, user.address.postal_code)
      : '';

  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    addressId: '',
    userId: user?.id || '',
    name: user?.first_name || '',
    location: initialLocation,
    contactNumber: user?.contact_number || '',
  });
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | undefined>(undefined);
  const [manualAddress, setManualAddress] = useState({
    street: '',
    city: '',
    postal_code: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [step, setStep] = useState<'info' | 'review' | 'invoice'>('info');
  const { submitOrder, clearCart, items, getTotal } = useCartStore();
  const { toast } = useToast();
  const [submittedOrder, setSubmittedOrder] = useState<Order | null>(null);
  const [distanceKm, setDistanceKm] = useState<number>(DEFAULT_DISTANCE_KM);
  const [deliveryFee, setDeliveryFee] = useState<number>(calculateDeliveryFee(DEFAULT_DISTANCE_KM));
  const [loyaltyBalance, setLoyaltyBalance] = useState<number>(0);
  const [pointsToRedeemInput, setPointsToRedeemInput] = useState<string>('0');

  const invoiceRef = useRef<HTMLDivElement>(null);

  const subtotal = getTotal();
  const preRedemptionTotal = subtotal + deliveryFee;
  const requestedPoints = Math.max(0, Math.floor(Number(pointsToRedeemInput || 0)));
  const maxPointsByTotal = Math.floor(preRedemptionTotal / LOYALTY_POINT_TO_RAND);
  const pointsToRedeem = Math.min(requestedPoints, loyaltyBalance, maxPointsByTotal);
  const redemptionValue = Number((pointsToRedeem * LOYALTY_POINT_TO_RAND).toFixed(2));
  const grandTotal = Number((preRedemptionTotal - redemptionValue).toFixed(2));
  const hasSavedAddresses = addresses.length > 0;

  const applyDistance = (distance: number) => {
    setDistanceKm(distance);
    setDeliveryFee(calculateDeliveryFee(distance));
  };

  const handleManualAddressChange = (
    field: 'street' | 'city' | 'postal_code',
    value: string
  ) => {
    setManualAddress((prev) => {
      const next = { ...prev, [field]: value };
      setCustomerInfo((current) => ({
        ...current,
        location: formatLocation(next.street, next.city, next.postal_code),
        addressId: '',
      }));
      return next;
    });
  };

  useEffect(() => {
    const fetchAddresses = async () => {
      try {
        const userAddresses = await fetchAddressesByUserId(user?.id);
        const validAddresses = userAddresses.filter(isValidAddress);
        setAddresses(validAddresses);

        if (validAddresses.length > 0) {
          const first = validAddresses[0];
          setSelectedAddress(first);
          setSelectedAddressId(first.id);
          setCustomerInfo({
            userId: user?.id || '',
            name: user?.first_name || '',
            contactNumber: user?.contact_number || '',
            location: formatLocation(first.street, first.city, first.postal_code),
            addressId: first.id,
          });
          return;
        }

        const profileAddress = user?.address;
        if (profileAddress && isValidAddress(profileAddress)) {
          setManualAddress({
            street: profileAddress.street,
            city: profileAddress.city,
            postal_code: profileAddress.postal_code,
          });
          setCustomerInfo({
            userId: user?.id || '',
            name: user?.first_name || '',
            contactNumber: user?.contact_number || '',
            location: formatLocation(
              profileAddress.street,
              profileAddress.city,
              profileAddress.postal_code
            ),
            addressId: '',
          });
        }
      } catch (error) {
        console.error('Error fetching addresses:', error);
        toast({
          title: 'Error',
          description: 'Failed to load addresses. Please try again.',
          variant: 'destructive',
        });
      }
    };

    if (user) {
      fetchAddresses();
    }
  }, [user, toast]);

  useEffect(() => {
    const loadLoyalty = async () => {
      try {
        const total = await fetchCustomerLoyaltyTotal({
          userId: customerInfo.userId,
          customerName: customerInfo.name,
          contactNumber: customerInfo.contactNumber,
        });
        setLoyaltyBalance(Number(total ?? 0));
      } catch {
        setLoyaltyBalance(0);
      }
    };

    if (!customerInfo.name || !customerInfo.contactNumber) return;
    void loadLoyalty();
  }, [customerInfo.userId, customerInfo.name, customerInfo.contactNumber]);

  const validateForm = (): boolean => {
    if (!customerInfo.name || !customerInfo.location || !customerInfo.contactNumber) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const handleProceed = async () => {
    if (!validateForm()) {
      return;
    }

    setIsCalculatingDistance(true);
    try {
      const result = await resolveDeliveryDistanceKm({
        origin: DELIVERY_ORIGIN_ADDRESS,
        destination: customerInfo.location,
      });

      applyDistance(result.distanceKm);

      if (result.source === 'fallback') {
        toast({
          title: 'Distance fallback used',
          description: 'Google distance is unavailable right now. Using default 4 km estimate.',
          variant: 'default',
        });
      }

      setStep('review');
    } finally {
      setIsCalculatingDistance(false);
    }
  };

  const generatePDF = () => {
    if (!invoiceRef.current || !submittedOrder) return;

    const opt = {
      margin: 0.5,
      filename: `invoice-${submittedOrder.orderId}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
    };

    html2pdf().set(opt).from(invoiceRef.current).save();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      const order = await submitOrder(customerInfo, {
        distanceKm,
        deliveryFee,
        pointsToRedeem,
      });
      clearCart();
      setSubmittedOrder(order);
      onSuccess(order);
      const pointsEarned = Number(order.loyaltyPointsEarned ?? 0);
      const bonusPointsEarned = Number(order.loyaltyBonusPointsEarned ?? 0);
      toast({
        title: 'Order Placed',
        description:
          pointsEarned > 0
            ? `Your order has been successfully placed! You earned ${pointsEarned} loyalty points${bonusPointsEarned > 0 ? ` (including ${bonusPointsEarned} bonus)` : ''}.`
            : 'Your order has been successfully placed!',
        variant: 'default',
      });
    } catch (error) {
      console.error('Error submitting order:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to submit your order. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 'review') {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-thenga-brown mb-6">Order Summary</h2>

        <div className="space-y-4 mb-6">
          <div>
            <h3 className="font-semibold">Delivery Information:</h3>
            <p className="text-gray-700">Name: {customerInfo.name}</p>
            <p className="text-gray-700">Location: {customerInfo.location}</p>
            <p className="text-gray-700">Contact Number: {customerInfo.contactNumber}</p>
          </div>
          <div>
            <h3 className="font-semibold">Order Items:</h3>
            <ul className="space-y-2">
              {items.map((item) => {
                // NEW: Use variant price if available, otherwise use product price
                const itemPrice = typeof item.variantPrice === 'number' ? item.variantPrice : item.product.price;
                const itemTotal = itemPrice * item.quantity;
                const itemKey = `${item.product.id}-${item.selectedSize ?? ''}-${item.variantId ?? ''}`;
                
                return (
                  <li key={itemKey} className="flex justify-between">
                    <span>
                      {item.product.name}
                      {item.selectedSize ? ` (${item.selectedSize})` : ''} x {item.quantity}
                      <span className="text-xs text-gray-600 ml-1">@ R {itemPrice.toFixed(2)}</span>
                    </span>
                    <span>R {itemTotal.toFixed(2)}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="pt-3 border-t border-gray-200 space-y-1">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>R {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Delivery ({distanceKm.toFixed(1)} km):</span>
              <span>R {deliveryFee.toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t border-gray-100">
              <p className="text-sm font-medium mb-2">Loyalty Redemption</p>
              <p className="text-xs text-gray-600 mb-2">
                Available: {loyaltyBalance} pts (R {(loyaltyBalance * LOYALTY_POINT_TO_RAND).toFixed(2)})
              </p>
              <div className="flex items-center gap-2">
                <Label htmlFor="points-to-redeem" className="text-xs min-w-24">Use points</Label>
                <input
                  id="points-to-redeem"
                  type="number"
                  min={0}
                  step={1}
                  value={pointsToRedeemInput}
                  onChange={(e) => setPointsToRedeemInput(e.target.value)}
                  className="w-28 p-1 border border-gray-300 rounded"
                />
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span>Redeemed ({pointsToRedeem} pts):</span>
                <span>- R {redemptionValue.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex justify-between font-bold">
              <span>Total Payable:</span>
              <span>R {grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => setStep('info')}
            disabled={isSubmitting}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>

          <Button
            type="button"
            onClick={handleSubmit}
            variant="outline"
            className="flex-1 bg-thenga-yellow hover:bg-thenga-yellow/90 text-thenga-blue font-bold"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : (
              <>
                <Send className="mr-2 h-4 w-4" /> Place Order
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'invoice' && submittedOrder) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <InvoicePreview orderData={submittedOrder} invoiceRef={invoiceRef} />

        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => {
              onBack();
            }}
            disabled={isSubmitting}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Home
          </Button>

          <Button
            type="button"
            onClick={generatePDF}
            variant="outline"
            className="flex-1 bg-thenga-yellow hover:bg-thenga-yellow/90 text-thenga-blue font-bold"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : (
              <>
                <Download className="mr-2 h-4 w-4" /> Download
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold text-thenga-brown mb-6">Delivery Information</h2>

      {hasSavedAddresses ? (
        <div className="mb-6">
          <div>
            <Label htmlFor="address">Select Delivery Address</Label>
          </div>
          <div className="mb-4">
            <select
              id="address"
              name="address"
              value={selectedAddressId || ''}
              onChange={(e) => {
                const addressId = e.target.value;
                setSelectedAddressId(addressId);
                const selected = addresses.find((addr) => addr.id === addressId);
                setSelectedAddress(selected || null);
                if (selected) {
                  setCustomerInfo((prev) => ({
                    ...prev,
                    location: formatLocation(selected.street, selected.city, selected.postal_code),
                    addressId: selected.id,
                  }));
                }
              }}
              className="w-full p-2 border border-gray-300 rounded"
              required
            >
              <option value="" disabled>
                Select address
              </option>
              {addresses.map((address) => (
                <option key={address.id || `${address.street}-${address.city}-${address.postal_code}`} value={address.id}>
                  {address.street}, {address.city}, {address.postal_code}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="space-y-4 mb-6">
          <p className="text-sm text-gray-600">No saved address found. Enter a delivery address below.</p>
          <div>
            <Label htmlFor="street">Street</Label>
            <input
              id="street"
              type="text"
              value={manualAddress.street}
              onChange={(e) => handleManualAddressChange('street', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded"
              placeholder="Enter street"
              required
            />
          </div>
          <div>
            <Label htmlFor="city">City</Label>
            <input
              id="city"
              type="text"
              value={manualAddress.city}
              onChange={(e) => handleManualAddressChange('city', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded"
              placeholder="Enter city"
              required
            />
          </div>
          <div>
            <Label htmlFor="postal-code">Postal Code</Label>
            <input
              id="postal-code"
              type="text"
              value={manualAddress.postal_code}
              onChange={(e) => handleManualAddressChange('postal_code', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded"
              placeholder="Enter postal code"
              required
            />
          </div>
        </div>
      )}

      <div className="space-y-4 mb-6">
        <div className="mb-4">
          <h3 className="font-semibold">Current Address:</h3>
          <p className="text-gray-700">Street: {selectedAddress?.street || manualAddress.street}</p>
          <p className="text-gray-700">City: {selectedAddress?.city || manualAddress.city}</p>
          <p className="text-gray-700">Postal Code: {selectedAddress?.postal_code || manualAddress.postal_code}</p>
        </div>
      </div>

      <div className="flex gap-4 mt-10">
        <Button type="button" variant="outline" className="flex-1" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        <Button
          type="button"
          variant="outline"
          className="flex-1 bg-thenga-yellow hover:bg-thenga-yellow/90 text-thenga-blue font-bold"
          onClick={handleProceed}
          disabled={isCalculatingDistance}
        >
          <ArrowRight className="mr-2 h-4 w-4" />
          {isCalculatingDistance ? 'Calculating Distance...' : 'Proceed'}
        </Button>
      </div>
    </div>
  );
};

export default CheckoutForm;
