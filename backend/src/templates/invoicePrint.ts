// src/templates/invoicePrint.ts
// Printable invoice page. Amounts arrive as integer paise and are formatted at the edge only.

const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const money = (paise: number): string => {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}₹${rupees}.${String(abs % 100).padStart(2, '0')}`;
};

const percent = (bps: number): string => `${(bps / 100).toFixed(2).replace(/\.?0+$/, '')}%`;

export function renderInvoiceHtml(invoice: any): string {
  const address = [
    invoice.billing_address_line1,
    invoice.billing_address_line2,
    [invoice.city, invoice.state, invoice.postal_code].filter(Boolean).join(', '),
    invoice.country
  ].filter(Boolean);

  const rows = invoice.items
    .map(
      (item: any) => `
      <tr>
        <td>${esc(item.description)}</td>
        <td class="num">${item.quantity}</td>
        <td class="num">${money(item.unit_price)}</td>
        <td class="num">${money(item.discount_amount)}</td>
        <td class="num">${percent(item.tax_rate)}</td>
        <td class="num">${money(item.tax_amount)}</td>
        <td class="num">${money(item.line_total)}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Invoice ${esc(invoice.invoice_number)}</title>
<style>
  body { font-family: Arial, sans-serif; color: #111; margin: 32px; font-size: 14px; }
  h1 { margin: 0 0 4px; }
  .muted { color: #555; }
  .meta { display: flex; justify-content: space-between; margin: 24px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { border-bottom: 1px solid #ddd; padding: 8px; text-align: left; }
  th { background: #f5f5f5; }
  .num { text-align: right; }
  .totals { width: 320px; margin-left: auto; margin-top: 16px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .grand { font-weight: bold; border-top: 2px solid #111; font-size: 16px; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <h1>Invoice ${esc(invoice.invoice_number)}</h1>
  <div class="muted">Brightloop Software &middot; Status: ${esc(invoice.status)}</div>

  <div class="meta">
    <div>
      <strong>Bill to</strong><br>
      ${esc(invoice.legal_name || invoice.customer_name)}<br>
      ${address.map((line) => `${esc(line)}<br>`).join('')}
      ${invoice.tax_id ? `Tax ID: ${esc(invoice.tax_id)}<br>` : ''}
      ${invoice.customer_email ? esc(invoice.customer_email) : ''}
    </div>
    <div>
      Issue date: ${esc(invoice.issue_date)}<br>
      Due date: ${esc(invoice.due_date)}<br>
      ${invoice.subscription_number ? `Subscription: ${esc(invoice.subscription_number)}<br>` : ''}
      ${
        invoice.billing_period_start
          ? `Period: ${esc(invoice.billing_period_start)} to ${esc(invoice.billing_period_end)}`
          : ''
      }
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th><th class="num">Qty</th><th class="num">Unit price</th>
        <th class="num">Discount</th><th class="num">Tax rate</th>
        <th class="num">Tax</th><th class="num">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div><span>Subtotal</span><span>${money(invoice.subtotal)}</span></div>
    <div><span>Discount</span><span>-${money(invoice.discount_amount)}</span></div>
    <div><span>Tax</span><span>${money(invoice.tax_amount)}</span></div>
    <div class="grand"><span>Total</span><span>${money(invoice.total_amount)}</span></div>
  </div>

  ${invoice.notes ? `<p class="muted">${esc(invoice.notes)}</p>` : ''}
</body>
</html>`;
}
