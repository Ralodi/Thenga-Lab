import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { getTrackOrderBadgeClass } from '@/types/orderStatus';

const TrackOrder = () => {
    const { orderId } = useParams();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!orderId) {
            setError('Missing order id');
            setLoading(false);
            return;
        }

        const fetchOrder = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('Orders')
                .select('*')
                .eq('order_id', orderId)
                .single();

            if (data) {
                setOrder(data);
                setError(null);
            } else {
                console.error('Error fetching order:', error);
                setError(error?.message || 'Failed to load order');
            }
            setLoading(false);
        };

        const subscription = supabase
            .channel(`track-order-${orderId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'Orders',
                    filter: `order_id=eq.${orderId}`,
                },
                (payload) => {
                    setOrder(payload.new);
                }
            )
            .subscribe();

        void fetchOrder();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [orderId]);

    if (loading) {
        return <p className="text-center py-6">Loading order details...</p>;
    }

    if (error) {
        return (
            <div className="max-w-xl mx-auto px-4 py-6">
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <p className="text-red-600 font-medium">Failed to load order</p>
                    <p className="text-sm text-gray-600 mt-1">{error}</p>
                </div>
            </div>
        );
    }

    if (!order) {
        return <p className="text-center py-6">Order not found.</p>;
    }

    const formattedDate = new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
        .format(new Date(order.date))
        .replace(',', '')
        .replace(' at', ' at')
        .replace('AM', 'AM')
        .replace('PM', 'PM');

    return (
        <div className="max-w-xl mx-auto px-4 py-6">
            <h2 className="text-2xl font-bold text-center mb-4">Track Your Order</h2>

            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="space-y-4">
                    <p className="text-lg font-medium">
                        <span className="font-semibold">Order ID:</span> {order.order_id}
                    </p>

                    <p className="text-lg font-medium">
                        <span className="font-semibold">Customer Name:</span> {order.customer_name}
                    </p>

                    <p className="text-lg font-medium">
                        <span className="font-semibold">Delivery Address:</span> {order.location}
                    </p>

                    <p className="text-lg font-medium">
                        <span className="font-semibold">Date:</span> {formattedDate}
                    </p>

                    <p className="text-lg font-medium">
                        <span className="font-semibold">Order Status:</span>
                        <span
                            className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${getTrackOrderBadgeClass(order.status)}`}
                        >
                            {order.status}
                        </span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default TrackOrder;
