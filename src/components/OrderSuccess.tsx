
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Check, Download, Home } from 'lucide-react';

interface OrderSuccessProps {
  orderId: string;
  loyaltyPointsRedeemed?: number;
  loyaltyRedemptionValue?: number;
  loyaltyPointsEarned?: number;
  loyaltyBonusPointsEarned?: number;
  loyaltyPointsTotal?: number | null;
  onBackToHome: () => void;
  onTrackOrder: () => void;
  onDownloadInvoice: () => void;
}

const OrderSuccess: React.FC<OrderSuccessProps> = ({
  orderId,
  loyaltyPointsRedeemed,
  loyaltyRedemptionValue,
  loyaltyPointsEarned,
  loyaltyBonusPointsEarned,
  loyaltyPointsTotal,
  onBackToHome,
  onTrackOrder,
  onDownloadInvoice,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-8 text-center">
      <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
        <Check className="h-8 w-8 text-green-600" />
      </div>

      <h2 className="text-2xl font-bold text-thenga-brown mb-2">Order Received!</h2>
      <p className="text-gray-600 mb-4">Your order has been successfully submitted.</p>

      <div className="bg-thenga-cream p-4 rounded-md mb-6">
        <p className="text-sm mb-1">Order Reference:</p>
        <p className="font-mono font-bold text-thenga-brown">{orderId}</p>
      </div>

      <p className="text-gray-600 mb-6">
        We've received your order and will contact you to confirm delivery details.
        <br />
        Payment will be collected on delivery.
      </p>
      {(Number(loyaltyPointsEarned ?? 0) > 0 || loyaltyPointsTotal !== null) && (
        <div className="bg-blue-50 border border-blue-100 p-3 rounded-md mb-6 text-left">
          <p className="text-sm text-blue-900 font-semibold">Loyalty Points</p>
          {Number(loyaltyPointsRedeemed ?? 0) > 0 && (
            <p className="text-sm text-blue-800">
              Redeemed: {Number(loyaltyPointsRedeemed)} pts (R {Number(loyaltyRedemptionValue ?? 0).toFixed(2)})
            </p>
          )}
          {Number(loyaltyPointsEarned ?? 0) > 0 && (
            <p className="text-sm text-blue-800">Earned on this order: {Number(loyaltyPointsEarned)} pts</p>
          )}
          {Number(loyaltyBonusPointsEarned ?? 0) > 0 && (
            <p className="text-sm text-blue-800">Special offer bonus: +{Number(loyaltyBonusPointsEarned)} pts</p>
          )}
          {typeof loyaltyPointsTotal === 'number' && (
            <p className="text-sm text-blue-800">Total points: {loyaltyPointsTotal} pts</p>
          )}
        </div>
      )}
      <div className="flex gap-4 mt-6">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onBackToHome}
            >
              <Home className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
            
            <Button
              type="submit"
              variant="outline"
              className="flex-1 bg-thenga-yellow hover:bg-thenga-yellow/90 text-thenga-blue font-bold"
              onClick={onTrackOrder}
            >
              <ArrowRight className="mr-2 h-4 w-4" /> Track Order
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onDownloadInvoice}
            >
              <Download className="mr-2 h-4 w-4" /> Invoice
            </Button>
          </div>
    </div>
  );
};

export default OrderSuccess;
