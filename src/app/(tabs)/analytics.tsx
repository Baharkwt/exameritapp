import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import {
  getExamTopicPerformance,
  getLearningSummary,
  getQuizPerformance,
  getStudyTime,
  getWeeklyProgress,
} from '@/api/analytics';
import { getStudentTargets } from '@/api/student';
import {
  AppText,
  Card,
  ErrorView,
  LoadingView,
  ProgressBar,
  Screen,
  SectionHeader,
  Segmented,
  StatTile,
} from '@/components/ui/kit';
import { ExamSwitcher } from '@/components/ExamSwitcher';
import { useActiveExam } from '@/features/exam/active-exam';
import { space, useColors } from '@/theme';

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

  const targetsQ = useQuery({ queryKey: ['student-targets'], queryFn: getStudentTargets });
  const { examId: activeExamId } = useActiveExam();

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

  const maxStudy = Math.max(1, ...studyEntries.map((e) => Number(e.total_time || 0)));
  const toneFor = (pct: number) => (pct >= 70 ? c.success : pct >= 45 ? c.primary : c.danger);

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <AppText variant="title">Progress</AppText>
      <AppText variant="small" muted style={{ marginBottom: space.md }}>
        Accuracy, weak areas and revision
      </AppText>

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <StatTile label="Quizzes" value={perf.total_quizzes ?? 0} icon="document-text" color={c.primary} bg={c.primarySoft} />
        <StatTile label="Accuracy" value={`${Math.round(Number(perf.avg_accuracy ?? 0))}%`} icon="locate" color={c.success} bg={c.successBg} />
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
        <StatTile label="Best score" value={Math.round(Number(perf.best_score ?? 0))} icon="trophy" color={c.star} bg={c.warningBg} />
        <StatTile label="Avg score" value={Math.round(Number(perf.avg_score ?? 0))} icon="speedometer" color={c.info} bg={c.infoBg} />
      </View>

      <Card
        tone="hero"
        onPress={() => router.push('/mistakes')}
        accessibilityLabel="Open mistake notebook"
        style={{ marginTop: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Ionicons name="journal" size={28} color={c.heroText} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.heroText, fontWeight: '800', fontSize: 16 }}>Mistake notebook</Text>
          <Text style={{ color: c.heroMuted, fontSize: 12.5, fontWeight: '600', marginTop: 2 }}>
            {memory
              ? `${memory.open_mistakes} open · ${memory.revision_due} due for revision`
              : 'Review wrong answers and revision queue'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={c.heroMuted} />
      </Card>

      {targets.length > 0 ? (
        <>
          <SectionHeader title="Topic intelligence" />
          <ExamSwitcher />

          {examTopics.length === 0 ? (
            <Card style={{ alignItems: 'center', gap: 6 }}>
              <Ionicons name="analytics-outline" size={24} color={c.textMuted} />
              <AppText variant="small" muted style={{ textAlign: 'center' }}>
                Attempt mock tests in this exam to unlock topic-by-topic accuracy and speed.
              </AppText>
            </Card>
          ) : (
            <View style={{ gap: space.sm }}>
              {[
                { title: 'Needs focus', list: weakTopics, color: c.danger },
                { title: 'Strong areas', list: strongTopics, color: c.success },
              ]
                .filter((g) => g.list.length > 0)
                .map((g) => (
                  <Card key={g.title} style={{ gap: space.md }}>
                    <Text style={{ color: g.color, fontWeight: '800', fontSize: 14 }}>
                      {g.title} · {g.list.length}
                    </Text>
                    {g.list.slice(0, 5).map((item) => {
                      const pct = Math.round(Number(item.accuracy_pct));
                      return (
                        <View key={item.topic} style={{ gap: 6 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <AppText style={{ fontWeight: '700', flex: 1 }} numberOfLines={1}>
                              {item.topic}
                            </AppText>
                            <Text style={{ color: g.color, fontWeight: '800' }}>{pct}%</Text>
                          </View>
                          <ProgressBar value={pct / 100} color={g.color} />
                          <AppText variant="small" muted>
                            {item.correct}/{item.attempted} correct · avg {Math.round(Number(item.avg_time_sec || 0))}s
                          </AppText>
                        </View>
                      );
                    })}
                  </Card>
                ))}
            </View>
          )}
        </>
      ) : null}

      <SectionHeader title="Subjects" />
      {(perf.subject_accuracy ?? []).length === 0 ? (
        <Card>
          <AppText variant="small" muted>
            No subject data yet. Complete a quiz or mock test to populate this.
          </AppText>
        </Card>
      ) : (
        <Card style={{ gap: space.lg }}>
          {perf.subject_accuracy.map((s) => {
            const pct = Math.max(0, Math.min(100, Math.round(Number(s.accuracy || 0))));
            return (
              <View key={s.subject} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <AppText style={{ fontWeight: '700' }}>{s.subject}</AppText>
                  <Text style={{ color: toneFor(pct), fontWeight: '800' }}>{pct}%</Text>
                </View>
                <ProgressBar value={pct / 100} color={toneFor(pct)} />
              </View>
            );
          })}
        </Card>
      )}

      <SectionHeader title="Study time" />
      <Segmented
        value={period}
        onChange={setPeriod}
        options={[
          { key: 'day', label: 'Day' },
          { key: 'week', label: 'Week' },
          { key: 'month', label: 'Month' },
        ]}
      />
      <Card style={{ marginTop: space.sm }}>
        {studyEntries.length === 0 ? (
          <AppText variant="small" muted>
            No study time logged for this period yet.
          </AppText>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 120, gap: 6 }}>
            {studyEntries.slice(-7).map((e) => {
              const h = Math.max(6, (Number(e.total_time || 0) / maxStudy) * 84);
              return (
                <View key={e.period_date} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: c.textMuted, fontSize: 10, fontWeight: '700' }}>{formatMinutes(e.total_time)}</Text>
                  <View style={{ width: '70%', height: h, borderRadius: 8, backgroundColor: c.primary }} />
                  <Text style={{ color: c.textMuted, fontSize: 10, fontWeight: '600' }}>
                    {new Date(e.period_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </Card>

      {weeks.length > 0 ? (
        <>
          <SectionHeader title="Weekly consistency" />
          <Card style={{ gap: space.md }}>
            {weeks.slice(-6).map((w) => (
              <View key={w.week_start} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <AppText style={{ fontWeight: '700' }}>
                    Week of {new Date(w.week_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </AppText>
                  <Text style={{ color: c.primary, fontWeight: '800' }}>Avg {Math.round(Number(w.avg_score || 0))}</Text>
                </View>
                <ProgressBar value={w.active_days / 7} />
                <AppText variant="small" muted>
                  {w.active_days}/7 active days · {w.quizzes_taken} quizzes
                </AppText>
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
