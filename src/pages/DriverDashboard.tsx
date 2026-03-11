import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navigation } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getUser } from '@/services/authService';
import {
  acceptDriverOrder,
  buildDriverNavigationUrl,
  computeDriverStats,
  fetchDriverProfileByUserId,
  fetchFirstDriverProfileForTesting,
  fetchAvailableOrders,
  fetchDriverTrips,
  fetchDriverTripsForTesting,
  openDriverNavigation,
  saveDeliveryProof,
  type DriverProfile,
  type DriverTrip,
  uploadDeliveryProof,
  updateDriverOrderStatus,
} from '@/services/driverService';
import { supabase } from '@/lib/supabaseClient';
import { getDriverStatusLabel, ORDER_STATUS } from '@/types/orderStatus';

const TEST_DRIVER_MODE = import.meta.env.VITE_ENABLE_TEST_DRIVER_MODE === 'true';

const getStatusVariant = (status: string) => {
  switch (status) {
    case ORDER_STATUS.COMPLETED:
      return 'default';
    case ORDER_STATUS.PROCESSING:
    case ORDER_STATUS.ACKNOWLEDGED:
      return 'secondary';
    case ORDER_STATUS.REJECTED:
      return 'destructive';
    default:
      return 'outline';
  }
};

const DriverDashboard = () => {
  const { toast } = useToast();
  const [trips, setTrips] = useState<DriverTrip[]>([]);
  const [availableOrders, setAvailableOrders] = useState<DriverTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [driverName, setDriverName] = useState('Driver');
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [driverId, setDriverId] = useState<string | undefined>(undefined);
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);
  const [updatingTripId, setUpdatingTripId] = useState<string | null>(null);
  const [proofFiles, setProofFiles] = useState<Record<string, File | null>>({});
  const [proofNotes, setProofNotes] = useState<Record<string, string>>({});

  const loadDashboardData = useCallback(async (resolvedDriverId?: string) => {
    const [tripData, newOrders] = await Promise.all([
      TEST_DRIVER_MODE
        ? fetchDriverTripsForTesting()
        : resolvedDriverId
          ? fetchDriverTrips(resolvedDriverId)
          : Promise.resolve([]),
      fetchAvailableOrders(TEST_DRIVER_MODE ? undefined : resolvedDriverId),
    ]);

    setTrips(tripData);
    setAvailableOrders(newOrders);
  }, []);

  useEffect(() => {
    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      try {
        let resolvedDriverId: string | undefined;

        if (TEST_DRIVER_MODE) {
          const profile = await fetchFirstDriverProfileForTesting();
          if (profile) {
            setDriverProfile(profile);
            setDriverName(profile.full_name || 'Driver (Test Mode)');
          } else {
            setDriverName('Driver (Test Mode)');
          }
        } else {
          const user = await getUser();
          const role = String(user.user_metadata?.role || '').toLowerCase();
          if (role !== 'driver') {
            throw new Error('Unauthorized: this page is only available to driver accounts.');
          }

          resolvedDriverId = user.id;
          setDriverId(user.id);

          const profile = await fetchDriverProfileByUserId(user.id);
          setDriverProfile(profile);
          if (profile?.full_name) {
            setDriverName(profile.full_name);
          } else {
            setDriverName((user.user_metadata?.first_name as string) || user.email || 'Driver');
          }
        }

        if (!isMounted) return;
        await loadDashboardData(resolvedDriverId);

        channel = supabase
          .channel('driver-dashboard-orders-live')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'Orders' },
            async () => {
              if (!isMounted) return;
              await loadDashboardData(resolvedDriverId);
            }
          )
          .subscribe();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load dashboard';
        if (isMounted) {
          setError(message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void init();

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [loadDashboardData]);

  const stats = useMemo(() => computeDriverStats(trips), [trips]);

  const handleNavigate = (destination: string) => {
    const opened = openDriverNavigation(destination);
    if (!opened) {
      const fallbackUrl = buildDriverNavigationUrl(destination);
      void navigator.clipboard?.writeText(fallbackUrl);
      toast({
        title: 'Open Maps manually',
        description: 'Could not auto-open maps. Navigation link copied to clipboard.',
      });
    }
  };

  const handleAcceptOrder = async (orderDbId: string) => {
    try {
      setAcceptingOrderId(orderDbId);
      await acceptDriverOrder(orderDbId, TEST_DRIVER_MODE ? undefined : driverId);
      await loadDashboardData(driverId);
      toast({
        title: 'Order accepted',
        description: 'The order was acknowledged and moved to your trips.',
      });
    } catch (err) {
      toast({
        title: 'Failed to accept order',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setAcceptingOrderId(null);
    }
  };

  const handleMarkPickedUp = async (trip: DriverTrip) => {
    try {
      setUpdatingTripId(trip.id);
      await updateDriverOrderStatus(
        trip.id,
        ORDER_STATUS.ACKNOWLEDGED,
        ORDER_STATUS.PROCESSING,
        TEST_DRIVER_MODE ? undefined : driverId
      );
      await loadDashboardData(driverId);
      toast({
        title: 'Order picked up',
        description: `Order ${trip.order_id} moved to Picked Up.`,
      });
    } catch (err) {
      toast({
        title: 'Failed to update status',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setUpdatingTripId(null);
    }
  };

  const handleMarkDelivered = async (trip: DriverTrip) => {
    const proofFile = proofFiles[trip.id];
    if (!proofFile) {
      toast({
        title: 'Proof required',
        description: 'Upload proof of delivery photo before marking delivered.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUpdatingTripId(trip.id);
      const proofUrl = await uploadDeliveryProof(proofFile, trip.order_id);
      await saveDeliveryProof(
        trip.id,
        proofUrl,
        proofNotes[trip.id] ?? '',
        TEST_DRIVER_MODE ? undefined : driverId
      );
      await updateDriverOrderStatus(
        trip.id,
        ORDER_STATUS.PROCESSING,
        ORDER_STATUS.COMPLETED,
        TEST_DRIVER_MODE ? undefined : driverId
      );
      await loadDashboardData(driverId);
      toast({
        title: 'Order delivered',
        description: `Order ${trip.order_id} marked as Delivered.`,
      });
      setProofFiles((prev) => ({ ...prev, [trip.id]: null }));
      setProofNotes((prev) => ({ ...prev, [trip.id]: '' }));
    } catch (err) {
      toast({
        title: 'Failed to update status',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setUpdatingTripId(null);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading driver dashboard...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Driver Dashboard Unavailable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">{error}</p>
            <p className="text-sm text-gray-600">
              Ensure the user has `user_metadata.role = driver` and that `Orders.driver_id` is assigned.
            </p>
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
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-thenga-blue">Driver Dashboard</h1>
            <p className="text-sm text-gray-600">Welcome, {driverName}</p>
            {TEST_DRIVER_MODE && (
              <p className="text-xs text-amber-600 mt-1">Test mode is ON (auth and role checks bypassed).</p>
            )}
          </div>
          <Button asChild variant="outline">
            <Link to="/">Back to App</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>New Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {availableOrders.length === 0 ? (
              <p className="text-sm text-gray-600">No new orders right now.</p>
            ) : (
              <div className="space-y-3">
                {availableOrders.map((order) => (
                  <div key={order.id} className="border rounded-md p-4 bg-white">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <p className="font-semibold">Order: {order.order_id}</p>
                        <p className="text-sm text-gray-600">{new Date(order.date).toLocaleString()}</p>
                        <p className="text-sm text-gray-600 mt-1">{order.location}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-sm text-right">
                          <p>Distance: {order.distance_km.toFixed(2)} km</p>
                          <p>Delivery Fee: R {order.delivery_fee.toFixed(2)}</p>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => handleNavigate(order.location)}
                        >
                          <Navigation className="h-4 w-4 mr-2" />
                          Navigate
                        </Button>
                        <Button
                          onClick={() => handleAcceptOrder(order.id)}
                          disabled={acceptingOrderId === order.id}
                          className="bg-thenga-blue hover:bg-thenga-lightblue"
                        >
                          {acceptingOrderId === order.id ? 'Accepting...' : 'Accept Order'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total Trips</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{stats.totalTrips}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Completed Trips</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{stats.completedTrips}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Distance Covered</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{stats.totalDistanceKm.toFixed(2)} km</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Your Earnings (70%)</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">R {stats.totalDriverEarnings.toFixed(2)}</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Driver Profile</CardTitle>
          </CardHeader>
          <CardContent>
            {!driverProfile ? (
              <p className="text-sm text-gray-600">
                No profile found yet. Ask admin to add your details (name, car model, registration, phone).
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
                <p><span className="font-medium">Name:</span> {driverProfile.full_name}</p>
                <p><span className="font-medium">Phone:</span> {driverProfile.contact_number || 'N/A'}</p>
                <p><span className="font-medium">Car:</span> {driverProfile.car_model}</p>
                <p><span className="font-medium">Reg:</span> {driverProfile.reg_number}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trip History</CardTitle>
          </CardHeader>
          <CardContent>
            {trips.length === 0 ? (
              <p className="text-sm text-gray-600">No trips assigned yet.</p>
            ) : (
              <div className="space-y-3">
                {trips.map((trip) => (
                  <div key={trip.id} className="border rounded-md p-4 bg-white">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div>
                        <p className="font-semibold">Order: {trip.order_id}</p>
                        <p className="text-sm text-gray-600">{new Date(trip.date).toLocaleString()}</p>
                      </div>
                      <Badge variant={getStatusVariant(trip.status)}>{getDriverStatusLabel(trip.status)}</Badge>
                    </div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
                      <p><span className="font-medium">Address:</span> {trip.location}</p>
                      <p><span className="font-medium">Distance:</span> {trip.distance_km.toFixed(2)} km</p>
                      <p><span className="font-medium">Delivery Fee:</span> R {trip.delivery_fee.toFixed(2)}</p>
                      <p><span className="font-medium">Driver Share:</span> R {(trip.delivery_fee * 0.7).toFixed(2)}</p>
                    </div>

                    <div className="mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleNavigate(trip.location)}
                      >
                        <Navigation className="h-4 w-4 mr-2" />
                        Open in Maps
                      </Button>
                    </div>

                    {(trip.status === ORDER_STATUS.ACKNOWLEDGED ||
                      trip.status === ORDER_STATUS.PROCESSING) && (
                      <div className="mt-3 flex justify-end">
                        {trip.status === ORDER_STATUS.ACKNOWLEDGED ? (
                          <Button
                            size="sm"
                            disabled={updatingTripId === trip.id}
                            onClick={() => void handleMarkPickedUp(trip)}
                            className="bg-thenga-blue hover:bg-thenga-lightblue"
                          >
                            {updatingTripId === trip.id ? 'Updating...' : 'Mark Picked Up'}
                          </Button>
                        ) : (
                          <div className="flex flex-col gap-2 w-full md:w-[340px]">
                            <input
                              type="file"
                              accept="image/*"
                              className="text-xs"
                              onChange={(e) =>
                                setProofFiles((prev) => ({
                                  ...prev,
                                  [trip.id]: e.target.files?.[0] ?? null,
                                }))
                              }
                            />
                            <input
                              type="text"
                              placeholder="Delivery note (optional)"
                              className="p-2 border rounded text-xs"
                              value={proofNotes[trip.id] ?? ''}
                              onChange={(e) =>
                                setProofNotes((prev) => ({ ...prev, [trip.id]: e.target.value }))
                              }
                            />
                            <Button
                              size="sm"
                              disabled={updatingTripId === trip.id}
                              onClick={() => void handleMarkDelivered(trip)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {updatingTripId === trip.id ? 'Updating...' : 'Submit POD & Mark Delivered'}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DriverDashboard;
