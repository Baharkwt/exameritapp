import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { toApiError } from '@/api/client';
import {
  CouponValidationResponse,
  createSubscriptionOrder,
  getMySubscription,
  validateCoupon,
  verifySubscriptionPayment,
} from '@/api/payments';
import { AppText, Button, ErrorBanner, Screen } from '@/components/ui/kit';
import { radius, space, useColors } from '@/theme';

const INDIAN_PAYMENT_METHODS = [
  { id: 'upi', label: 'UPI (Any UPI ID)', desc: 'BHIM, PhonePe, Bank UPI', icon: 'qr-code-outline' },
  { id: 'gpay', label: 'Google Pay (GPay)', desc: 'Instant UPI intent', icon: 'phone-portrait-outline' },
  { id: 'paytm', label: 'Paytm UPI / Wallet', desc: 'Paytm app or linked UPI', icon: 'wallet-outline' },
  { id: 'card', label: 'Debit / Credit Card', desc: 'RuPay, Visa, Mastercard', icon: 'card-outline' },
  { id: 'netbanking', label: 'Net Banking', desc: 'SBI, HDFC, ICICI, Axis & 40+ banks', icon: 'business-outline' },
] as const;

export default function CheckoutScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{
    planId: string;
    planName?: string;
    cycle?: 'monthly' | 'yearly';
    price?: string;
  }>();

  const baseAmount = Math.max(0, Number(params.price ?? 0));
  const billingCycle: 'monthly' | 'yearly' = params.cycle === 'monthly' ? 'monthly' : 'yearly';

  const [couponCode, setCouponCode] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationResponse | null>(null);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<string>('upi');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discount = appliedCoupon ? appliedCoupon.discount_amount : 0;
  const finalAmount = Math.max(0, baseAmount - discount);

  async function handleApplyCoupon() {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    setCouponBusy(true);
    setCouponMessage(null);
    setError(null);
    try {
      const res = await validateCoupon({ code, order_amount: baseAmount });
      setAppliedCoupon(res);
      setCouponMessage(`Coupon ${res.code} applied! Saved ₹${res.discount_amount}`);
    } catch (e) {
      setAppliedCoupon(null);
      setError(toApiError(e).message);
    } finally {
      setCouponBusy(false);
    }
  }

  async function handleProceedToPay() {
    setPaying(true);
    setError(null);
    try {
      // 1. Create order on the backend
      const order = await createSubscriptionOrder({
        plan_id: Number(params.planId),
        billing_cycle: billingCycle,
        coupon_code: appliedCoupon?.code,
        payment_method: paymentMethod,
      });

      // 2. Verify order status with server (never trust client callback alone)
      await verifySubscriptionPayment({
        ...order,
        plan_id: Number(params.planId),
        billing_cycle: billingCycle,
      });

      // 3. Authoritative server check via GET /api/subscriptions/me
      await getMySubscription();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['my-subscription'] }),
        qc.invalidateQueries({ queryKey: ['my-entitlements'] }),
        qc.invalidateQueries({ queryKey: ['payment-history'] }),
      ]);
      router.replace('/subscription');
    } catch (e) {
      // Note: backend/routes/payments.js currently returns 503:
      // "Online payments are not available yet" until a live gateway is connected.
      setError(toApiError(e).message);
    } finally {
      setPaying(false);
    }
  }

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/pricing'))} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="title" style={{ fontSize: 22 }}>
            Secure Checkout
          </AppText>
          <AppText variant="small" muted>
            UPI, Google Pay, Paytm, Cards & Net Banking
          </AppText>
        </View>
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      {/* Order Summary */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <AppText variant="heading">{params.planName || 'Examerit Pro Plan'}</AppText>
        <AppText variant="small" muted>
          Billing Cycle: {billingCycle.toUpperCase()}
        </AppText>

        <View style={styles.priceRow}>
          <AppText variant="small" muted>
            Plan Price
          </AppText>
          <AppText>₹{baseAmount.toFixed(2)}</AppText>
        </View>
        {discount > 0 ? (
          <View style={styles.priceRow}>
            <AppText variant="small" style={{ color: c.success }}>
              Coupon Discount ({appliedCoupon?.code})
            </AppText>
            <AppText style={{ color: c.success, fontWeight: '700' }}>
              -₹{discount.toFixed(2)}
            </AppText>
          </View>
        ) : null}
        <View style={[styles.priceRow, { borderTopWidth: 1, borderTopColor: c.border, paddingTop: space.sm }]}>
          <AppText style={{ fontWeight: '700' }}>Total Payable</AppText>
          <AppText variant="heading" style={{ color: c.primary }}>
            ₹{finalAmount.toFixed(2)}
          </AppText>
        </View>
      </View>

      {/* Coupon Box */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <AppText style={{ fontWeight: '600', marginBottom: 6 }}>Have a Promo / Coupon Code?</AppText>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <TextInput
            placeholder="Enter coupon code"
            placeholderTextColor={c.textMuted}
            value={couponCode}
            onChangeText={setCouponCode}
            autoCapitalize="characters"
            style={[
              styles.couponInput,
              { backgroundColor: c.bg, color: c.text, borderColor: c.border },
            ]}
          />
          <Button title="Apply" variant="outline" loading={couponBusy} onPress={handleApplyCoupon} />
        </View>
        {couponMessage ? (
          <AppText variant="small" style={{ color: c.success, marginTop: 6, fontWeight: '600' }}>
            ✓ {couponMessage}
          </AppText>
        ) : null}
      </View>

      {/* Indian Payment Methods */}
      <AppText variant="heading" style={{ marginVertical: space.sm }}>
        Select Payment Method
      </AppText>
      <View style={{ gap: space.xs, marginBottom: space.lg }}>
        {INDIAN_PAYMENT_METHODS.map((m) => {
          const active = paymentMethod === m.id;
          return (
            <Pressable
              key={m.id}
              onPress={() => setPaymentMethod(m.id)}
              style={[
                styles.methodCard,
                {
                  backgroundColor: c.surface,
                  borderColor: active ? c.primary : c.border,
                  borderWidth: active ? 2 : 1,
                },
              ]}>
              <Ionicons name={m.icon} size={22} color={active ? c.primary : c.textMuted} />
              <View style={{ flex: 1 }}>
                <AppText style={{ fontWeight: '600' }}>{m.label}</AppText>
                <AppText variant="small" muted>
                  {m.desc}
                </AppText>
              </View>
              <Ionicons
                name={active ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={active ? c.primary : c.textMuted}
              />
            </Pressable>
          );
        })}
      </View>

      <Button
        title={`Pay ₹${finalAmount.toFixed(0)} Now`}
        loading={paying}
        onPress={handleProceedToPay}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.md,
  },
  card: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: space.sm,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  couponInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontSize: 15,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.md,
    gap: space.md,
  },
});

