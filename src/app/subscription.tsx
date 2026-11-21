import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { toApiError } from '@/api/client';
import {
  cancelMySubscription,
  getMySubscription,
  getPaymentHistory,
  PaymentHistoryRow,
} from '@/api/payments';
import { getMyEntitlements } from '@/api/tests';
import {
  AppText,
  Badge,
  Button,
  Card,
  EmptyView,
  ErrorBanner,
  ErrorView,
  IconTile,
  LoadingView,
  Screen,
  ScreenHeader,
  SectionHeader,
} from '@/components/ui/kit';
import { space, useColors } from '@/theme';

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
      <ScreenHeader title="My subscription" subtitle="Plan, access and billing history" />

      {error ? <ErrorBanner message={error} /> : null}

      {sub ? (
        <Card tone="hero" style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: c.heroText, fontSize: 22, fontWeight: '800' }}>{sub.plan_name}</Text>
            <Badge label={sub.status} tone={sub.status === 'active' ? 'success' : 'danger'} />
          </View>
          {sub.plan_description ? (
            <Text style={{ color: c.heroMuted, fontSize: 13 }}>{sub.plan_description}</Text>
          ) : null}
          <Text style={{ color: c.heroText, fontSize: 13, fontWeight: '700' }}>
            Billing: {sub.billing_cycle}
            {sub.expires_at ? ` · Valid until ${new Date(sub.expires_at).toLocaleDateString()}` : ''}
          </Text>
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button title="Explore plans" variant="outline" onPress={() => router.push('/pricing')} />
            </View>
            {sub.status === 'active' ? (
              <View style={{ flex: 1 }}>
                <Button title="Cancel" variant="danger" loading={cancelling} onPress={confirmCancel} />
              </View>
            ) : null}
          </View>
        </Card>
      ) : (
        <Card style={{ gap: space.sm }}>
          <IconTile icon="sparkles" color={c.warning} bg={c.warningBg} size={44} />
          <AppText variant="heading">You’re on the Free plan</AppText>
          <AppText variant="small" muted>
            Upgrade to Examerit Pro to unlock full-length mocks, sectional series and premium courses.
          </AppText>
          <Button title="View plans" onPress={() => router.push('/pricing')} />
        </Card>
      )}

      <SectionHeader title="Unlocked categories" />
      <Card>
        {planCats.length === 0 && pkgCats.length === 0 ? (
          <AppText variant="small" muted>
            Free tier access across all categories (daily quizzes, free mocks, syllabus and current affairs).
          </AppText>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {[...new Set([...planCats, ...pkgCats])].map((cat) => (
              <Badge key={cat} label={String(cat)} tone="primary" />
            ))}
          </View>
        )}
      </Card>

      {/* Payment History */}
      <SectionHeader title={`Payment history · ${history.length}`} />
      {history.length === 0 ? (
        <EmptyView title="No transactions yet" message="Any completed plan purchases will appear here." />
      ) : (
        <View style={{ gap: space.sm }}>
          {history.map((item: PaymentHistoryRow) => (
            <Card key={item.id} style={{ padding: space.md, gap: 2 }}>
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
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
