import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  getExamTopicPerformance,
  getLearningSummary,
  getQuizPerformance,
  getStudyTime,
  getWeeklyProgress,
} from '@/api/analytics';
import { getStudentTargets } from '@/api/student';
import { AppText, ErrorView, LoadingView, Screen } from '@/components/ui/kit';
import { radius, space, useColors } from '@/theme';

function formatMinutes(secondsOrMinutes: number): string {
  const num = Number(secondsOrMinutes || 0);
  if (num <= 0) return '0m';
  // Backend stores quiz time_taken in seconds
  const mins = num > 300 ? Math.round(num / 60) : Math.round(num);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function AnalyticsScreen() {
  const c = useColors();
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);

  const targetsQ = useQuery({ queryKey: ['student-targets'], queryFn: getStudentTargets });
  const activeExamId = useMemo(
    () => selectedExamId ?? targetsQ.data?.[0]?.id ?? null,
    [selectedExamId, targetsQ.data],
  );

  const perfQ = useQuery({ queryKey: ['quiz-performance'], queryFn: getQuizPerformance });
  const studyQ = useQuery({
    queryKey: ['study-time', period],
    queryFn: () => getStudyTime(period),
  });
  const weeklyQ = useQuery({ queryKey: ['weekly-progress'], queryFn: getWeeklyProgress });
  const memoryQ = useQuery({
    queryKey: ['learning-summary', activeExamId ?? 'all'],
    queryFn: () => getLearningSummary(activeExamId ?? undefined),
  });
  const examTopicsQ = useQuery({
    queryKey: ['exam-topic-performance', activeExamId],
    queryFn: () => getExamTopicPerformance(activeExamId!),
    enabled: !!activeExamId,
  });

  if (perfQ.isLoading) return <LoadingView />;
  if (perfQ.isError) {
    return <ErrorView message={perfQ.error.message} onRetry={() => perfQ.refetch()} />;
  }

  const perf = perfQ.data!;
  const targets = targetsQ.data ?? [];
  const memory = memoryQ.data;
  const examTopics = examTopicsQ.data ?? [];
  const weakTopics = examTopics.filter((t) => Number(t.accuracy_pct) < 55);
  const strongTopics = examTopics.filter((t) => Number(t.accuracy_pct) >= 70);
  const studyEntries = studyQ.data?.data ?? [];
  const weeks = weeklyQ.data?.weeks ?? [];

  const refreshing = perfQ.isRefetching || studyQ.isRefetching || weeklyQ.isRefetching;
  const onRefresh = () => {
    perfQ.refetch();
    studyQ.refetch();
    weeklyQ.refetch();
    memoryQ.refetch();
    examTopicsQ.refetch();
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <AppText variant="title">Analytics</AppText>
          <AppText variant="small" muted>
            Measured accuracy, weak areas & revision memory
          </AppText>
        </View>
        <Pressable
          onPress={() => router.push('/mistakes')}
          style={[styles.notebookBtn, { backgroundColor: c.primary }]}>
          <Ionicons name="journal-outline" size={16} color={c.primaryText} />
          <AppText variant="small" style={{ color: c.primaryText, fontWeight: '700' }}>
            Mistakes
          </AppText>
        </Pressable>
      </View>

      {/* Learning Memory / Mistake Notebook Banner */}
      <Pressable
        onPress={() => router.push('/mistakes')}
        style={[styles.memoryCard, { backgroundColor: c.surface, borderColor: c.primary }]}>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText style={{ fontWeight: '700' }}>Mistake Notebook & Revision Queue</AppText>
          <AppText variant="small" muted>
            {memory
              ? `${memory.open_mistakes} open mistakes · ${memory.revision_due} due for spaced revision`
              : 'Review wrong answers & spaced-repetition queue'}
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={20} color={c.primary} />
      </Pressable>

      {/* Overall KPI Row (4 compact columns) */}
      <View style={styles.kpiGrid}>
        <View style={[styles.kpiBox, { backgroundColor: c.surface, borderColor: c.border }]}>
          <AppText variant="small" muted>
            Quizzes
          </AppText>
          <AppText variant="heading">{perf.total_quizzes ?? 0}</AppText>
        </View>
        <View style={[styles.kpiBox, { backgroundColor: c.surface, borderColor: c.border }]}>
          <AppText variant="small" muted>
            Accuracy
          </AppText>
          <AppText variant="heading" style={{ color: c.primary }}>
            {Math.round(Number(perf.avg_accuracy ?? 0))}%
          </AppText>
        </View>
        <View style={[styles.kpiBox, { backgroundColor: c.surface, borderColor: c.border }]}>
          <AppText variant="small" muted>
            Best
          </AppText>
          <AppText variant="heading" style={{ color: c.success }}>
            {Math.round(Number(perf.best_score ?? 0))}
          </AppText>
        </View>
        <View style={[styles.kpiBox, { backgroundColor: c.surface, borderColor: c.border }]}>
          <AppText variant="small" muted>
            Avg
          </AppText>
          <AppText variant="heading">{Math.round(Number(perf.avg_score ?? 0))}</AppText>
        </View>
      </View>

      {/* Target Exam Topic Performance */}
      {targets.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="heading" style={{ marginBottom: space.xs }}>
            Exam Topic Intelligence
          </AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: space.sm }}>
            <View style={{ flexDirection: 'row', gap: space.xs }}>
              {targets.map((t) => {
                const active = t.id === activeExamId;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => setSelectedExamId(t.id)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? c.primary : c.surface,
                        borderColor: active ? c.primary : c.border,
                      },
                    ]}>
                    <AppText
                      variant="small"
                      style={{
                        color: active ? c.primaryText : c.text,
                        fontWeight: '600',
                      }}>
                      {t.name}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {examTopics.length === 0 ? (
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              <AppText variant="small" muted>
                Attempt mock tests in this exam to unlock topic-by-topic accuracy and speed metrics.
              </AppText>
            </View>
          ) : (
            <View style={{ gap: space.sm }}>
              {weakTopics.length > 0 ? (
                <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
                  <AppText style={{ fontWeight: '700', color: c.danger, marginBottom: space.xs }}>
                    Needs Focus ({weakTopics.length})
                  </AppText>
                  {weakTopics.slice(0, 5).map((item) => (
                    <View key={item.topic} style={styles.topicRow}>
                      <View style={{ flex: 1 }}>
                        <AppText style={{ fontWeight: '600' }}>{item.topic}</AppText>
                        <AppText variant="small" muted>
                          {item.correct}/{item.attempted} correct · avg {Math.round(Number(item.avg_time_sec || 0))}s
                        </AppText>
                      </View>
                      <AppText style={{ fontWeight: '700', color: c.danger }}>
                        {Math.round(Number(item.accuracy_pct))}%
                      </AppText>
                    </View>
                  ))}
                </View>
              ) : null}

              {strongTopics.length > 0 ? (
                <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
                  <AppText style={{ fontWeight: '700', color: c.success, marginBottom: space.xs }}>
                    Strong Areas ({strongTopics.length})
                  </AppText>
                  {strongTopics.slice(0, 5).map((item) => (
                    <View key={item.topic} style={styles.topicRow}>
                      <View style={{ flex: 1 }}>
                        <AppText style={{ fontWeight: '600' }}>{item.topic}</AppText>
                        <AppText variant="small" muted>
                          {item.correct}/{item.attempted} correct · avg {Math.round(Number(item.avg_time_sec || 0))}s
                        </AppText>
                      </View>
                      <AppText style={{ fontWeight: '700', color: c.success }}>
                        {Math.round(Number(item.accuracy_pct))}%
                      </AppText>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          )}
        </View>
      ) : null}

      {/* Subject Accuracy Breakdown */}
      <View style={styles.section}>
        <AppText variant="heading" style={{ marginBottom: space.sm }}>
          Subject-wise Accuracy
        </AppText>
        {(perf.subject_accuracy ?? []).length === 0 ? (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <AppText variant="small" muted>
              No subject accuracy data recorded yet. Complete a daily quiz or mock test to populate.
            </AppText>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, gap: space.sm }]}>
            {perf.subject_accuracy.map((s) => {
              const pct = Math.max(0, Math.min(100, Math.round(Number(s.accuracy || 0))));
              return (
                <View key={s.subject} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <AppText style={{ fontWeight: '600' }}>{s.subject}</AppText>
                    <AppText variant="small" style={{ fontWeight: '700', color: c.primary }}>
                      {pct}%
                    </AppText>
                  </View>
                  <View style={[styles.barTrack, { backgroundColor: c.border }]}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${pct}%`,
                          backgroundColor: pct >= 70 ? c.success : pct >= 45 ? c.primary : c.danger,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Study Time */}
      <View style={styles.section}>
        <View style={styles.rowBetween}>
          <AppText variant="heading">Study Time</AppText>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {(['day', 'week', 'month'] as const).map((p) => {
              const active = period === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => setPeriod(p)}
                  style={[
                    styles.smallTab,
                    {
                      backgroundColor: active ? c.primary : c.surface,
                      borderColor: active ? c.primary : c.border,
                    },
                  ]}>
                  <AppText
                    variant="small"
                    style={{
                      color: active ? c.primaryText : c.text,
                      fontWeight: '600',
                      textTransform: 'capitalize',
                    }}>
                    {p}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          {studyEntries.length === 0 ? (
            <AppText variant="small" muted>
              No study time logged for this period yet.
            </AppText>
          ) : (
            studyEntries.slice(-7).map((entry) => (
              <View key={entry.period_date} style={styles.topicRow}>
                <AppText variant="small">
                  {new Date(entry.period_date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </AppText>
                <AppText style={{ fontWeight: '700' }}>{formatMinutes(entry.total_time)}</AppText>
              </View>
            ))
          )}
        </View>
      </View>

      {/* Weekly Consistency */}
      {weeks.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="heading" style={{ marginBottom: space.sm }}>
            Weekly Consistency
          </AppText>
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            {weeks.slice(-6).map((w) => (
              <View key={w.week_start} style={styles.topicRow}>
                <View>
                  <AppText style={{ fontWeight: '600' }}>
                    Week of{' '}
                    {new Date(w.week_start).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </AppText>
                  <AppText variant="small" muted>
                    {w.active_days} active days · {w.quizzes_taken} quizzes
                  </AppText>
                </View>
                <AppText style={{ fontWeight: '700', color: c.primary }}>
                  Avg {Math.round(Number(w.avg_score || 0))}
                </AppText>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
    gap: space.sm,
  },
  notebookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
  },
  memoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    marginBottom: space.lg,
    gap: space.sm,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: space.md,
  },
  kpiBox: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  section: {
    marginBottom: space.lg,
  },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  card: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    gap: space.sm,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  smallTab: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
});
