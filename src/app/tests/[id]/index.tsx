import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { toApiError } from '@/api/client';
import { upsertLiveTestRegistration } from '@/api/live';
import {
  getMyTestAttempts,
  getTestMetadata,
  getTestQuestions,
  getTestSections,
  startTestAttempt,
} from '@/api/tests';
import { AppText, Button, ErrorBanner, ErrorView, LoadingView, Screen } from '@/components/ui/kit';
import { recordServerTime } from '@/lib/clock';
import { radius, space, useColors } from '@/theme';

export default function TestIntroScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const { id: testId, testSessionId } = useLocalSearchParams<{
    id: string;
    testSessionId?: string;
  }>();

  const metaQ = useQuery({
    queryKey: ['test-meta', testId],
    queryFn: () => getTestMetadata(testId),
    enabled: !!testId,
  });
  const sectionsQ = useQuery({
    queryKey: ['test-sections', testId],
    queryFn: () => getTestSections(testId),
    enabled: !!testId,
  });
  const attemptsQ = useQuery({
    queryKey: ['my-test-attempts', testId],
    queryFn: () => getMyTestAttempts([testId]),
    enabled: !!testId,
  });

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startsAtGate, setStartsAtGate] = useState<string | null>(null);

  if (metaQ.isLoading || sectionsQ.isLoading || attemptsQ.isLoading) return <LoadingView />;
  if (metaQ.isError) return <ErrorView message={metaQ.error.message} onRetry={() => metaQ.refetch()} />;

  const meta = metaQ.data!;
  const sections = sectionsQ.data ?? [];
  const lastAttempt = attemptsQ.data?.[0]?.lastAttempt ?? null;

  async function handleStartNew() {
    setStarting(true);
    setError(null);
    setStartsAtGate(null);
    try {
      // Pre-check paper access so a scheduled live session that hasn't opened
      // surfaces its `startsAt` timestamp cleanly before creating an attempt.
      await getTestQuestions(testId);

      const sessionNum = testSessionId ? parseInt(testSessionId, 10) : null;
      const started = await startTestAttempt(
        testId,
        sessionNum && Number.isFinite(sessionNum) ? sessionNum : null,
      );
      recordServerTime(started.startedAt);
      if (meta.format === 'live') {
        upsertLiveTestRegistration(testId, { status: 'in_progress' }).catch(() => {});
      }
      await qc.invalidateQueries({ queryKey: ['my-test-attempts', testId] });
      router.replace({
        pathname: '/tests/[id]/window',
        params: {
          id: testId,
          attemptId: String(started.attemptId),
          startedAt: started.startedAt,
        },
      });
    } catch (e) {
      const apiErr = toApiError(e);
      const startsAt = apiErr.body?.startsAt;
      if (typeof startsAt === 'string') {
        setStartsAtGate(startsAt);
      }
      setError(apiErr.message);
    } finally {
      setStarting(false);
    }
  }

  function handleResume(attemptId: number) {
    router.replace({
      pathname: '/tests/[id]/window',
      params: {
        id: testId,
        attemptId: String(attemptId),
        resume: '1',
      },
    });
  }

  function handleViewResult(attemptId: number) {
    router.push({
      pathname: '/tests/[id]/result',
      params: {
        id: testId,
        attemptId: String(attemptId),
      },
    });
  }

  return (
    <Screen>
      {/* Top Bar */}
      <View style={styles.headerRow}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/tests'))} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="title" style={{ fontSize: 21 }}>
            {meta.name}
          </AppText>
          <AppText variant="small" muted>
            {[meta.category_name, meta.stage_name, meta.format_label || meta.subject_label]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
        </View>
      </View>

      {error ? <ErrorBanner message={error} /> : null}
      {startsAtGate ? (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.primary }]}>
          <AppText style={{ fontWeight: '700', color: c.primary }}>
            ⏰ Live Session Scheduled
          </AppText>
          <AppText variant="small" muted>
            Opens on {new Date(startsAtGate).toLocaleString()}
          </AppText>
        </View>
      ) : null}

      {/* Summary Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <AppText variant="small" muted>
            Questions
          </AppText>
          <AppText variant="heading">{meta.total_questions}</AppText>
        </View>
        <View style={[styles.statCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <AppText variant="small" muted>
            Duration
          </AppText>
          <AppText variant="heading">{meta.duration_minutes} mins</AppText>
        </View>
        <View style={[styles.statCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <AppText variant="small" muted>
            Max Marks
          </AppText>
          <AppText variant="heading">{meta.max_score}</AppText>
        </View>
      </View>

      {/* Sections Breakdown */}
      {sections.length > 0 ? (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <AppText variant="heading" style={{ marginBottom: space.sm }}>
            Paper Sections ({sections.length})
          </AppText>
          {sections.map((sec, idx) => (
            <View
              key={sec.section_key}
              style={[
                styles.sectionRow,
                idx > 0 ? { borderTopWidth: 1, borderTopColor: c.border } : null,
              ]}>
              <AppText style={{ fontWeight: '600', flex: 1 }}>
                {idx + 1}. {sec.name}
              </AppText>
              {sec.duration_minutes ? (
                <AppText variant="small" muted>
                  {sec.duration_minutes} mins
                </AppText>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {/* Instructions Card */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <AppText variant="heading" style={{ marginBottom: space.sm }}>
          Exam Instructions
        </AppText>
        <View style={{ gap: 6 }}>
          <AppText variant="small" muted>
            • The timer is synchronized with the server clock. When the time reaches 00:00, your test will auto-submit.
          </AppText>
          <AppText variant="small" muted>
            • Your answers are automatically saved on your device and synced to the server, so you can safely resume if your connection drops.
          </AppText>
          <AppText variant="small" muted>
            • Use &quot;Mark for Review&quot; if you want to revisit a question before final submission.
          </AppText>
          {meta.official_cutoff ? (
            <AppText variant="small" style={{ color: c.primary, fontWeight: '600', marginTop: 4 }}>
              Official Qualifying Cutoff: {meta.official_cutoff} marks
            </AppText>
          ) : null}
        </View>
      </View>

      {/* Previous Attempt Banner */}
      {lastAttempt?.status === 'submitted' ? (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <AppText style={{ fontWeight: '700' }}>
                 Attempt #{lastAttempt.attemptNumber} Completed
              </AppText>
              <AppText variant="small" muted>
                Score: {lastAttempt.score ?? 0} / {lastAttempt.maxScore ?? meta.max_score}
              </AppText>
            </View>
            <Button
              title="Solutions & Analysis"
              variant="outline"
              onPress={() => handleViewResult(lastAttempt.attemptId)}
            />
          </View>
        </View>
      ) : null}

      {/* Action CTA */}
      <View style={{ gap: space.sm, marginTop: space.md }}>
        {lastAttempt?.status === 'in_progress' ? (
          <>
            <Button
              title={`Resume Attempt #${lastAttempt.attemptNumber}`}
              onPress={() => handleResume(lastAttempt.attemptId)}
            />
            <Button
              title="Start Fresh Attempt"
              variant="outline"
              loading={starting}
              onPress={handleStartNew}
            />
          </>
        ) : (
          <Button
            title={lastAttempt ? 'Start New Attempt' : 'Start Test Now'}
            loading={starting}
            onPress={handleStartNew}
          />
        )}
      </View>
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
  statsRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginBottom: space.md,
  },
  statCard: {
    flex: 1,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  card: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: space.md,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
  },
});

