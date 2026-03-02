import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { supabase } from "./supabaseClient";
import emailjs from '@emailjs/browser';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const sendOrderConfirmationEmail = async (orderId, customerInfo, items, total) => {
  const templateParams = {
    subject: `New Order: ${orderId}`,
    customer_name: customerInfo.name,
    customer_location: customerInfo.location,
    customer_contact: customerInfo.contactNumber,
    order_items: items.map(item =>
      `<li>${item.quantity}x ${item.product.name} - R${item.product.price * item.quantity}</li>`
    ).join(''),
    total_amount: `R${total.toFixed(2)}`,
    order_date: new Date().toLocaleString()
  };

  emailjs.send(
    'service_fna8t5o',     // EmailJS 'service id'
    'template_vtwnqmc',    // EmailJS'template id'
    templateParams,
    'gYSAEeEgKc0CVNSO0'      // EmailJS public key
  )
  .then(response => {
    console.log('Email sent successfully:', response.status, response.text);
  })
  .catch(err => {
    console.error('Failed to send email:', err);
  });
}
