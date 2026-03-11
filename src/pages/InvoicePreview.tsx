import React from 'react';

interface Product {
  id: string;
  name: string;
  description?: string;
  image?: string;
  price: number;
  unit?: string;
  type?: string;
}

interface OrderItem {
  product: Product;
  quantity: number;
  selectedSize?: string;
  variantId?: string;            // NEW: Variant identifier
  variantPrice?: number;         // NEW: Variant-specific price
}

interface Customer {
  userId: string;
  name: string;
  contactNumber: string;
  location: string;
  addressId: string;
}

interface OrderData {
  orderId: string;
  date: string;
  customer: Customer;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  distanceKm: number;
  loyaltyPointsRedeemed?: number;
  loyaltyRedemptionValue?: number;
  total: number;
}

interface Props {
  orderData: OrderData;
  invoiceRef: React.RefObject<HTMLDivElement>;
}

const cell = (widthPercent: number, align: 'left' | 'center' | 'right' = 'left') => ({
  padding: '10px',
  width: `${widthPercent}%`,
  textAlign: align as 'left' | 'center' | 'right',
  border: '1px solid #ccc'
});

export const InvoicePreview: React.FC<Props> = ({ orderData, invoiceRef }) => {
  return (
    <div className="w-full flex justify-center overflow-x-auto">
      <div
        ref={invoiceRef}
        style={{
          minWidth: 320,
          maxWidth: 800,
          margin: '0 auto',
          background: '#fff',
          color: '#000',
          fontFamily: 'Arial, sans-serif'
        }}
        className="rounded-md shadow-md"
      >
        <div
          style={{
            background: '#FFD700',
            padding: 20,
            color: '#002F6C',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10
          }}
        >
          <img src="/logo.png" alt="Logo" style={{ height: 40 }} />
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>INVOICE</h1>
        </div>

        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ minWidth: '48%' }}>
              <p><strong>Invoice #:</strong> {orderData.orderId}</p>
              <p><strong>Date:</strong> {new Date(orderData.date).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <div style={{ minWidth: '48%' }}>
              <p><strong>Bill To:</strong></p>
              <p>{orderData.customer.name}</p>
              <p>{orderData.customer.location}</p>
              <p>{orderData.customer.contactNumber}</p>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f2f2f2' }}>
                  <th style={cell(40)}>Product</th>
                  <th style={cell(10, 'center')}>Qty</th>
                  <th style={cell(20, 'right')}>Unit Price</th>
                  <th style={cell(20, 'right')}>Total</th>
                </tr>
              </thead>
              <tbody>
                {orderData.items.map((item, idx) => {
                  // NEW: Use variant price if available
                  const unitPrice = typeof item.variantPrice === 'number' ? item.variantPrice : item.product.price;
                  const total = unitPrice * item.quantity;
                  return (
                    <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={cell(40)}>
                        {item.product.name}
                        {item.selectedSize ? ` (${item.selectedSize})` : ''}
                        {item.product.description ? ` - ${item.product.description}` : ''}
                      </td>
                      <td style={cell(10, 'center')}>{item.quantity}</td>
                      <td style={cell(20, 'right')}>R{unitPrice.toFixed(2)}</td>
                      <td style={cell(20, 'right')}>R{total.toFixed(2)}</td>
                    </tr>
                  );
                })}
                <tr>
                  <td colSpan={3} style={{ padding: 10, textAlign: 'right' }}>
                    Subtotal:
                  </td>
                  <td style={{ padding: 10, textAlign: 'right' }}>
                    R{orderData.subtotal.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} style={{ padding: 10, textAlign: 'right' }}>
                    Delivery ({orderData.distanceKm.toFixed(1)} km):
                  </td>
                  <td style={{ padding: 10, textAlign: 'right' }}>
                    R{orderData.deliveryFee.toFixed(2)}
                  </td>
                </tr>
                {Number(orderData.loyaltyPointsRedeemed ?? 0) > 0 && (
                  <tr>
                    <td colSpan={3} style={{ padding: 10, textAlign: 'right' }}>
                      Loyalty Redeem ({Number(orderData.loyaltyPointsRedeemed)} pts):
                    </td>
                    <td style={{ padding: 10, textAlign: 'right' }}>
                      -R{Number(orderData.loyaltyRedemptionValue ?? 0).toFixed(2)}
                    </td>
                  </tr>
                )}
                <tr>
                  <td colSpan={3} style={{ padding: 10, textAlign: 'right', fontSize: 16, fontWeight: 'bold' }}>
                    Grand Total:
                  </td>
                  <td style={{ padding: 10, textAlign: 'right', fontSize: 16, fontWeight: 'bold' }}>
                    R{orderData.total.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 40, textAlign: 'center', fontStyle: 'italic', color: '#666' }}>
            Thank you for your business!
          </div>
        </div>
      </div>
    </div>
  );
};
