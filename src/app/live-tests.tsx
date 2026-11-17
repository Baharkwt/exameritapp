import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { getExamPublishedTests, PublishedTest } from '@/api/catalog';
import { toApiError } from '@/api/client';
import {
  getLiveTestRegistrations,
  LiveTestRegistration,
  upsertLiveTestRegistration,
} from '@/api/live';
import { getStudentCategories, getStudentTargets } from '@/api/student';
import { getFreeQuizzes } from '@/api/tests';
import { AppText, Button, EmptyView, ErrorBanner, LoadingView, Screen } from '@/components/ui/kit';
import { radius, space, useColors } from '@/theme';

export default function LiveTestsScreen() {
  const c = useColors();
  const qc = useQueryClient();

  const myTargetsQ = useQuery({ queryKey: ['student-targets'], queryFn: getStudentTargets });
  const myCatsQ = useQuery({ queryKey: ['student-categories'], queryFn: getStudentCategories });

  // Poll registrations every 20 seconds so live status stays fresh without sockets
  const regsQ = useQuery({
    queryKey: ['live-test-registrations'],
    queryFn: getLiveTestRegistrations,
    refetchInterval: 20_000,
  });

  const primaryExamId = myTargetsQ.data?.[0]?.id ?? '';
  const primaryCatId = myCatsQ.data?.categories[0]?.categoryId ?? 'banking';

  const examTestsQ = useQuery({
    queryKey: ['exam-published-tests', primaryExamId],
    queryFn: () => getExamPublishedTests(primaryExamId),
    enabled: !!primaryExamId,
    refetchInterval: 30_000,
  });

  const catLiveQuizzesQ = useQuery({
    queryKey: ['free-quizzes', primaryCatId, 'live'],
    queryFn: () => getFreeQuizzes({ category: primaryCatId, format: 'live', page: 1, pageSize: 30 }),
    enabled: !!primaryCatId,
    refetchInterval: 30_000,
  });

  const [tab, setTab] = useState<'upcoming' | 'registered' | 'completed'>('upcoming');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const regMap = useMemo(() => {
    const map = new Map<string, LiveTestRegistration>();
    for (const r of regsQ.data ?? []) {
      map.set(r.test_id, r);
    }
    return map;
  }, [regsQ.data]);

  const liveTests = useMemo(() => {
    const fromExam: PublishedTest[] = (examTestsQ.data ?? []).filter(
      (t) => t.format_key === 'live' || t.name.toLowerCase().includes('live'),
    );
    const seen = new Set(fromExam.map((t) => t.id));
    const fromQuizzes: PublishedTest[] = (catLiveQuizzesQ.data?.quizzes ?? [])
      .filter((q) => !seen.has(q.id))
      .map((q) => ({
        id: q.id,
        name: q.title,
        access_tier: 'free',
        difficulty: q.difficulty,
        duration_minutes: q.durationMin,
        exam_stage_id: null,
        stage_name: q.subjectLabel,
        stage_order: null,
        test_format_id: null,
        format_key: 'live',
        format_label: q.formatLabel ?? 'Live Test',
        format_sort_order: null,
        question_count: q.questions,
        section_count: 1,
        max_score: q.marks,
        tab_id: null,
        subtab_id: null,
        subtab_subject_id: null,
      }));
    return [...fromExam, ...fromQuizzes];
  }, [examTestsQ.data, catLiveQuizzesQ.data]);

  async function handleRegister(testId: string) {
    setBusyId(testId);
    setError(null);
    try {
      await upsertLiveTestRegistration(testId, { status: 'registered' });
      await qc.invalidateQueries({ queryKey: ['live-test-registrations'] });
    } catch (e) {
      setError(toApiError(e).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleEnterLiveTest(testId: string) {
    setBusyId(testId);
    setError(null);
    try {
      const existing = regMap.get(testId);
      if (!existing) {
        await upsertLiveTestRegistration(testId, { status: 'registered' });
        await qc.invalidateQueries({ queryKey: ['live-test-registrations'] });
      }
      router.push({ pathname: '/tests/[id]', params: { id: testId } });
    } catch (e) {
      setError(toApiError(e).message);
    } finally {
      setBusyId(null);
    }
  }

  if (regsQ.isLoading || myTargetsQ.isLoading) return <LoadingView />;

  const registrations = regsQ.data ?? [];
  const registeredList = registrations.filter((r) => r.status !== 'completed');
  const completedList = registrations.filter((r) => r.status === 'completed');

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/tests'))} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="title" style={{ fontSize: 22 }}>
            Live Tests Arena
          </AppText>
          <AppText variant="small" muted>
            All-India live mock tests & real-time rankings
          </AppText>
        </View>
        <Pressable
          onPress={() => router.push('/leaderboard')}
          style={[styles.rankBtn, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Ionicons name="trophy-outline" size={16} color={c.primary} />
          <AppText variant="small" style={{ color: c.primary, fontWeight: '700' }}>
            Ranks
          </AppText>
        </Pressable>
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      {/* Tabs */}
      <View style={[styles.segmented, { backgroundColor: c.surface, borderColor: c.border }]}>
        {(
          [
            { key: 'upcoming', label: `Live & Upcoming (${liveTests.length})` },
            { key: 'registered', label: `Registered (${registeredList.length})` },
            { key: 'completed', label: `Completed (${completedList.length})` },
          ] as const
        ).map((item) => (
          <Pressable
            key={item.key}
            onPress={() => setTab(item.key)}
            style={[styles.segmentBtn, tab === item.key ? { backgroundColor: c.primary } : null]}>
            <AppText
              variant="small"
              style={{
                color: tab === item.key ? c.primaryText : c.text,
                fontWeight: '700',
                fontSize: 12,
              }}>
              {item.label}
            </AppText>
          </Pressable>
        ))}
      </View>

      {tab === 'upcoming' ? (
        liveTests.length === 0 ? (
          <EmptyView
            title="No Live Tests Scheduled Right Now"
            message="When an All-India Live Test is published for your target exam or category, it will appear here automatically."
          />
        ) : (
          <View style={{ gap: space.sm, marginTop: space.md }}>
            {liveTests.map((t) => {
              const reg = regMap.get(t.id);
              return (
                <View
                  key={t.id}
                  style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={[styles.liveTag, { backgroundColor: c.liveBg }]}>
                      <View style={[styles.liveDot, { backgroundColor: c.live }]} />
                      <AppText variant="small" style={{ color: c.danger, fontWeight: '700', fontSize: 11 }}>
                        LIVE TEST
                      </AppText>
                    </View>
                    {reg ? (
                      <AppText variant="small" style={{ color: c.success, fontWeight: '700' }}>
                        ✓ {reg.status.toUpperCase()}
                      </AppText>
                    ) : null}
                  </View>

                  <AppText style={{ fontWeight: '700', fontSize: 16, marginTop: 4 }}>{t.name}</AppText>
                  <AppText variant="small" muted>
                    {[
                      t.stage_name,
                      `${t.question_count} Qs`,
                      `${t.duration_minutes} mins`,
                      `${t.max_score} marks`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </AppText>

                  <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
                    {!reg ? (
                      <Button
                        title="Register Free"
                        variant="outline"
                        loading={busyId === t.id}
                        onPress={() => handleRegister(t.id)}
                      />
                    ) : null}
                    <Button
                      title={reg?.status === 'completed' ? 'View Attempt' : 'Enter Test Room'}
                      loading={busyId === t.id}
                      onPress={() => handleEnterLiveTest(t.id)}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )
      ) : tab === 'registered' ? (
        registeredList.length === 0 ? (
          <EmptyView
            title="No Active Registrations"
            message="Register for an upcoming live test to track it here."
          />
        ) : (
          <View style={{ gap: space.sm, marginTop: space.md }}>
            {registeredList.map((reg) => {
              const matched = liveTests.find((t) => t.id === reg.test_id);
              return (
                <View
                  key={reg.test_id}
                  style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
                  <AppText style={{ fontWeight: '700' }}>
                    {matched?.name ?? `Live Test (${reg.test_id})`}
                  </AppText>
                  <AppText variant="small" muted>
                    Registered on {new Date(reg.registered_at).toLocaleDateString()} · Status:{' '}
                    {reg.status}
                  </AppText>
                  <View style={{ marginTop: space.sm }}>
                    <Button
                      title="Open Test Room"
                      onPress={() =>
                        router.push({ pathname: '/tests/[id]', params: { id: reg.test_id } })
                      }
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )
      ) : completedList.length === 0 ? (
        <EmptyView
          title="No Completed Live Tests Yet"
          message="Your finished live test scores and rankings will appear here."
        />
      ) : (
        <View style={{ gap: space.sm, marginTop: space.md }}>
          {completedList.map((reg) => {
            const matched = liveTests.find((t) => t.id === reg.test_id);
            return (
              <View
                key={reg.test_id}
                style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
                <AppText style={{ fontWeight: '700' }}>
                  {matched?.name ?? `Live Test (${reg.test_id})`}
                </AppText>
                <AppText variant="small" style={{ color: c.success, fontWeight: '600' }}>
                  Score: {reg.score ?? 'Pending release'}
                </AppText>
                <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
                  <Button
                    title="View Result"
                    variant="outline"
                    onPress={() =>
                      router.push({ pathname: '/tests/[id]', params: { id: reg.test_id } })
                    }
                  />
                  <Button
                    title="Leaderboard"
                    onPress={() =>
                      router.push({ pathname: '/leaderboard', params: { quizId: reg.test_id } })
                    }
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Info Note on Live Classes */}
      <ScrollView horizontal={false} style={{ marginTop: space.xl }}>
        <View style={[styles.infoBanner, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Ionicons name="information-circle-outline" size={20} color={c.primary} />
          <View style={{ flex: 1 }}>
            <AppText variant="small" style={{ fontWeight: '700' }}>
              Real-Time Server Synchronization
            </AppText>
            <AppText variant="small" muted>
              Live test windows are enforced by the server (`starts_at` and `result_release_at`). Status updates automatically every 20 seconds.
            </AppText>
          </View>
        </View>
      </ScrollView>
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
  rankBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
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
  card: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 4,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});

