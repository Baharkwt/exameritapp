import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { toApiError } from '@/api/client';
import {
  CouponValidationResponse,
  createSubscriptionOrder,
  getMySubscription,
  validateCoupon,
  verifySubscriptionPayment,
} from '@/api/payments';
import { AppText, Button, Card, ErrorBanner, IconTile, Screen, ScreenHeader, SectionHeader } from '@/components/ui/kit';
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
      <ScreenHeader title="Checkout" subtitle="UPI, cards and net banking" onBack={() => (router.canGoBack() ? router.back() : router.replace('/pricing'))} />

      {error ? <ErrorBanner message={error} /> : null}

      {/* Order Summary */}
      <Card tone="hero" style={{ marginBottom: space.md, gap: 2 }}>
        <Text style={{ color: c.heroText, fontSize: 20, fontWeight: '800' }}>{params.planName || 'Examerit Pro Plan'}</Text>
        <Text style={{ color: c.heroMuted, fontSize: 12.5, fontWeight: '700' }}>
          {billingCycle.toUpperCase()} BILLING
        </Text>

        <View style={styles.priceRow}>
          <Text style={{ color: c.heroMuted }}>Plan price</Text>
          <Text style={{ color: c.heroText, fontWeight: '700' }}>₹{baseAmount.toFixed(2)}</Text>
        </View>
        {discount > 0 ? (
          <View style={styles.priceRow}>
            <Text style={{ color: c.heroMuted }}>Coupon ({appliedCoupon?.code})</Text>
            <Text style={{ color: c.heroText, fontWeight: '700' }}>-₹{discount.toFixed(2)}</Text>
          </View>
        ) : null}
        <View style={[styles.priceRow, { borderTopWidth: 1, borderTopColor: c.heroSoft, paddingTop: space.sm, marginTop: space.md }]}>
          <Text style={{ color: c.heroText, fontWeight: '800' }}>Total payable</Text>
          <Text style={{ color: c.heroText, fontSize: 24, fontWeight: '800' }}>₹{finalAmount.toFixed(2)}</Text>
        </View>
      </Card>

      {/* Coupon Box */}
      <Card style={{ marginBottom: space.md }}>
        <AppText style={{ fontWeight: '700', marginBottom: 8 }}>Have a coupon code?</AppText>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <TextInput
            placeholder="Enter coupon code"
            placeholderTextColor={c.textMuted}
            value={couponCode}
            onChangeText={setCouponCode}
            autoCapitalize="characters"
            style={[
              styles.couponInput,
              { backgroundColor: c.inputBg, color: c.text, borderColor: c.border },
            ]}
          />
          <Button title="Apply" variant="outline" loading={couponBusy} onPress={handleApplyCoupon} />
        </View>
        {couponMessage ? (
          <AppText variant="small" style={{ color: c.success, marginTop: 6, fontWeight: '600' }}>
            ✓ {couponMessage}
          </AppText>
        ) : null}
      </Card>

      {/* Indian Payment Methods */}
      <SectionHeader title="Payment method" />
      <View style={{ gap: space.sm, marginBottom: space.lg }}>
        {INDIAN_PAYMENT_METHODS.map((m) => {
          const active = paymentMethod === m.id;
          return (
            <Card
              key={m.id}
              onPress={() => setPaymentMethod(m.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                padding: space.md,
                borderWidth: 2,
                borderColor: active ? c.primary : 'transparent',
              }}>
              <IconTile icon={m.icon} color={active ? c.primary : c.textMuted} bg={active ? c.primarySoft : c.skeleton} size={40} />
              <View style={{ flex: 1 }}>
                <AppText style={{ fontWeight: '700' }}>{m.label}</AppText>
                <AppText variant="small" muted>
                  {m.desc}
                </AppText>
              </View>
              <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={active ? c.primary : c.textMuted} />
            </Card>
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
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  couponInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    fontSize: 15,
  },
});
