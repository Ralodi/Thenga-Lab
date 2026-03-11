import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserRegistration } from '@/data/userRegistration';
import { getUser } from '@/services/authService';
import {
  fetchCustomerLoyaltyHistory,
  fetchCustomerLoyaltyTotal,
  type LoyaltyTransactionItem,
} from '@/services/orderService';

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

interface LocationState {
  user?: UserRegistration | null;
}

const LoyaltyHistory = () => {
  const location = useLocation();
  const state = (location.state as LocationState | null) ?? null;

  const [user, setUser] = useState<UserRegistration | null>(state?.user ?? null);
  const [totalPoints, setTotalPoints] = useState<number | null>(null);
  const [rows, setRows] = useState<LoyaltyTransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      if (state?.user) return;

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
        setError('Please log in to view loyalty history.');
        setLoading(false);
      }
    };

    void loadUser();
  }, [state?.user]);

  useEffect(() => {
    if (!queryFilter) return;

    const load = async () => {
      try {
        setLoading(true);
        const [total, history] = await Promise.all([
          fetchCustomerLoyaltyTotal(queryFilter),
          fetchCustomerLoyaltyHistory(queryFilter),
        ]);
        setTotalPoints(total);
        setRows(history);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load loyalty history');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [queryFilter]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading loyalty history...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Loyalty History Unavailable</CardTitle>
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
            <h1 className="text-2xl font-bold text-thenga-blue">Loyalty History</h1>
            <p className="text-sm text-gray-600">Earned and redeemed points per order</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/my-orders" state={{ user }}>Back to My Orders</Link>
          </Button>
        </div>

        <Card>
          <CardContent className="p-4">
            <p className="font-semibold text-thenga-blue">Current Balance</p>
            <p className="text-lg font-bold mt-1">{Number(totalPoints ?? 0)} pts</p>
          </CardContent>
        </Card>

        {rows.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-gray-600">No loyalty transactions yet.</CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <Card key={row.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between items-center gap-3">
                    <p className="font-semibold">Order: {row.order_id}</p>
                    <p className="text-xs text-gray-600">{new Date(row.created_at).toLocaleString()}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <p><span className="font-medium">Base Earned:</span> +{row.points_earned_base} pts</p>
                    <p><span className="font-medium">Bonus Earned:</span> +{row.points_earned_bonus} pts</p>
                    <p><span className="font-medium">Redeemed:</span> -{row.points_redeemed} pts</p>
                    <p><span className="font-medium">Redeem Value:</span> R {row.redemption_value.toFixed(2)}</p>
                  </div>
                  <div className="flex justify-between text-sm text-gray-700">
                    <p>Total Points Change: {row.points_earned - row.points_redeemed >= 0 ? '+' : ''}{row.points_earned - row.points_redeemed} pts</p>
                    <p>Order Total: R {row.order_total.toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LoyaltyHistory;
