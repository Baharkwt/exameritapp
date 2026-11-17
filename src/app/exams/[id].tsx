import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

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
import { AppText, Button, EmptyView, ErrorBanner, ErrorView, LoadingView, Screen } from '@/components/ui/kit';
import { radius, space, useColors } from '@/theme';

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
      {/* Top Bar */}
      <View style={styles.headerRow}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="title" style={{ fontSize: 22 }}>
            {examName}
          </AppText>
          <AppText variant="small" muted>
            {completedCount}/{totalTests} tests completed
          </AppText>
        </View>
        <Button
          title={isTarget ? '★ Target' : '+ Target'}
          variant={isTarget ? 'primary' : 'outline'}
          loading={targetBusy}
          onPress={handleToggleTarget}
        />
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      {/* Exam Stages & Dates */}
      {stages.length > 0 ? (
        <View style={{ marginBottom: space.lg }}>
          <AppText variant="heading" style={{ marginBottom: space.sm }}>
            Exam Stages & Pattern
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {stages.map((st) => (
                <View
                  key={st.id}
                  style={[styles.stageCard, { backgroundColor: c.surface, borderColor: c.border }]}>
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
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}

      {/* Custom Test Tabs Filter (if configured by admin) */}
      {tabs.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.md }}>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Pressable
              onPress={() => setSelectedTabId('all')}
              style={[
                styles.tabChip,
                {
                  backgroundColor: selectedTabId === 'all' ? c.primary : c.surface,
                  borderColor: selectedTabId === 'all' ? c.primary : c.border,
                },
              ]}>
              <AppText
                variant="small"
                style={{ color: selectedTabId === 'all' ? c.primaryText : c.text, fontWeight: '600' }}>
                All ({totalTests})
              </AppText>
            </Pressable>
            {tabs.map((tab) => {
              const active = selectedTabId === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setSelectedTabId(tab.id)}
                  style={[
                    styles.tabChip,
                    {
                      backgroundColor: active ? c.primary : c.surface,
                      borderColor: active ? c.primary : c.border,
                    },
                  ]}>
                  <AppText
                    variant="small"
                    style={{ color: active ? c.primaryText : c.text, fontWeight: '600' }}>
                    {tab.name}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      ) : null}

      {/* Published Tests List */}
      <AppText variant="heading" style={{ marginBottom: space.sm }}>
        Mock & Practice Tests ({filteredTests.length})
      </AppText>

      {filteredTests.length === 0 ? (
        <EmptyView title="No published tests yet" message="Check back soon for new mock papers." />
      ) : (
        <View style={{ gap: space.sm }}>
          {filteredTests.map((t: PublishedTest) => {
            const prog = progressByTestId.get(t.id);
            return (
              <View
                key={t.id}
                style={[styles.testCard, { backgroundColor: c.surface, borderColor: c.border }]}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
                    <AppText style={{ fontWeight: '600' }}>{t.name}</AppText>
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor: t.access_tier === 'free' ? c.successBg : c.warningBg,
                        },
                      ]}>
                      <AppText
                        variant="small"
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color: t.access_tier === 'free' ? c.successFg : c.warningFg,
                        }}>
                        {t.access_tier === 'free' ? 'FREE' : 'PRO'}
                      </AppText>
                    </View>
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

                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/tests/[id]',
                      params: { id: t.id },
                    })
                  }
                  style={[styles.startBtn, { backgroundColor: c.primary }]}>
                  <AppText variant="small" style={{ color: c.primaryText, fontWeight: '700' }}>
                    {prog?.in_progress ? 'Resume' : prog?.completed ? 'Retake' : 'Start'}
                  </AppText>
                </Pressable>
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
    marginBottom: space.lg,
  },
  stageCard: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    minWidth: 190,
    gap: 2,
  },
  tabChip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  testCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: space.md,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  startBtn: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
  },
});
