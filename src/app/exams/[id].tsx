import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import {
  getExams,
  getExamPublishedTests,
  getExamStages,
  getExamTestTabs,
  PublishedTest,
} from '@/api/catalog';
import { toApiError } from '@/api/client';
import { getExamProgress, ExamTestProgress } from '@/api/dashboard';
import { addStudentTarget, getStudentCategories, getStudentTargets, removeStudentTarget } from '@/api/student';
import {
  AppText,
  Badge,
  Card,
  Chip,
  EmptyView,
  ErrorBanner,
  ErrorView,
  LoadingView,
  ProgressBar,
  Screen,
  ScreenHeader,
  SectionHeader,
} from '@/components/ui/kit';
import { space, useColors } from '@/theme';

export default function ExamDetailScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const { id: examId, name: paramName, category: paramCategory } = useLocalSearchParams<{
    id: string;
    name?: string;
    category?: string;
  }>();

  const stagesQ = useQuery({
    queryKey: ['exam-stages', examId],
    queryFn: () => getExamStages(examId),
    enabled: !!examId,
  });
  const testsQ = useQuery({
    queryKey: ['exam-published-tests', examId],
    queryFn: () => getExamPublishedTests(examId),
    enabled: !!examId,
  });
  const tabsQ = useQuery({
    queryKey: ['exam-test-tabs', examId],
    queryFn: () => getExamTestTabs(examId),
    enabled: !!examId,
  });
  const progressQ = useQuery({
    queryKey: ['exam-progress', examId],
    queryFn: () => getExamProgress(examId),
    enabled: !!examId,
  });
  const targetsQ = useQuery({ queryKey: ['student-targets'], queryFn: getStudentTargets });
  const myCatsQ = useQuery({ queryKey: ['student-categories'], queryFn: getStudentCategories });
  const allExamsQ = useQuery({
    queryKey: ['exams', 'all'],
    queryFn: () => getExams(),
    enabled: !paramName,
  });

  const [selectedTabId, setSelectedTabId] = useState<number | 'all'>('all');
  const [error, setError] = useState<string | null>(null);
  const [targetBusy, setTargetBusy] = useState(false);

  const examName = useMemo(() => {
    if (paramName) return paramName;
    const match = allExamsQ.data?.find((e) => e.id === examId);
    return match?.name ?? examId;
  }, [paramName, allExamsQ.data, examId]);

  const isTarget = useMemo(
    () => (targetsQ.data ?? []).some((t) => t.id === examId),
    [targetsQ.data, examId],
  );

  const progressByTestId = useMemo(() => {
    const map = new Map<string, ExamTestProgress>();
    for (const row of progressQ.data ?? []) {
      map.set(row.test_id, row);
    }
    return map;
  }, [progressQ.data]);

  const filteredTests = useMemo(() => {
    const all = testsQ.data ?? [];
    if (selectedTabId === 'all') return all;
    return all.filter((t) => t.tab_id === selectedTabId);
  }, [testsQ.data, selectedTabId]);

  async function handleToggleTarget() {
    if (!examId) return;
    setTargetBusy(true);
    setError(null);
    try {
      if (isTarget) {
        await removeStudentTarget(examId);
      } else {
        const catId = paramCategory || myCatsQ.data?.categories[0]?.categoryId || 'banking';
        await addStudentTarget({ examId, categoryId: catId });
      }
      await qc.invalidateQueries({ queryKey: ['student-targets'] });
    } catch (e) {
      setError(toApiError(e).message);
    } finally {
      setTargetBusy(false);
    }
  }

  if (stagesQ.isLoading || testsQ.isLoading) return <LoadingView />;
  if (testsQ.isError) return <ErrorView message={testsQ.error.message} onRetry={() => testsQ.refetch()} />;

  const stages = stagesQ.data ?? [];
  const tabs = tabsQ.data ?? [];
  const totalTests = testsQ.data?.length ?? 0;
  const completedCount = (testsQ.data ?? []).filter((t) => progressByTestId.get(t.id)?.completed).length;

  return (
    <Screen>
      <ScreenHeader
        title={examName}
        subtitle={`${completedCount}/${totalTests} tests completed`}
        right={
          <Chip
            label={isTarget ? 'Target' : 'Add target'}
            icon={isTarget ? 'star' : 'star-outline'}
            selected={isTarget}
            onPress={() => {
              if (!targetBusy) handleToggleTarget();
            }}
          />
        }
      />
      {totalTests > 0 ? (
        <View style={{ marginBottom: space.lg }}>
          <ProgressBar value={completedCount / totalTests} height={10} />
        </View>
      ) : null}

      {error ? <ErrorBanner message={error} /> : null}

      {/* Exam Stages & Dates */}
      {stages.length > 0 ? (
        <View style={{ marginBottom: space.lg }}>
          <SectionHeader title="Exam stages & pattern" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 4 }}>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {stages.map((st) => (
                <Card key={st.id} style={{ minWidth: 200, gap: 2, padding: space.md }}>
                  <AppText style={{ fontWeight: '700' }}>{st.name}</AppText>
                  <AppText variant="small" muted>
                    {st.total_marks ? `${st.total_marks} Marks` : 'Marks TBD'} ·{' '}
                    {st.duration_minutes ? `${st.duration_minutes} mins` : 'Duration TBD'}
                  </AppText>
                  {st.negative_marking ? (
                    <AppText variant="small" muted>
                      Negative: {st.negative_marking}
                    </AppText>
                  ) : null}
                  {st.exam_date ? (
                    <AppText variant="small" style={{ color: c.primary, marginTop: 4, fontWeight: '600' }}>
                      Exam Date: {st.exam_date}
                    </AppText>
                  ) : null}
                </Card>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}

      {tabs.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 6 }}>
          <Chip label={`All · ${totalTests}`} selected={selectedTabId === 'all'} onPress={() => setSelectedTabId('all')} />
          {tabs.map((tab) => (
            <Chip key={tab.id} label={tab.name} selected={selectedTabId === tab.id} onPress={() => setSelectedTabId(tab.id)} />
          ))}
        </ScrollView>
      ) : null}

      {/* Published Tests List */}
      <SectionHeader title={`Mock & practice tests · ${filteredTests.length}`} />

      {filteredTests.length === 0 ? (
        <EmptyView title="No published tests yet" message="Check back soon for new mock papers." />
      ) : (
        <View style={{ gap: space.sm }}>
          {filteredTests.map((t: PublishedTest) => {
            const prog = progressByTestId.get(t.id);
            return (
              <Card
                key={t.id}
                onPress={() => router.push({ pathname: '/tests/[id]', params: { id: t.id } })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
                    <AppText style={{ fontWeight: '600' }}>{t.name}</AppText>
                    <Badge label={t.access_tier === 'free' ? 'Free' : 'Pro'} tone={t.access_tier === 'free' ? 'success' : 'warning'} />
                  </View>

                  <AppText variant="small" muted>
                    {[
                      t.stage_name,
                      t.format_label,
                      `${t.question_count} Qs`,
                      `${t.duration_minutes} mins`,
                      `${t.max_score} marks`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </AppText>

                  {prog?.completed ? (
                    <AppText variant="small" style={{ color: c.success, fontWeight: '600' }}>
                      ✓ Score: {prog.latest_score ?? 0}/{prog.max_score ?? t.max_score} ({prog.attempt_count}{' '}
                      {prog.attempt_count === 1 ? 'attempt' : 'attempts'})
                    </AppText>
                  ) : prog?.in_progress ? (
                    <AppText variant="small" style={{ color: c.primary, fontWeight: '600' }}>
                      ● Attempt in progress
                    </AppText>
                  ) : null}
                </View>

                <Text style={{ color: c.primary, fontWeight: '800', fontSize: 13 }}>
                  {prog?.in_progress ? 'Resume' : prog?.completed ? 'Retake' : 'Start'}
                </Text>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
