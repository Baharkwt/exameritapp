import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AttemptResultAnswer, getAttemptResult, getTestMetadata } from '@/api/tests';
import { AppText, Button, EmptyView, ErrorView, LoadingView, Screen } from '@/components/ui/kit';
import { radius, space, useColors } from '@/theme';

export default function TestResultAndSolutionsScreen() {
  const c = useColors();
  const { id: testId, attemptId } = useLocalSearchParams<{
    id: string;
    attemptId: string;
  }>();

  const numericAttemptId = Number(attemptId);

  const metaQ = useQuery({
    queryKey: ['test-meta', testId],
    queryFn: () => getTestMetadata(testId),
    enabled: !!testId,
  });

  const resultQ = useQuery({
    queryKey: ['attempt-result', testId, numericAttemptId],
    queryFn: () => getAttemptResult(testId, numericAttemptId),
    enabled: !!testId && Number.isFinite(numericAttemptId),
  });

  const [tab, setTab] = useState<'summary' | 'solutions'>('summary');
  const [filter, setFilter] = useState<'all' | 'wrong' | 'correct' | 'unattempted'>('all');

  const answers = useMemo(() => resultQ.data?.answers ?? [], [resultQ.data]);

  const stats = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    const byTopic = new Map<string, { correct: number; total: number }>();

    for (const a of answers) {
      const attempted =
        a.selectedAnswer !== null &&
        a.selectedAnswer !== undefined &&
        (!Array.isArray(a.selectedAnswer) || a.selectedAnswer.length > 0);
      if (!attempted) {
        skipped += 1;
      } else if (a.isCorrect) {
        correct += 1;
      } else {
        wrong += 1;
      }

      const topicKey = a.topic || a.sectionKey || 'General';
      const entry = byTopic.get(topicKey) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (a.isCorrect) entry.correct += 1;
      byTopic.set(topicKey, entry);
    }

    const attemptedTotal = correct + wrong;
    const accuracy = attemptedTotal > 0 ? Math.round((correct / attemptedTotal) * 100) : 0;

    return {
      correct,
      wrong,
      skipped,
      accuracy,
      topics: Array.from(byTopic.entries()).map(([name, v]) => ({
        name,
        correct: v.correct,
        total: v.total,
        pct: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
      })),
    };
  }, [answers]);

  const filteredSolutions = useMemo(() => {
    return answers.filter((a) => {
      const attempted =
        a.selectedAnswer !== null &&
        a.selectedAnswer !== undefined &&
        (!Array.isArray(a.selectedAnswer) || a.selectedAnswer.length > 0);
      if (filter === 'correct') return attempted && a.isCorrect === true;
      if (filter === 'wrong') return attempted && !a.isCorrect;
      if (filter === 'unattempted') return !attempted;
      return true;
    });
  }, [answers, filter]);

  if (resultQ.isLoading || metaQ.isLoading) return <LoadingView />;
  if (resultQ.isError) {
    return <ErrorView message={resultQ.error.message} onRetry={() => resultQ.refetch()} />;
  }

  const res = resultQ.data!;

  // Live session lock check
  if (res.resultLocked) {
    return (
      <Screen>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.replace('/(tabs)/tests')} hitSlop={10}>
            <Ionicons name="arrow-back" size={24} color={c.text} />
          </Pressable>
          <AppText variant="title" style={{ fontSize: 21 }}>
            Test Submitted
          </AppText>
        </View>
        <EmptyView
          title="Results Locked Until Live Window Ends"
          message={
            res.resultReleaseAt
              ? `Your attempt has been recorded. Detailed solutions and rankings will unlock at ${new Date(res.resultReleaseAt).toLocaleString()}.`
              : 'Your live test attempt is recorded. Results will be released once the live session concludes.'
          }
        />
        <Button title="Back to Tests" onPress={() => router.replace('/(tabs)/tests')} />
      </Screen>
    );
  }

  return (
    <Screen>
      {/* Header */}
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.replace('/(tabs)/tests')} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="title" style={{ fontSize: 20 }}>
            {metaQ.data?.name ?? 'Test Analysis'}
          </AppText>
          <AppText variant="small" muted>
            Attempt #{res.attemptId} · Official Server Scorecard
          </AppText>
        </View>
      </View>

      {/* Segmented Switcher */}
      <View style={[styles.segmented, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Pressable
          onPress={() => setTab('summary')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'summary' }}
          style={[styles.segmentBtn, tab === 'summary' ? { backgroundColor: c.primary } : null]}>
          <AppText
            variant="small"
            style={{ color: tab === 'summary' ? c.primaryText : c.text, fontWeight: '700' }}>
            Performance Analysis
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => setTab('solutions')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'solutions' }}
          style={[styles.segmentBtn, tab === 'solutions' ? { backgroundColor: c.primary } : null]}>
          <AppText
            variant="small"
            style={{ color: tab === 'solutions' ? c.primaryText : c.text, fontWeight: '700' }}>
            Solutions ({answers.length})
          </AppText>
        </Pressable>
      </View>

      {tab === 'summary' ? (
        <View style={{ gap: space.md, marginTop: space.md }}>
          {/* Hero Score Card */}
          <View style={[styles.scoreHero, { backgroundColor: c.surface, borderColor: c.border }]}>
            <AppText variant="small" muted>
              TOTAL SCORE
            </AppText>
            <AppText variant="title" style={{ fontSize: 34, color: c.primary }}>
              {res.score ?? 0}{' '}
              <AppText variant="heading" muted>
                / {res.maxScore ?? metaQ.data?.max_score ?? 0}
              </AppText>
            </AppText>
            {metaQ.data?.official_cutoff ? (
              <AppText variant="small" muted>
                Official Cutoff: {metaQ.data.official_cutoff} marks
              </AppText>
            ) : null}
          </View>

          {/* Breakdown Grid */}
          <View style={styles.gridRow}>
            <View style={[styles.statBox, { backgroundColor: c.surface, borderColor: c.border }]}>
              <AppText variant="small" style={{ color: c.success, fontWeight: '700' }}>
                ✓ Correct
              </AppText>
              <AppText variant="heading">{stats.correct}</AppText>
            </View>
            <View style={[styles.statBox, { backgroundColor: c.surface, borderColor: c.border }]}>
              <AppText variant="small" style={{ color: c.danger, fontWeight: '700' }}>
                ✕ Wrong
              </AppText>
              <AppText variant="heading">{stats.wrong}</AppText>
            </View>
            <View style={[styles.statBox, { backgroundColor: c.surface, borderColor: c.border }]}>
              <AppText variant="small" muted>
                ○ Skipped
              </AppText>
              <AppText variant="heading">{stats.skipped}</AppText>
            </View>
            <View style={[styles.statBox, { backgroundColor: c.surface, borderColor: c.border }]}>
              <AppText variant="small" style={{ color: c.primary, fontWeight: '700' }}>
                🎯 Accuracy
              </AppText>
              <AppText variant="heading">{stats.accuracy}%</AppText>
            </View>
          </View>

          {/* Topic-wise Accuracy */}
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <AppText variant="heading" style={{ marginBottom: space.sm }}>
              Topic Breakdown
            </AppText>
            <View style={{ gap: space.sm }}>
              {stats.topics.map((t) => (
                <View key={t.name} style={styles.topicRow}>
                  <View style={{ flex: 1 }}>
                    <AppText style={{ fontWeight: '600' }}>{t.name}</AppText>
                    <AppText variant="small" muted>
                      {t.correct}/{t.total} correct
                    </AppText>
                  </View>
                  <AppText
                    style={{
                      fontWeight: '700',
                      color: t.pct >= 70 ? c.success : t.pct >= 40 ? c.warning : c.danger,
                    }}>
                    {t.pct}%
                  </AppText>
                </View>
              ))}
            </View>
          </View>

          <Button title="Review Step-by-Step Solutions" onPress={() => setTab('solutions')} />
        </View>
      ) : (
        <View style={{ marginTop: space.md, gap: space.md }}>
          {/* Filter Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: space.xs }}>
              {(
                [
                  { key: 'all', label: `All (${answers.length})` },
                  { key: 'wrong', label: `Wrong (${stats.wrong})` },
                  { key: 'correct', label: `Correct (${stats.correct})` },
                  { key: 'unattempted', label: `Skipped (${stats.skipped})` },
                ] as const
              ).map((f) => (
                <Pressable
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: filter === f.key ? c.primary : c.surface,
                      borderColor: filter === f.key ? c.primary : c.border,
                    },
                  ]}>
                  <AppText
                    variant="small"
                    style={{ color: filter === f.key ? c.primaryText : c.text, fontWeight: '600' }}>
                    {f.label}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {filteredSolutions.map((ans: AttemptResultAnswer, idx) => {
            const correctArr = Array.isArray(ans.correctAnswer)
              ? ans.correctAnswer
              : ans.correctAnswer
                ? [String(ans.correctAnswer)]
                : [];
            const selectedArr = Array.isArray(ans.selectedAnswer)
              ? ans.selectedAnswer
              : ans.selectedAnswer
                ? [String(ans.selectedAnswer)]
                : [];

            return (
              <View
                key={ans.questionId}
                style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <AppText variant="small" style={{ fontWeight: '700', color: c.primary }}>
                    Q{idx + 1} · {ans.topic || ans.sectionKey}
                  </AppText>
                  <AppText
                    variant="small"
                    style={{
                      fontWeight: '700',
                      color: ans.isCorrect ? c.success : selectedArr.length === 0 ? c.textMuted : c.danger,
                    }}>
                    {ans.isCorrect
                      ? `+${ans.marksAwarded ?? ans.marks ?? 1} Marks`
                      : selectedArr.length === 0
                        ? 'Unattempted (0)'
                        : `${ans.marksAwarded ?? 0} Marks`}
                  </AppText>
                </View>

                <AppText style={{ marginBottom: space.sm }}>{ans.questionText}</AppText>

                {(ans.options ?? []).map((opt) => {
                  const isRight = correctArr.includes(opt.id);
                  const isPicked = selectedArr.includes(opt.id);
                  let borderColor = c.border;
                  let bg = c.bg;
                  if (isRight) {
                    borderColor = c.success;
                    bg = c.successBg;
                  } else if (isPicked && !isRight) {
                    borderColor = c.danger;
                    bg = c.liveBg;
                  }
                  return (
                    <View
                      key={opt.id}
                      style={[
                        styles.solOption,
                        { backgroundColor: bg, borderColor },
                      ]}>
                      <AppText
                        variant="small"
                        style={{
                          flex: 1,
                          color: isRight ? c.successFg : isPicked ? c.dangerFg : c.text,
                          fontWeight: isRight || isPicked ? '700' : '400',
                        }}>
                        {opt.text}
                      </AppText>
                      {isRight ? (
                        <AppText variant="small" style={{ color: c.successFg, fontWeight: '700' }}>
                          ✓ Correct
                        </AppText>
                      ) : isPicked ? (
                        <AppText variant="small" style={{ color: c.dangerFg, fontWeight: '700' }}>
                          Your Pick
                        </AppText>
                      ) : null}
                    </View>
                  );
                })}

                {ans.explanation ? (
                  <View style={[styles.expBox, { backgroundColor: c.bg, borderColor: c.border }]}>
                    <AppText variant="small" style={{ fontWeight: '700', marginBottom: 2 }}>
                      Solution Explanation:
                    </AppText>
                    <AppText variant="small" muted>
                      {ans.explanation}
                    </AppText>
                  </View>
                ) : null}
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
  scoreHero: {
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 2,
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
    paddingVertical: 6,
  },
  filterChip: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  solOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginTop: 6,
    gap: space.sm,
  },
  expBox: {
    marginTop: space.sm,
    padding: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
});

