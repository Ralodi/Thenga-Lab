
import React, { useEffect, useRef, useState } from 'react';
import { useCartStore } from '../store/useCartStore';
import { CustomerInfo } from '../types/cart';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, ArrowRight, Send, Download } from 'lucide-react';
import { UserRegistration } from '@/data/userRegistration';
import { fetchAddressesByUserId } from '@/services/lookUpService';
import { Address } from '@/data/address';
import html2pdf from 'html2pdf.js';
import { InvoicePreview } from '@/pages/InvoicePreview';

interface CheckoutFormProps {
  onBack: () => void;
  onSuccess: (orderId: string) => void;
  user?: UserRegistration | null;
}

const CheckoutForm: React.FC<CheckoutFormProps> = ({ onBack, onSuccess, user }) => {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    addressId: '',
    userId: user?.id || '',
    name: user?.first_name || '',
    location: `${user?.address?.street}, ${user?.address?.city}, ${user?.address?.postal_code}` || '',
    contactNumber: user?.contact_number || '',
  });
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'info' | 'review' | 'invoice'>('info');
  const { submitOrder, clearCart, items, getTotal } = useCartStore();
  const { toast } = useToast();
  const [submittedOrder, setSubmittedOrder] = useState<any>(null);

  const invoiceRef = useRef<HTMLDivElement>(null);
  const [showInvoice, setShowInvoice] = useState(false);


  useEffect(() => {
    const fetchAddresses = async () => {

      try {
        const userAddresses = await fetchAddressesByUserId(user?.id);
        setAddresses(userAddresses);
        if (userAddresses.length > 0) {
          const first = userAddresses[0];
          setSelectedAddress(first);
          setSelectedAddressId(first.id);
          setCustomerInfo((prev) => ({
            ...prev,
            location: `${first.street},
            ${first.city},
            ${first.postal_code}`,
            addressId: first.id
          }));

          setCustomerInfo({
            userId: user?.id || '',
            name: user?.first_name || '',
            contactNumber: user?.contact_number || '',
            location: `${first.street}, ${first.city}, ${first.postal_code}`,
            addressId: first.id,
          })
        }
      } catch (error) {
        console.error('Error fetching addresses:', error);
        toast({
          title: "Error",
          description: "Failed to load addresses. Please try again.",
          variant: "destructive",
        });
      }
    }

    if (user) {
      fetchAddresses();
    }
  }, [user]);

  const validateForm = (): boolean => {
    console.log('Validating form with customerInfo:', customerInfo);
    if (!customerInfo.name || !customerInfo.location || !customerInfo.contactNumber) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleProceed = () => {
    if (validateForm()) {
      setStep('review');
    }
  };

    const generatePDF = () => {
      console.log('Generating PDF...');
    if (!invoiceRef.current) return;
    console.log('Generating PDF for order:', submittedOrder);

    const opt = {
      margin: 0.5,
      filename: `invoice-${submittedOrder.orderId}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(invoiceRef.current).save();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      const order = await submitOrder(customerInfo);
      const jsonString = JSON.stringify(order, null, 2);
      console.log('Order JSON:', jsonString);
      clearCart();
      // onSuccess(order.orderId);
      setSubmittedOrder(order);
      setStep('invoice');
      toast({
        title: "Order Placed",
        description: "Your order has been successfully placed!",
        variant: "default"
      });
    } catch (error) {
      console.error('Error submitting order:', error);
      toast({
        title: "Error",
        description: "Failed to submit your order. Please try again.",
        variant: "destructive",
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
              {items.map((item) => (
                <li key={item.product.id} className="flex justify-between">
                  <span>{item.product.name} × {item.quantity}</span>
                  <span>R {(item.product.price * item.quantity).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-3 border-t border-gray-200">
            <div className="flex justify-between font-bold">
              <span>Total:</span>
              <span>R {getTotal().toFixed(2)}</span>
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
        <InvoicePreview orderData={submittedOrder} invoiceRef={invoiceRef}/>

        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => {onBack()}}
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
      <div className="mb-6">
        <div>
          <Label htmlFor="address">Select Delivery Address</Label>
        </div>
        <div className="mb-4">
          <select
            id="address"
            name="address"
            value={selectedAddressId}
            onChange={(e) => {
              const addressId = e.target.value;
              setSelectedAddressId(addressId);
              const selected = addresses.find(addr => addr.id === addressId);
              setSelectedAddress(selected || null);
              if (selected) {
                setCustomerInfo((prev) => ({
                  ...prev,
                  location: `${selected.street}, ${selected.city}, ${selected.postal_code}`,
                  addressId: selected.id,
                }));
              }
            }}
            className="w-full p-2 border border-gray-300 rounded"
            required
          >
            {addresses.map((address) => (
              <option key={address.id} value={address.id}>
                {address.street}, {address.city}, {address.postal_code}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <div className="mb-4">
          <h3 className="font-semibold">Current Address:</h3>
          <p className="text-gray-700">Street: {selectedAddress?.street}</p>
          <p className="text-gray-700">City: {selectedAddress?.city}</p>
          <p className="text-gray-700">Postal Code: {selectedAddress?.postal_code}</p>
        </div>
      </div>

      <div className="flex gap-4 mt-10">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onBack}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        <Button
          type="submit"
          variant="outline"
          className="flex-1 bg-thenga-yellow hover:bg-thenga-yellow/90 text-thenga-blue font-bold"
          onClick={handleProceed}
        >
          <ArrowRight className="mr-2 h-4 w-4" /> Proceed
        </Button>
      </div>
    </div>

  );
};

export default CheckoutForm;
