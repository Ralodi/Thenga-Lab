import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserRegistration } from '@/data/userRegistration';
import { getUser } from '@/services/authService';
import {
  fetchCustomerLoyaltyTotal,
  fetchCustomerOrders,
  sendOrderEmail,
  type CustomerOrderHistoryItem,
} from '@/services/orderService';
import { supabase } from '@/lib/supabaseClient';
import { getTrackOrderBadgeClass } from '@/types/orderStatus';
import html2pdf from 'html2pdf.js';
import { InvoicePreview } from './InvoicePreview';
import type { Order as InvoiceOrder } from '@/types/cart';
import { useToast } from '@/components/ui/use-toast';

const TEST_AUTH_MODE = import.meta.env.VITE_ENABLE_TEST_AUTH_MODE === 'true';

const TEST_USER: UserRegistration = {
  id: 'test-client-user',
  first_name: 'Test Client',
  email: 'test-client@local.dev',
  password: '',
  contact_number: '0712345678',
  business_type: 'tavern',
  address: {
    street: '10 Voortrekker Street',
    city: 'Vereeniging',
    postal_code: '1930',
  },
};

const isUuid = (value?: string): value is string =>
  Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

interface LocationState {
  user?: UserRegistration | null;
}

const MyOrders = () => {
  const { toast } = useToast();
  const location = useLocation();
  const state = (location.state as LocationState | null) ?? null;

  const [user, setUser] = useState<UserRegistration | null>(state?.user ?? null);
  const [orders, setOrders] = useState<CustomerOrderHistoryItem[]>([]);
  const [loyaltyTotal, setLoyaltyTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<InvoiceOrder | null>(null);
  const invoiceRef = React.useRef<HTMLDivElement>(null);

  const queryFilter = useMemo(() => {
    if (!user) return null;
    return {
      userId: user.id,
      customerName: user.first_name,
      contactNumber: user.contact_number,
    };
  }, [user]);

  useEffect(() => {
    const loadUser = async () => {
      if (TEST_AUTH_MODE) {
        setUser((prev) => prev ?? TEST_USER);
        return;
      }

      if (state?.user) {
        return;
      }

      try {
        const authUser = await getUser();
        setUser({
          id: authUser.id,
          first_name: String(authUser.user_metadata?.first_name ?? 'Customer'),
          email: String(authUser.email ?? ''),
          password: '',
          contact_number: String(authUser.user_metadata?.contact_number ?? ''),
          business_type: String(authUser.user_metadata?.business_type ?? 'tavern') as UserRegistration['business_type'],
          address: {
            street: String(authUser.user_metadata?.street ?? ''),
            city: String(authUser.user_metadata?.city ?? ''),
            postal_code: String(authUser.user_metadata?.postal_code ?? ''),
          },
        });
      } catch {
        setError('Please log in to view your order history.');
        setLoading(false);
      }
    };

    void loadUser();
  }, [state?.user]);

  useEffect(() => {
    if (!queryFilter) return;

    let isMounted = true;

    const loadOrders = async () => {
      try {
        setLoading(true);
        const [data, loyalty] = await Promise.all([
          fetchCustomerOrders(queryFilter),
          fetchCustomerLoyaltyTotal(queryFilter),
        ]);
        if (!isMounted) return;
        setOrders(data);
        setLoyaltyTotal(loyalty);
        setError(null);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load your orders');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadOrders();

    let channelFilter = '';
    if (isUuid(queryFilter.userId)) {
      channelFilter = `user_id=eq.${queryFilter.userId}`;
    } else if (queryFilter.contactNumber) {
      channelFilter = `contact_number=eq.${queryFilter.contactNumber}`;
    }

    const subscription = supabase
      .channel(`my-orders-${queryFilter.userId || queryFilter.contactNumber || 'guest'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Orders',
          ...(channelFilter ? { filter: channelFilter } : {}),
        },
        async () => {
          const [latest, loyalty] = await Promise.all([
            fetchCustomerOrders(queryFilter),
            fetchCustomerLoyaltyTotal(queryFilter),
          ]);
          if (isMounted) {
            setOrders(latest);
            setLoyaltyTotal(loyalty);
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(subscription);
    };
  }, [queryFilter]);

  const handleDownloadInvoice = async (order: CustomerOrderHistoryItem) => {
    try {
      await sendOrderEmail(order.order_id, order.customer_name || user?.first_name || 'Customer');
    } catch {
      setInvoiceOrder({
        orderId: order.order_id,
        date: order.date,
        customer: {
          userId: user?.id || '',
          name: order.customer_name || user?.first_name || 'Customer',
          contactNumber: order.contact_number || user?.contact_number || '',
          location: order.location,
          addressId: '',
        },
        items: [],
        subtotal: order.subtotal,
        deliveryFee: order.delivery_fee,
        distanceKm: order.distance_km,
        loyaltyPointsRedeemed: order.loyalty_points_redeemed,
        loyaltyRedemptionValue: order.loyalty_redemption_value,
        total: order.total,
      });

      window.setTimeout(async () => {
        if (!invoiceRef.current) return;
        const opt = {
          margin: 0.5,
          filename: `invoice-${order.order_id}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
        };
        await html2pdf().set(opt).from(invoiceRef.current).save();
        toast({
          title: 'Invoice downloaded',
          description: 'Used local invoice fallback because server invoice is unavailable.',
        });
      }, 0);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading your orders...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>My Orders Unavailable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">{error}</p>
            <Button asChild>
              <Link to="/">Back to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-thenga-blue">My Orders</h1>
            <p className="text-sm text-gray-600">Order history and live status updates</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/">Back to App</Link>
          </Button>
        </div>
        <Card>
          <CardContent className="p-4 text-sm">
            <p className="font-semibold text-thenga-blue">Loyalty Points</p>
            <p className="text-gray-700 mt-1">
              Total points: {typeof loyaltyTotal === 'number' ? loyaltyTotal : 'Not available yet'}
            </p>
            <div className="mt-3">
              <Button asChild size="sm" variant="outline">
                <Link to="/loyalty-history" state={{ user }}>
                  View Loyalty Transactions
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {orders.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-gray-600">
              No orders found yet for this account.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Card key={order.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <p className="font-semibold">Order ID: {order.order_id}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(order.date).toLocaleString()}
                      </p>
                    </div>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getTrackOrderBadgeClass(order.status)}`}>
                      {order.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                    <p><span className="font-medium">Subtotal:</span> R {order.subtotal.toFixed(2)}</p>
                    <p><span className="font-medium">Delivery:</span> R {order.delivery_fee.toFixed(2)}</p>
                    <p><span className="font-medium">Total:</span> R {order.total.toFixed(2)}</p>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <p className="text-gray-600 truncate pr-3">{order.location}</p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleDownloadInvoice(order)}
                        disabled={order.status !== 'Completed'}
                        title={order.status !== 'Completed' ? 'Invoice available when order is completed' : 'Download invoice'}
                      >
                        Invoice
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/track-order/${order.order_id}`}>Track</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {invoiceOrder && (
          <div className="hidden">
            <InvoicePreview orderData={invoiceOrder} invoiceRef={invoiceRef} />
          </div>
        )}
      </div>
    </div>
  );
};

export default MyOrders;
