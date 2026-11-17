import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { toApiError } from '@/api/client';
import {
  cancelMySubscription,
  getMySubscription,
  getPaymentHistory,
  PaymentHistoryRow,
} from '@/api/payments';
import { getMyEntitlements } from '@/api/tests';
import { AppText, Button, EmptyView, ErrorBanner, ErrorView, LoadingView, Screen } from '@/components/ui/kit';
import { radius, space, useColors } from '@/theme';

export default function SubscriptionScreen() {
  const c = useColors();
  const qc = useQueryClient();

  const subQ = useQuery({ queryKey: ['my-subscription'], queryFn: getMySubscription });
  const entQ = useQuery({ queryKey: ['my-entitlements'], queryFn: getMyEntitlements });
  const histQ = useQuery({ queryKey: ['payment-history'], queryFn: getPaymentHistory });

  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (subQ.isLoading || histQ.isLoading) return <LoadingView />;
  if (subQ.isError) return <ErrorView message={subQ.error.message} onRetry={() => subQ.refetch()} />;

  const sub = subQ.data;
  const history = histQ.data ?? [];
  const planCats = entQ.data?.planCategoryIds ?? [];
  const pkgCats = entQ.data?.packageCategoryIds ?? [];

  function confirmCancel() {
    Alert.alert(
      'Cancel Subscription?',
      'Are you sure you want to cancel your active subscription?',
      [
        { text: 'Keep Plan', style: 'cancel' },
        {
          text: 'Cancel Plan',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            setError(null);
            try {
              await cancelMySubscription();
              await Promise.all([
                qc.invalidateQueries({ queryKey: ['my-subscription'] }),
                qc.invalidateQueries({ queryKey: ['my-entitlements'] }),
              ]);
            } catch (e) {
              setError(toApiError(e).message);
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="title" style={{ fontSize: 22 }}>
            My Subscription
          </AppText>
          <AppText variant="small" muted>
            Manage your Examerit Pro plan, entitlements & billing history
          </AppText>
        </View>
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      {/* Current Subscription Card */}
      {sub ? (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.primary, borderWidth: 1.5 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <AppText variant="heading">{sub.plan_name}</AppText>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: sub.status === 'active' ? c.successBg : c.liveBg },
              ]}>
              <AppText
                variant="small"
                style={{
                  fontWeight: '700',
                  fontSize: 11,
                  color: sub.status === 'active' ? c.successFg : c.dangerFg,
                }}>
                {sub.status.toUpperCase()}
              </AppText>
            </View>
          </View>

          {sub.plan_description ? (
            <AppText variant="small" muted style={{ marginTop: 4 }}>
              {sub.plan_description}
            </AppText>
          ) : null}

          <AppText variant="small" style={{ marginTop: space.sm }}>
            Billing Cycle: <AppText variant="small" style={{ fontWeight: '700' }}>{sub.billing_cycle}</AppText>
          </AppText>
          {sub.expires_at ? (
            <AppText variant="small" muted>
              Valid Until: {new Date(sub.expires_at).toLocaleDateString()}
            </AppText>
          ) : null}

          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
            <Button title="Explore Plans" variant="outline" onPress={() => router.push('/pricing')} />
            {sub.status === 'active' ? (
              <Button
                title="Cancel"
                variant="danger"
                loading={cancelling}
                onPress={confirmCancel}
              />
            ) : null}
          </View>
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <AppText variant="heading">Free Tier</AppText>
          <AppText variant="small" muted style={{ marginVertical: space.xs }}>
            You are currently on the Free plan. Upgrade to Examerit Pro to unlock full-length mock tests, sectional series, and premium courses.
          </AppText>
          <Button title="View Pricing Plans" onPress={() => router.push('/pricing')} />
        </View>
      )}

      {/* Server-Resolved Entitlements */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <AppText variant="heading" style={{ marginBottom: 4 }}>
          Unlocked Exam Categories
        </AppText>
        {planCats.length === 0 && pkgCats.length === 0 ? (
          <AppText variant="small" muted>
            Free tier access across all categories (Daily Quizzes, Free Mocks, Syllabus & Current Affairs).
          </AppText>
        ) : (
          <AppText variant="small">
            Active Paid Access: {[...new Set([...planCats, ...pkgCats])].join(', ')}
          </AppText>
        )}
      </View>

      {/* Payment History */}
      <AppText variant="heading" style={{ marginTop: space.md, marginBottom: space.sm }}>
        Payment History ({history.length})
      </AppText>
      {history.length === 0 ? (
        <EmptyView title="No transactions yet" message="Any completed plan purchases will appear here." />
      ) : (
        <View style={{ gap: space.sm }}>
          {history.map((item: PaymentHistoryRow) => (
            <View
              key={item.id}
              style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <AppText style={{ fontWeight: '700' }}>
                  {item.plan_name || 'Subscription'} ({item.billing_cycle || 'Plan'})
                </AppText>
                <AppText style={{ fontWeight: '700', color: c.primary }}>₹{item.amount}</AppText>
              </View>
              <AppText variant="small" muted>
                {new Date(item.created_at).toLocaleDateString()} · Status: {item.status}
                {item.payment_method ? ` · ${item.payment_method.toUpperCase()}` : ''}
              </AppText>
            </View>
          ))}
        </View>
      )}
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
});

