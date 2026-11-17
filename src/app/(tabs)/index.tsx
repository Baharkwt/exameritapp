import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { getExams } from '@/api/catalog';
import { getPersonalizedExamAlerts, getStreak } from '@/api/dashboard';
import { getStudentCategories, getStudentTargets } from '@/api/student';
import { AppText, Button, ErrorView, LoadingView, Screen } from '@/components/ui/kit';
import { useAuth } from '@/features/auth/auth-provider';
import { radius, space, useColors } from '@/theme';

type QuickAction = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  bg: string;
  onPress: () => void;
};

export default function Home() {
  const { user } = useAuth();
  const c = useColors();

  const myCatsQ = useQuery({ queryKey: ['student-categories'], queryFn: getStudentCategories });
  const myTargetsQ = useQuery({ queryKey: ['student-targets'], queryFn: getStudentTargets });
  const streakQ = useQuery({ queryKey: ['streak'], queryFn: getStreak });
  const alertsQ = useQuery({ queryKey: ['personalized-alerts'], queryFn: getPersonalizedExamAlerts });

  const primaryCatId = myCatsQ.data?.categories[0]?.categoryId;
  const recommendedExamsQ = useQuery({
    queryKey: ['exams', primaryCatId ?? 'popular'],
    queryFn: () => getExams(primaryCatId ? { category: primaryCatId } : undefined),
    enabled: !!myCatsQ.data,
  });

  if (myCatsQ.isLoading || myTargetsQ.isLoading) return <LoadingView />;
  if (myCatsQ.isError) {
    return <ErrorView message={myCatsQ.error.message} onRetry={() => myCatsQ.refetch()} />;
  }

  const activeCategories = myCatsQ.data?.categories ?? [];
  const targets = myTargetsQ.data ?? [];
  const streak = streakQ.data;
  const alerts = alertsQ.data?.alerts ?? [];
  const needsSetup = !myCatsQ.data?.onboardingCompleted || activeCategories.length === 0 || targets.length === 0;

  const quickActions: QuickAction[] = [
    {
      label: 'Mock Tests',
      icon: 'document-text',
      color: c.primary,
      bg: c.primarySoft,
      onPress: () => router.push('/(tabs)/tests'),
    },
    {
      label: 'Live Arena',
      icon: 'radio',
      color: c.live,
      bg: c.liveBg,
      onPress: () => router.push('/live-tests'),
    },
    {
      label: 'All Exams',
      icon: 'school',
      color: c.info,
      bg: c.infoBg,
      onPress: () => router.push('/exams'),
    },
    {
      label: 'Daily News',
      icon: 'newspaper',
      color: c.success,
      bg: c.successBg,
      onPress: () => router.push('/current-affairs'),
    },
    {
      label: 'Syllabus',
      icon: 'map',
      color: c.marked,
      bg: c.markedBg,
      onPress: () => router.push('/syllabus'),
    },
    {
      label: 'Vocab Hub',
      icon: 'language',
      color: c.info,
      bg: c.infoBg,
      onPress: () => router.push('/vocabulary'),
    },
    {
      label: 'Mistakes',
      icon: 'journal',
      color: c.warning,
      bg: c.warningBg,
      onPress: () => router.push('/mistakes'),
    },
    {
      label: 'Leaderboard',
      icon: 'trophy',
      color: c.star,
      bg: c.warningBg,
      onPress: () => router.push('/leaderboard'),
    },
  ];

  const refreshing = myCatsQ.isRefetching || myTargetsQ.isRefetching || streakQ.isRefetching || alertsQ.isRefetching;
  const onRefresh = () => {
    myCatsQ.refetch();
    myTargetsQ.refetch();
    streakQ.refetch();
    alertsQ.refetch();
    recommendedExamsQ.refetch();
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      {/* Compact Top Bar */}
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <AppText variant="title">
            Hi, {user?.name?.split(' ')[0] || 'Student'}
          </AppText>
          <Pressable
            onPress={() => router.push('/onboarding')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
            <AppText variant="small" style={{ color: c.primary, fontWeight: '600' }} numberOfLines={1}>
              {targets[0] ? `Goal: ${targets[0].name}` : 'Tap to set target exam'}
            </AppText>
            <Ionicons name="chevron-down" size={12} color={c.primary} />
          </Pressable>
        </View>

        <View style={styles.topActions}>
          <View style={[styles.streakPill, { backgroundColor: c.surface, borderColor: c.border }]}>
            <AppText variant="small" style={{ fontWeight: '700' }}>
              🔥 {streak?.currentStreak ?? 0}d
            </AppText>
            <AppText variant="small" muted>
              · ⭐ {streak?.totalPoints ?? 0}
            </AppText>
          </View>
          <Pressable
            onPress={() => router.push('/notifications')}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            hitSlop={6}
            style={[styles.iconBtn, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Ionicons name="notifications-outline" size={20} color={c.text} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/subscription')}
            accessibilityRole="button"
            accessibilityLabel="Upgrade to Pro"
            hitSlop={6}
            style={[styles.proPill, { backgroundColor: c.warningBg, borderColor: c.warning }]}>
            <AppText variant="small" style={{ color: c.warningFg, fontWeight: '800', fontSize: 12 }}>
              PRO
            </AppText>
          </Pressable>
        </View>
      </View>

      {/* Active Category Strip */}
      {activeCategories.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.md }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {activeCategories.map((cat) => (
              <Pressable
                key={cat.categoryId}
                onPress={() =>
                  router.push({ pathname: '/exams', params: { category: cat.categoryId } })
                }
                style={[styles.catBadge, { backgroundColor: c.surface, borderColor: c.border }]}>
                <AppText variant="small" style={{ fontWeight: '600' }}>
                  {cat.name}
                </AppText>
              </Pressable>
            ))}
            <Pressable
              onPress={() => router.push('/onboarding')}
              style={[styles.catBadge, { backgroundColor: c.bg, borderColor: c.border }]}>
              <AppText variant="small" style={{ color: c.primary, fontWeight: '600' }}>
                + Edit Goals
              </AppText>
            </Pressable>
          </View>
        </ScrollView>
      ) : null}

      {/* Compact Onboarding Banner if incomplete */}
      {needsSetup ? (
        <View style={[styles.setupCard, { backgroundColor: c.surface, borderColor: c.primary }]}>
          <View style={{ flex: 1 }}>
            <AppText style={{ fontWeight: '700' }}>Set your target exam</AppText>
            <AppText variant="small" muted>
              Unlock personalized mocks, syllabus & daily alerts.
            </AppText>
          </View>
          <Button title="Setup" onPress={() => router.push('/onboarding')} />
        </View>
      ) : null}

      {/* 8-Tile Quick Launch Grid (2x4) */}
      <View style={[styles.gridCard, { backgroundColor: c.surface, borderColor: c.border }]}>
        {quickActions.map((item) => (
          <Pressable
            key={item.label}
            onPress={item.onPress}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            style={styles.gridItem}>
            <View style={[styles.gridIconWrap, { backgroundColor: item.bg }]}>
              <Ionicons name={item.icon} size={18} color={item.color} />
            </View>
            <AppText variant="small" style={styles.gridLabel} numberOfLines={1}>
              {item.label}
            </AppText>
          </Pressable>
        ))}
      </View>

      {/* Target Exams Section */}
      <View style={styles.sectionHeader}>
        <AppText variant="heading">Target Exams ({targets.length}/3)</AppText>
        <Pressable onPress={() => router.push('/exams')}>
          <AppText variant="small" style={{ color: c.primary, fontWeight: '600' }}>
            Browse All →
          </AppText>
        </Pressable>
      </View>

      {targets.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <AppText variant="small" muted style={{ marginBottom: space.sm }}>
            No target exams selected yet.
          </AppText>
          <Button title="Choose Target Exams" variant="outline" onPress={() => router.push('/onboarding')} />
        </View>
      ) : (
        <View style={{ gap: 6, marginBottom: space.md }}>
          {targets.map((t, index) => (
            <Pressable
              key={t.id}
              onPress={() =>
                router.push({
                  pathname: '/exams/[id]',
                  params: { id: t.id, name: t.name, category: t.category },
                })
              }
              style={[styles.targetCard, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={[styles.priorityBadge, { backgroundColor: index === 0 ? c.primary : c.bg }]}>
                <AppText
                  variant="small"
                  style={{
                    color: index === 0 ? c.primaryText : c.textMuted,
                    fontWeight: '700',
                    fontSize: 10,
                  }}>
                  {index === 0 ? 'MAIN' : `#${index + 1}`}
                </AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={{ fontWeight: '600' }} numberOfLines={1}>
                  {t.name}
                </AppText>
              </View>
              <View style={[styles.practicePill, { backgroundColor: c.bg }]}>
                <AppText variant="small" style={{ color: c.primary, fontWeight: '700', fontSize: 11 }}>
                  Tests →
                </AppText>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {/* Popular / Category Exams Strip */}
      {(recommendedExamsQ.data ?? []).length > 0 ? (
        <View style={{ marginBottom: space.md }}>
          <View style={styles.sectionHeader}>
            <AppText variant="heading">Popular Exams</AppText>
            <Pressable onPress={() => router.push('/exams')}>
              <AppText variant="small" style={{ color: c.primary, fontWeight: '600' }}>
                See all
              </AppText>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(recommendedExamsQ.data ?? []).slice(0, 8).map((ex) => (
                <Pressable
                  key={ex.id}
                  onPress={() =>
                    router.push({
                      pathname: '/exams/[id]',
                      params: { id: ex.id, name: ex.name, category: primaryCatId },
                    })
                  }
                  style={[styles.popularCard, { backgroundColor: c.surface, borderColor: c.border }]}>
                  <AppText style={{ fontWeight: '600', fontSize: 12.5 }} numberOfLines={2}>
                    {ex.name}
                  </AppText>
                  <AppText variant="small" style={{ color: c.primary, fontWeight: '600', marginTop: 4 }}>
                    Open →
                  </AppText>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}

      {/* Personalized Exam Alerts */}
      <View style={styles.sectionHeader}>
        <AppText variant="heading">Exam Updates & Alerts</AppText>
      </View>
      {alerts.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <AppText variant="small" muted>
            No active exam notifications right now.
          </AppText>
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          {alerts.slice(0, 5).map((alert) => (
            <Pressable
              key={alert.id}
              onPress={() =>
                router.push({
                  pathname: '/exams/[id]',
                  params: { id: alert.exam_id, name: alert.exam_name },
                })
              }
              style={[styles.alertCard, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <AppText variant="small" style={{ color: c.primary, fontWeight: '700', fontSize: 11 }}>
                  {alert.exam_name} · {alert.update_type}
                </AppText>
                {alert.is_new ? (
                  <AppText variant="small" style={{ color: c.success, fontWeight: '700', fontSize: 10 }}>
                    NEW
                  </AppText>
                ) : null}
              </View>
              <AppText style={{ fontWeight: '600', marginTop: 1 }} numberOfLines={1}>
                {alert.title}
              </AppText>
              {alert.exam_date_display || alert.total_vacancies ? (
                <AppText variant="small" muted style={{ marginTop: 2 }}>
                  {[
                    alert.exam_date_display ? `Date: ${alert.exam_date_display}` : null,
                    alert.total_vacancies ? `${alert.total_vacancies} Vacancies` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </AppText>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
    gap: space.sm,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proPill: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  catBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  setupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: space.sm,
    marginBottom: space.md,
  },
  gridCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: space.md,
  },
  gridItem: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 4,
  },
  gridIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  emptyCard: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: space.md,
  },
  targetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: space.sm,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  practicePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  popularCard: {
    width: 132,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'space-between',
  },
  alertCard: {
    paddingHorizontal: space.md,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
