/**
 * Purchase-confirmation email renderer — Template 1 (owner-selected
 * 2026-10-19): "order placed — in review."
 *
 * Renders the owner's approved copy for every accepted order:
 * - the order is placed and IN REVIEW;
 * - every order is handmade by Amber herself, with love and care, using
 *   100% natural and organic ingredients;
 * - the package ships within 3 to 5 business days of receiving the order;
 * - the customer will be notified when it ships;
 * - the actual order items + totals from the order record;
 * - a payment block that matches the method recorded on the order
 *   (Venmo / Cash App = the handles; embedded card = complete/confirm
 *   on the site).
 *
 * No medical or efficacy claims anywhere — this is a transactional
 * receipt, rendered from the job data the checkout server built.
 */
import { formatPrice } from '../pricing/pricing';
import type { EmailJob, PurchaseConfirmationData } from './email';

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export const ORDER_CONFIRMATION_SUBJECT =
  "Your Amber's Alchemy Apothecary order is placed — in review";

const HANDMADE_LINE =
  'Every order is handmade by Amber herself, with love and care, using ' +
  '100% natural and organic ingredients.';

const SHIPPING_LINE =
  'Your package will ship within 3 to 5 business days of receiving your ' +
  'order, and we will notify you when it ships.';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface ItemLine {
  title: string;
  quantity: number;
  unit_price_cents: number;
}

function itemLines(data: PurchaseConfirmationData): ItemLine[] {
  if (data.items && data.items.length > 0) return data.items;
  // Older jobs carried only the one-line summary.
  return [{ title: data.item_summary, quantity: 1, unit_price_cents: data.total_cents }];
}

/** The payment paragraph(s) for the method recorded on the order. */
function paymentBlockText(data: PurchaseConfirmationData): string[] {
  if (data.payment_method === 'stripe_card_embedded') {
    return [
      'Payment: you chose to pay by card on our website. If your card ' +
        'payment is still pending, you can complete it from the checkout ' +
        'page — your order is prepared once payment is confirmed.',
    ];
  }
  const lines = ['Payment: send your total with Cash App or Venmo:'];
  if (data.venmo_handle) lines.push(`Venmo: ${data.venmo_handle}`);
  if (data.cash_app_handle) lines.push(`Cash App: ${data.cash_app_handle}`);
  lines.push(
    'Please include your order ID in the payment note so we can match ' +
      'it to your order.',
  );
  return lines;
}

function paymentBlockHtml(data: PurchaseConfirmationData): string {
  return paymentBlockText(data)
    .map((line) => `<p style="margin:0 0 8px;">${escapeHtml(line)}</p>`)
    .join('');
}

