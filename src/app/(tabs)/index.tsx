import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getLearningSummary } from '@/api/analytics';
import { getExams } from '@/api/catalog';
import { getPersonalizedExamAlerts, getStreak } from '@/api/dashboard';
import { getStudentCategories, getStudentTargets } from '@/api/student';
import { getNotifications } from '@/api/support';
import {
  AppText,
  Badge,
  Button,
  Card,
  ErrorView,
  IconTile,
  LoadingView,
  ProgressRing,
  Screen,
  SectionHeader,
  Skeleton,
} from '@/components/ui/kit';
import { ExamSwitcher } from '@/components/ExamSwitcher';
import { useAuth } from '@/features/auth/auth-provider';
import { useActiveExam } from '@/features/exam/active-exam';
import { elevation, radius, space, useColors } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Home() {
  const { user } = useAuth();
  const c = useColors();
  const { exam: activeExam } = useActiveExam();

  const myCatsQ = useQuery({ queryKey: ['student-categories'], queryFn: getStudentCategories });
  const myTargetsQ = useQuery({ queryKey: ['student-targets'], queryFn: getStudentTargets });
  const streakQ = useQuery({ queryKey: ['streak'], queryFn: getStreak });
  const alertsQ = useQuery({ queryKey: ['personalized-alerts'], queryFn: getPersonalizedExamAlerts });
  const summaryQ = useQuery({ queryKey: ['learning-summary'], queryFn: () => getLearningSummary() });
  const notifQ = useQuery({ queryKey: ['notifications'], queryFn: getNotifications });

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
  const summary = summaryQ.data;
  const unread = notifQ.data?.unread ?? 0;
  const needsSetup = !myCatsQ.data?.onboardingCompleted || activeCategories.length === 0 || targets.length === 0;
  const mainTarget = activeExam ?? targets[0];
  const firstName = user?.name?.split(' ')[0] || 'Student';

  const shortcuts: { label: string; icon: IconName; color: string; bg: string; to: string }[] = [
    { label: 'Mock Tests', icon: 'document-text', color: c.primary, bg: c.primarySoft, to: '/(tabs)/tests' },
    { label: 'Live Arena', icon: 'radio', color: c.live, bg: c.liveBg, to: '/live-tests' },
    { label: 'Syllabus', icon: 'map', color: c.marked, bg: c.markedBg, to: '/syllabus' },
    { label: 'Daily News', icon: 'newspaper', color: c.success, bg: c.successBg, to: '/current-affairs' },
    { label: 'English Hub', icon: 'language', color: c.info, bg: c.infoBg, to: '/english-hub' },
    { label: 'Mistakes', icon: 'journal', color: c.warning, bg: c.warningBg, to: '/mistakes' },
    { label: 'Leaderboard', icon: 'trophy', color: c.star, bg: c.warningBg, to: '/leaderboard' },
    { label: 'All Exams', icon: 'school', color: c.info, bg: c.infoBg, to: '/exams' },
  ];

  const refreshing = myCatsQ.isRefetching || myTargetsQ.isRefetching || streakQ.isRefetching;
  const onRefresh = () => {
    myCatsQ.refetch();
    myTargetsQ.refetch();
    streakQ.refetch();
    alertsQ.refetch();
    summaryQ.refetch();
    notifQ.refetch();
    recommendedExamsQ.refetch();
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          onPress={() => router.push('/(tabs)/profile')}
          style={[styles.avatar, { backgroundColor: c.primarySoft }]}>
          <Text style={{ color: c.primary, fontWeight: '800', fontSize: 16 }}>
            {firstName.charAt(0).toUpperCase()}
          </Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="small" muted>
            {greeting()}
          </AppText>
          <AppText style={{ fontSize: 20, fontWeight: '800', letterSpacing: -0.3 }} numberOfLines={1}>
            {firstName}
          </AppText>
        </View>
        <Pressable
          onPress={() => router.push('/subscription')}
          accessibilityRole="button"
          accessibilityLabel="Upgrade to Pro"
          style={[styles.proPill, { backgroundColor: c.warningBg }]}>
          <Ionicons name="sparkles" size={13} color={c.warning} />
          <Text style={{ color: c.warningFg, fontWeight: '800', fontSize: 12 }}>PRO</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/notifications')}
          accessibilityRole="button"
          accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          style={[styles.iconBtn, { backgroundColor: c.surface }, elevation(c, 1)]}>
          <Ionicons name="notifications-outline" size={20} color={c.text} />
          {unread > 0 ? <View style={[styles.dot, { backgroundColor: c.danger, borderColor: c.surface }]} /> : null}
        </Pressable>
      </View>

      <View style={{ marginTop: space.md }}>
        <ExamSwitcher />
      </View>

      {/* Hero: goal + streak */}
      <Card tone="hero" style={{ marginTop: space.sm, gap: space.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Pressable style={{ flex: 1 }} onPress={() => router.push('/onboarding')}>
            <Text style={{ color: c.heroMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>
              {mainTarget ? 'YOUR TARGET · WEEK STREAK' : 'GET STARTED'}
            </Text>
            <Text style={{ color: c.heroText, fontSize: 22, fontWeight: '800', marginTop: 4, letterSpacing: -0.4 }} numberOfLines={2}>
              {mainTarget ? mainTarget.name : 'Pick your target exam'}
            </Text>
          </Pressable>
          <ProgressRing
            value={Math.min(streak?.currentStreak ?? 0, 7) / 7}
            size={84}
            stroke={8}
            color={c.heroText}
            track={c.heroSoft}>
            <Text style={{ fontSize: 14 }}>🔥</Text>
            <Text style={{ color: c.heroText, fontWeight: '800', fontSize: 18, marginTop: -2 }}>{streak?.currentStreak ?? 0}</Text>
          </ProgressRing>
        </View>

        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <HeroStat label="Points" value={streak?.totalPoints ?? 0} />
          <HeroStat label="Best streak" value={`${streak?.longestStreak ?? 0}d`} />
          <HeroStat label="Quizzes" value={streak?.totalQuizzesTaken ?? 0} />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(tabs)/tests')}
          style={({ pressed }) => [styles.heroCta, { backgroundColor: c.heroText, opacity: pressed ? 0.9 : 1 }]}>
          <Ionicons name={streak?.dailyGoalCompleted ? 'checkmark-circle' : 'flash'} size={18} color={c.hero} />
          <Text style={{ color: c.hero, fontWeight: '800', fontSize: 15 }}>
            {streak?.dailyGoalCompleted ? "Daily goal done · Practice more" : 'Start today’s practice'}
          </Text>
        </Pressable>
      </Card>

      {needsSetup ? (
        <Card tone="soft" style={{ marginTop: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <AppText style={{ fontWeight: '800' }}>Finish your setup</AppText>
            <AppText variant="small" muted>
              Unlock personalised mocks, syllabus and alerts.
            </AppText>
          </View>
          <View style={{ width: 96 }}>
            <Button title="Setup" onPress={() => router.push('/onboarding')} />
          </View>
        </Card>
      ) : null}

      {/* Today's plan (learning summary) */}
      <SectionHeader title="Today’s plan" />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <PlanTile
          icon="refresh-circle"
          color={c.info}
          bg={c.infoBg}
          value={summary?.revision_due}
          label="Revisions due"
          loading={summaryQ.isLoading}
          onPress={() => router.push('/mistakes')}
        />
        <PlanTile
          icon="alert-circle"
          color={c.warning}
          bg={c.warningBg}
          value={summary?.open_mistakes}
          label="Mistakes to fix"
          loading={summaryQ.isLoading}
          onPress={() => router.push('/mistakes')}
        />
        <PlanTile
          icon="bookmark"
          color={c.marked}
          bg={c.markedBg}
          value={summary?.saved_questions}
          label="Saved Qs"
          loading={summaryQ.isLoading}
          onPress={() => router.push('/mistakes')}
        />
      </View>

      {/* Shortcuts */}
      <SectionHeader title="Explore" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -16 }}
        contentContainerStyle={{ paddingHorizontal: 16, gap: space.sm, paddingVertical: 4 }}>
        {shortcuts.map((s) => (
          <Pressable
            key={s.label}
            accessibilityRole="button"
            accessibilityLabel={s.label}
            onPress={() => router.push(s.to as never)}
            style={({ pressed }) => [
              styles.shortcut,
              { backgroundColor: c.surface, transform: [{ scale: pressed ? 0.96 : 1 }] },
              elevation(c, 1),
            ]}>
            <IconTile icon={s.icon} color={s.color} bg={s.bg} size={42} />
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 12.5, marginTop: 8 }} numberOfLines={1}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Target exams */}
      {targets.length > 0 ? (
        <>
          <SectionHeader title={`Target exams · ${targets.length}/3`} action="Edit" onAction={() => router.push('/onboarding')} />
          <View style={{ gap: space.sm }}>
            {targets.map((t, i) => (
              <Card
                key={t.id}
                onPress={() =>
                  router.push({ pathname: '/exams/[id]', params: { id: t.id, name: t.name, category: t.category } })
                }
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }}>
                <View style={[styles.rank, { backgroundColor: i === 0 ? c.primary : c.primarySoft }]}>
                  <Text style={{ color: i === 0 ? c.primaryText : c.primary, fontWeight: '800' }}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontWeight: '700' }} numberOfLines={1}>
                    {t.name}
                  </AppText>
                  <AppText variant="small" muted>
                    {i === 0 ? 'Main goal' : 'Backup goal'}
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
              </Card>
            ))}
          </View>
        </>
      ) : null}

      {/* Alerts */}
      <SectionHeader title="Exam updates" />
      {alertsQ.isLoading ? (
        <Skeleton height={92} radiusPx={radius.xl} />
      ) : alerts.length === 0 ? (
        <Card style={{ alignItems: 'center', gap: 4 }}>
          <Ionicons name="notifications-off-outline" size={22} color={c.textMuted} />
          <AppText variant="small" muted>
            You’re all caught up — no new exam updates.
          </AppText>
        </Card>
      ) : (
        <View style={{ gap: space.sm }}>
          {alerts.slice(0, 5).map((a) => (
            <Card
              key={a.id}
              onPress={() => router.push({ pathname: '/exams/[id]', params: { id: a.exam_id, name: a.exam_name } })}
              style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Badge label={a.update_type} tone="primary" />
                {a.is_new ? <Badge label="New" tone="success" /> : null}
                <View style={{ flex: 1 }} />
                <AppText variant="small" muted numberOfLines={1} style={{ maxWidth: 140 }}>
                  {a.exam_name}
                </AppText>
              </View>
              <AppText style={{ fontWeight: '700' }} numberOfLines={2}>
                {a.title}
              </AppText>
              {a.exam_date_display || a.total_vacancies || a.application_end ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {a.exam_date_display ? <Meta icon="calendar-outline" text={a.exam_date_display} /> : null}
                  {a.total_vacancies ? <Meta icon="people-outline" text={`${a.total_vacancies} posts`} /> : null}
                  {a.application_end ? <Meta icon="time-outline" text={`Apply by ${a.application_end}`} /> : null}
                </View>
              ) : null}
            </Card>
          ))}
        </View>
      )}

      {/* Discover */}
      {(recommendedExamsQ.data ?? []).length > 0 ? (
        <>
          <SectionHeader title="Discover exams" action="See all" onAction={() => router.push('/exams')} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -16 }}
            contentContainerStyle={{ paddingHorizontal: 16, gap: space.sm, paddingVertical: 4 }}>
            {(recommendedExamsQ.data ?? []).slice(0, 10).map((ex) => (
              <Card
                key={ex.id}
                onPress={() =>
                  router.push({ pathname: '/exams/[id]', params: { id: ex.id, name: ex.name, category: primaryCatId } })
                }
                style={{ width: 150, padding: space.md, gap: 10 }}>
                <IconTile icon="ribbon" color={c.primary} bg={c.primarySoft} size={36} />
                <AppText style={{ fontWeight: '700', fontSize: 13.5 }} numberOfLines={2}>
                  {ex.name}
                </AppText>
              </Card>
            ))}
          </ScrollView>
        </>
      ) : null}
    </Screen>
  );
}

