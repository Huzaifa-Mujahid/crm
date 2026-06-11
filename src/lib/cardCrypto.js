/**
 * cardCrypto.js — Card Display Helpers
 * ─────────────────────────────────────────────────────────────────
 * STRIPE INTEGRATION KE BAAD:
 *   - Card data ab Stripe mein store hota hai (PCI compliant) ✅
 *   - Hamara DB sirf stripe_customer_id aur stripe_payment_method_id rakhta hai ✅
 *   - Sirf card brand + last4 display ke liye DB mein aata hai (Stripe se) ✅
 *
 * Ye functions sirf display helpers hain — koi encryption nahi.
 * ─────────────────────────────────────────────────────────────────
 */

/** Card number ka masked display format return karta hai. */
export function maskCard(last4) {
  if (!last4) return '—';
  return `**** **** **** ${String(last4).slice(-4)}`;
}

/** CVV ko mask karta hai. */
export function maskCvv() {
  return '***';
}

/** Expiry date ko display format mein return karta hai. */
export function formatExpiry(month, year) {
  if (!month || !year) return '—';
  return `${String(month).padStart(2, '0')}/${String(year).slice(-2)}`;
}

/** Card brand ko readable format mein return karta hai. */
export function formatCardBrand(brand) {
  const brands = {
    visa: 'Visa',
    mastercard: 'MasterCard',
    amex: 'American Express',
    discover: 'Discover',
    diners: 'Diners Club',
    jcb: 'JCB',
    unionpay: 'UnionPay',
  };
  return brands[brand?.toLowerCase()] ?? brand ?? 'Card';
}

/** Brand ke liye emoji/icon return karta hai. */
export function cardBrandEmoji(brand) {
  const icons = {
    visa: '💳',
    mastercard: '💳',
    amex: '💳',
    discover: '💳',
  };
  return icons[brand?.toLowerCase()] ?? '💳';
}
