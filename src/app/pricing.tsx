import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { getPlans, PlanItem } from '@/api/payments';
import { AppText, Button, EmptyView, ErrorView, LoadingView, Screen } from '@/components/ui/kit';
import { radius, space, useColors } from '@/theme';

function extractFeatures(raw: PlanItem['features']): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (raw && typeof raw === 'object') {
    return Object.entries(raw)
      .filter(([, v]) => Boolean(v))
      .map(([k, v]) => (typeof v === 'string' ? v : k.replace(/_/g, ' ')));
  }
  return [];
}

export default function PricingScreen() {
  const c = useColors();
  const [cycle, setCycle] = useState<'yearly' | 'monthly'>('yearly');

  const plansQ = useQuery({ queryKey: ['plans'], queryFn: getPlans });

  if (plansQ.isLoading) return <LoadingView />;
  if (plansQ.isError) {
    return <ErrorView message={plansQ.error.message} onRetry={() => plansQ.refetch()} />;
  }

  const plans = plansQ.data ?? [];

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/subscription'))} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="title" style={{ fontSize: 22 }}>
            Choose Your Plan
          </AppText>
          <AppText variant="small" muted>
            Unlock unlimited mock tests, live series & analytics
          </AppText>
        </View>
      </View>

      {/* Billing Cycle Toggle */}
      <View style={[styles.segmented, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Pressable
          onPress={() => setCycle('yearly')}
          style={[styles.segmentBtn, cycle === 'yearly' ? { backgroundColor: c.primary } : null]}>
          <AppText
            variant="small"
            style={{ color: cycle === 'yearly' ? c.primaryText : c.text, fontWeight: '700' }}>
            Yearly (Save up to 50%)
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => setCycle('monthly')}
          style={[styles.segmentBtn, cycle === 'monthly' ? { backgroundColor: c.primary } : null]}>
          <AppText
            variant="small"
            style={{ color: cycle === 'monthly' ? c.primaryText : c.text, fontWeight: '700' }}>
            Monthly
          </AppText>
        </Pressable>
      </View>

      {plans.length === 0 ? (
        <EmptyView title="No plans available" message="Pricing plans are being updated." />
      ) : (
        <View style={{ gap: space.md, marginTop: space.md }}>
          {plans.map((p: PlanItem) => {
            const price = cycle === 'yearly' ? p.yearly_price : p.monthly_price;
            const features = extractFeatures(p.features);

            return (
              <View
                key={p.id}
                style={[styles.planCard, { backgroundColor: c.surface, borderColor: c.border }]}>
                <AppText variant="heading">{p.display_name}</AppText>
                {p.description ? (
                  <AppText variant="small" muted style={{ marginTop: 2 }}>
                    {p.description}
                  </AppText>
                ) : null}

                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginVertical: space.md }}>
                  <AppText variant="title" style={{ color: c.primary }}>
                    ₹{price}
                  </AppText>
                  <AppText variant="small" muted>
                    / {cycle === 'yearly' ? 'year' : 'month'}
                  </AppText>
                </View>

                {features.length > 0 ? (
                  <View style={{ gap: 6, marginBottom: space.md }}>
                    {features.map((feat, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="checkmark-circle" size={16} color={c.success} />
                        <AppText variant="small" style={{ flex: 1 }}>
                          {feat}
                        </AppText>
                      </View>
                    ))}
                  </View>
                ) : null}

                <Button
                  title={`Continue with ${p.display_name}`}
                  onPress={() =>
                    router.push({
                      pathname: '/checkout',
                      params: {
                        planId: String(p.id),
                        planName: p.display_name,
                        cycle,
                        price: String(price),
                      },
                    })
                  }
                />
              </View>
            );
          })}
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
  segmented: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  planCard: {
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});

