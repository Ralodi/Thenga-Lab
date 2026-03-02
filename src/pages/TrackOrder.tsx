import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

const TrackOrder = () => {
    const { orderId } = useParams();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Fetch the initial order details
    useEffect(() => {
        const fetchOrder = async () => {
            const { data, error } = await supabase
                .from('Orders') // Assuming your table is called 'orders'
                .select('*')
                .eq('order_id', orderId)
                .single();

            if (data) {
                setOrder(data);
            } else {
                console.error('Error fetching order:', error);
            }
        };

        fetchOrder();
    }, [orderId]);

    // If the order data is not available, show a loading message
    if (!order) {
        return <p>Loading order details...</p>;
    }

    const getStatusBadgeClasses = (status: string) => {
        switch (status) {
            case 'Created':
                return 'bg-gray-300 text-gray-800';
            case 'Acknowledged':
                return 'bg-blue-500 text-white';
            case 'Rejected':
                return 'bg-red-500 text-white';
            case 'Processing':
                return 'bg-yellow-500 text-white';
            case 'Completed':
                return 'bg-green-500 text-white';
            default:
                return 'bg-gray-500 text-white';
        }
    };

    // Format the date as requested
    const formattedDate = new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, // Local timezone
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
                            className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${getStatusBadgeClasses(order.status)}`}
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
