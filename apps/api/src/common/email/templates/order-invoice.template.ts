type OrderInvoiceTemplateInput = {
  appName: string;
  customerName: string;
  orderNumber: string;
  amount: string;
  currency: string;
  invoiceUrl: string;
  paymentUrl: string;
  pdfUrl: string;
};

export function renderOrderInvoiceEmailTemplate(input: OrderInvoiceTemplateInput) {
  const safeName = input.customerName || 'Customer';

  return `
  <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.5;">
    <h2 style="margin: 0 0 12px;">${input.appName} invoice ready</h2>
    <p style="margin: 0 0 12px;">Hi ${safeName},</p>
    <p style="margin: 0 0 12px;">Your invoice for order <strong>${input.orderNumber}</strong> is ready.</p>
    <p style="margin: 0 0 12px;">Amount due: <strong>${input.currency} ${input.amount}</strong>.</p>
    <div style="margin: 16px 0;">
      <a href="${input.paymentUrl}" style="display: inline-block; background: #111827; color: #fff; padding: 10px 16px; text-decoration: none; border-radius: 6px; margin-right: 8px;">Pay now</a>
      <a href="${input.invoiceUrl}" style="display: inline-block; background: #f3f4f6; color: #111827; padding: 10px 16px; text-decoration: none; border-radius: 6px;">View invoice</a>
    </div>
    <p style="margin: 0 0 12px;">Download PDF: <a href="${input.pdfUrl}">${input.pdfUrl}</a></p>
    <p style="margin: 24px 0 0; color: #6b7280;">Thank you for shopping with ${input.appName}.</p>
  </div>
  `;
}