function HeroStat({ label, value }: { label: string; value: string | number }) {
  const c = useColors();
  return (
    <View style={[styles.heroStat, { backgroundColor: c.heroSoft }]}>
      <Text style={{ color: c.heroText, fontWeight: '800', fontSize: 17 }}>{value}</Text>
      <Text style={{ color: c.heroMuted, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

function PlanTile({
  icon,
  color,
  bg,
  value,
  label,
  loading,
  onPress,
}: {
  icon: IconName;
  color: string;
  bg: string;
  value?: number;
  label: string;
  loading?: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Card onPress={onPress} accessibilityLabel={`${label}: ${value ?? 0}`} style={{ flex: 1, padding: space.md, gap: 10 }}>
      <IconTile icon={icon} color={color} bg={bg} size={34} />
      <View>
        {loading ? (
          <Skeleton height={22} width={28} />
        ) : (
          <Text style={{ color: c.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 }}>{value ?? 0}</Text>
        )}
        <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '600' }}>{label}</Text>
      </View>
    </Card>
  );
}

function Meta({ icon, text }: { icon: IconName; text: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name={icon} size={13} color={c.textMuted} />
      <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 10, right: 11, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  proPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: radius.pill,
  },
  streakBubble: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.lg },
  heroStat: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.md },
  heroCta: {
    height: 50,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shortcut: { width: 96, padding: space.md, borderRadius: radius.lg, alignItems: 'flex-start' },
  rank: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
