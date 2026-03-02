import { Product } from "@/data/products";
import { supabaseUrl, supabaseAnonKey, supabase } from "@/lib/supabaseClient";
import { CustomerInfo } from "@/types/cart";
// import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const base64Logo = `
iVBORw0KGgoAAAANSUhEUgAAAKAAAABQCAYAAACg6YDLAAAACXBIWXMAAAsTAAALEwEAmpwYAAAC
H0lEQVR4nO3VsUoDQRBE0e3/bXLsMSoRMakgy10Z2PuNeQ8yxLNFVVVVVVVVfTfglFt/XN49+7fZ
n3eujhvPzplz5sxZs2bNnDlz5syZMWfOnDlz5syZMWfOnDnzxA5+XkDkypUqVapUqVapUqVapUqV
apUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVa
pUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapU
qVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqV
apUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVap
UqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUq
VapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVa
pUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapU
qVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqV
apUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVapUqVa7
95YuG73PAd4S1Fa3VQ6UAAAAASUVORK5CYII=`;

export async function submitOrder(order, customerInfo: CustomerInfo) {
    const { data: orderData, error: orderError } = await supabase
        .from('Orders')
        .insert([{
            order_id: order.orderId,
            customer_name: order.customer.name,
            location: order.customer.location,
            contact_number: order.customer.contactNumber,
            total: order.total,
            date: order.date,
            user_id: order.customer.userId,
            address_id: order.customer.addressId,
            status: 'Created',
        }])
        .select()
        .single();

    if (orderError) {
        console.error('Order Error:', orderError);
        return;
    }

    const orderId = orderData.id;

    const itemsToInsert = order.items.map(({ product, quantity }) => ({
        order_id: orderId,
        product_id: product.id,
        name: product.name,
        description: product.description,
        image: product.image,
        price: product.price,
        unit: product.unit,
        type: product.type,
        quantity,
    }));

    const { error: itemsError } = await supabase
        .from('OrderItems')
        .insert(itemsToInsert);

    if (itemsError) {
        console.error('Items Error:', itemsError);
    } else {
        console.log('Order submitted successfully!');
    }
}

export const fetchOrderById = async (orderId: string) => {
    const { data, error } = await supabase
        .from('Orders')
        .select('*')
        .eq('order_id', orderId)
        .single();

    if (error) {
        throw new Error(error.message);
    }

    return data;
};

export const subscribeToOrderUpdates = (
    orderId: string,
    onUpdate: (updatedOrder: any) => void
) => {
    const channel = supabase
        .channel(`order-updates-${orderId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'Orders',
                filter: `order_id=eq.${orderId}`,
            },
            (payload) => {
                onUpdate(payload.new);
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
};

export async function sendOrderEmail(orderId: string, customerName: string) {
    const supabaseFunctionUrl = `${supabaseUrl}/functions/v1/send-order-email`;

    try {
        const response = await fetch(supabaseFunctionUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${supabaseAnonKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                order_id: orderId,
                customer_name: customerName
            })
        });

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `invoice-${orderId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // const data = await response.json();
        // console.log('Function response:', data);
        // return data;
    } catch (error) {
        console.error('Error calling function:', error);
        throw error;
    }
}

// export async function generateInvoice(order) {
//   const pdfDoc = await PDFDocument.create();
//   const page = pdfDoc.addPage([595.28, 841.89]);
//   const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

//   // Embed logo
//   const logoUrl = '/logo.png'; // served from public folder
//   const logoRes = await fetch(logoUrl);
//   const logoBuffer = await logoRes.arrayBuffer();
//   const embeddedLogo = await pdfDoc.embedPng(logoBuffer);
//   const logoDims = embeddedLogo.scale(0.25);

//   page.drawImage(embeddedLogo, {
//     x: 50,
//     y: page.getHeight() - 80,
//     width: logoDims.width,
//     height: logoDims.height,
//   });

//   // Draw header
//   page.drawText(`Invoice: #${order.orderId}`, { x: 50, y: page.getHeight() - 120, size: 18, font });
//   page.drawText(`Customer: ${order.customer_name}`, { x: 50, y: page.getHeight() - 140, size: 12, font });
//   page.drawText(`Phone: ${order.contact_number}`, { x: 50, y: page.getHeight() - 160, size: 12, font });
//   page.drawText(`Location: ${order.location}`, { x: 50, y: page.getHeight() - 180, size: 12, font });

//   // Draw table headers
//   let y = page.getHeight() - 220;
//   page.drawText("Product", { x: 50, y, size: 12, font });
//   page.drawText("Qty", { x: 250, y, size: 12, font });
//   page.drawText("Unit Price", { x: 300, y, size: 12, font });
//   page.drawText("Total", { x: 400, y, size: 12, font });
//   y -= 20;

//   // Draw items
//   let totalAmount = 0;
//   for (const item of order.items) {
//     const total = item.quantity * item.product.price;
//     totalAmount += total;
//     page.drawText(item.product.name, { x: 50, y, size: 10, font });
//     page.drawText(`${item.quantity}`, { x: 250, y, size: 10, font });
//     page.drawText(`R${item.product.price.toFixed(2)}`, { x: 300, y, size: 10, font });
//     page.drawText(`R${total.toFixed(2)}`, { x: 400, y, size: 10, font });
//     y -= 20;
//   }

//   // Draw total
//   y -= 20;
//   page.drawText(`Grand Total: R${totalAmount.toFixed(2)}`, {
//     x: 300,
//     y,
//     size: 12,
//     font,
//     color: rgb(0, 0, 0.5),
//   });

//   // Save PDF
//   const pdfBytes = await pdfDoc.save();
//   const blob = new Blob([pdfBytes], { type: 'application/pdf' });
//   debugger;

//   // Trigger download
//   const link = document.createElement('a');
//   link.href = URL.createObjectURL(blob);
//   link.download = `invoice-${order.orderId}.pdf`;
//   link.click();
// }