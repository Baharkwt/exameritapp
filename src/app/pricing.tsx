import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { getPlans, PlanItem } from '@/api/payments';
import { AppText, Button, Card, EmptyView, ErrorView, LoadingView, Screen, ScreenHeader, Segmented } from '@/components/ui/kit';
import { space, useColors } from '@/theme';

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
      <ScreenHeader title="Choose your plan" subtitle="Unlimited mocks, live series and analytics" />
      <Segmented
        value={cycle}
        onChange={setCycle}
        options={[
          { key: 'yearly', label: 'Yearly · save up to 50%' },
          { key: 'monthly', label: 'Monthly' },
        ]}
      />

      {plans.length === 0 ? (
        <EmptyView title="No plans available" message="Pricing plans are being updated." />
      ) : (
        <View style={{ gap: space.md, marginTop: space.md }}>
          {plans.map((p: PlanItem) => {
            const price = cycle === 'yearly' ? p.yearly_price : p.monthly_price;
            const features = extractFeatures(p.features);

            return (
              <Card key={p.id} style={{ padding: space.lg }}>
                <AppText variant="heading">{p.display_name}</AppText>
                {p.description ? (
                  <AppText variant="small" muted style={{ marginTop: 2 }}>
                    {p.description}
                  </AppText>
                ) : null}

                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginVertical: space.md }}>
                  <Text style={{ color: c.primary, fontSize: 34, fontWeight: '800', letterSpacing: -1 }}>₹{price}</Text>
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
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