export function renderPurchaseConfirmation(
  data: PurchaseConfirmationData,
): RenderedEmail {
  const subject = ORDER_CONFIRMATION_SUBJECT;
  const greetingName = data.customer_name?.trim().split(' ')[0];
  const lines = itemLines(data);

  const textParts: string[] = [
    greetingName ? `Hello ${greetingName},` : 'Hello,',
    '',
    `Your order ${data.order_id} is placed and is now in review. ` +
      'Thank you for ordering from Amber\u2019s Alchemy Apothecary.',
    '',
    HANDMADE_LINE,
    '',
    SHIPPING_LINE,
    '',
    'Your order:',
    ...lines.map(
      (line) =>
        `- ${line.title} \u00d7 ${line.quantity} \u2014 ${formatPrice(line.unit_price_cents * line.quantity)}`,
    ),
  ];
  if (typeof data.subtotal_cents === 'number') {
    textParts.push(`Subtotal: ${formatPrice(data.subtotal_cents)}`);
  }
  if ((data.subscriber_discount_cents ?? 0) > 0) {
    textParts.push(
      `Living Grimoire subscriber discount: \u2212${formatPrice(data.subscriber_discount_cents ?? 0)}`,
    );
  }
  textParts.push(
    `Total: ${formatPrice(data.total_cents)}`,
    '',
    ...paymentBlockText(data),
    '',
    'With gratitude,',
    'Amber \u2014 Amber\u2019s Alchemy Apothecary',
  );

  const itemRows = lines
    .map(
      (line) =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #4a3577;">${escapeHtml(line.title)} \u00d7 ${line.quantity}</td>` +
        `<td style="padding:6px 8px;border-bottom:1px solid #4a3577;text-align:right;">${formatPrice(line.unit_price_cents * line.quantity)}</td></tr>`,
    )
    .join('');
  const totalsRows: string[] = [];
  if (typeof data.subtotal_cents === 'number') {
    totalsRows.push(
      `<tr><td style="padding:6px 8px;">Subtotal</td><td style="padding:6px 8px;text-align:right;">${formatPrice(data.subtotal_cents)}</td></tr>`,
    );
  }
  if ((data.subscriber_discount_cents ?? 0) > 0) {
    totalsRows.push(
      `<tr><td style="padding:6px 8px;">Subscriber discount</td><td style="padding:6px 8px;text-align:right;">\u2212${formatPrice(data.subscriber_discount_cents ?? 0)}</td></tr>`,
    );
  }
  totalsRows.push(
    `<tr><td style="padding:6px 8px;font-weight:bold;">Total</td><td style="padding:6px 8px;text-align:right;font-weight:bold;">${formatPrice(data.total_cents)}</td></tr>`,
  );

  const html = [
    '<div style="background:#2a1a40;color:#f3e9d2;font-family:Georgia,serif;padding:32px 24px;">',
    '<div style="max-width:560px;margin:0 auto;">',
    '<h1 style="color:#d4af37;font-size:22px;margin:0 0 16px;">Amber\u2019s Alchemy Apothecary</h1>',
    `<p>${greetingName ? `Hello ${escapeHtml(greetingName)},` : 'Hello,'}</p>`,
    `<p>Your order <strong>${escapeHtml(data.order_id)}</strong> is placed and is now <strong>in review</strong>. Thank you for ordering from Amber\u2019s Alchemy Apothecary.</p>`,
    `<p>${HANDMADE_LINE}</p>`,
    `<p>${SHIPPING_LINE}</p>`,
    '<table style="width:100%;border-collapse:collapse;margin:16px 0;">',
    itemRows,
    totalsRows.join(''),
    '</table>',
    paymentBlockHtml(data),
    '<p style="margin-top:24px;">With gratitude,<br/>Amber \u2014 Amber\u2019s Alchemy Apothecary</p>',
    '</div></div>',
  ].join('');

  return { subject, text: textParts.join('\n'), html };
}

/** Render any email job for a real provider (Template 1 + fallbacks). */
export function renderEmail(job: EmailJob): RenderedEmail {
  if (job.template === 'purchase_confirmation') {
    return renderPurchaseConfirmation(job.data as PurchaseConfirmationData);
  }
  if (job.template === 'weekly_promo') {
    const data = job.data as { subject: string; headline: string; body: string; cta_url: string };
    return {
      subject: data.subject,
      text: `${data.headline}\n\n${data.body}\n\n${data.cta_url}`,
      html: `<div style="background:#2a1a40;color:#f3e9d2;font-family:Georgia,serif;padding:32px 24px;"><h1 style="color:#d4af37;">${escapeHtml(data.headline)}</h1><p>${escapeHtml(data.body)}</p><p><a style="color:#d4af37;" href="${escapeHtml(data.cta_url)}">${escapeHtml(data.cta_url)}</a></p></div>`,
    };
  }
  if (job.template === 'unsubscribe_confirmation') {
    const text = 'You have been unsubscribed from Amber\u2019s Alchemy Apothecary emails. If this was a mistake, just reply to this email.';
    return {
      subject: 'You\u2019ve been unsubscribed \u2014 Amber\u2019s Alchemy Apothecary',
      text,
      html: `<div style="background:#2a1a40;color:#f3e9d2;font-family:Georgia,serif;padding:32px 24px;"><p>${text}</p></div>`,
    };
  }
  const data = job.data as { product_summary?: string };
  const text = `How was your order from Amber\u2019s Alchemy Apothecary? We\u2019d love to hear about ${data.product_summary ?? 'your items'}.`;
  return {
    subject: 'How was your order? \u2014 Amber\u2019s Alchemy Apothecary',
    text,
    html: `<div style="background:#2a1a40;color:#f3e9d2;font-family:Georgia,serif;padding:32px 24px;"><p>${escapeHtml(text)}</p></div>`,
  };
}
