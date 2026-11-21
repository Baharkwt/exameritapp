import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { toApiError } from '@/api/client';
import { upsertLiveTestRegistration } from '@/api/live';
import {
  getMyTestAttempts,
  getTestMetadata,
  getTestQuestions,
  getTestSections,
  startTestAttempt,
} from '@/api/tests';
import { AppText, Badge, Button, Card, ErrorBanner, ErrorView, IconTile, LoadingView, Screen, SectionHeader } from '@/components/ui/kit';
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

  const stats = [
    { icon: 'help-circle', label: 'Questions', value: String(meta.total_questions) },
    { icon: 'time', label: 'Minutes', value: String(meta.duration_minutes) },
    { icon: 'ribbon', label: 'Marks', value: String(meta.max_score) },
  ] as const;

  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/tests'))}
        hitSlop={10}
        style={{ marginBottom: space.md, alignSelf: 'flex-start' }}>
        <Ionicons name="arrow-back" size={24} color={c.text} />
      </Pressable>

      <Card tone="hero" style={{ gap: space.sm, marginBottom: space.md }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {meta.access_tier ? (
            <Badge label={meta.access_tier === 'free' ? 'Free' : 'Pro'} tone={meta.access_tier === 'free' ? 'success' : 'warning'} />
          ) : null}
          {meta.difficulty ? <Badge label={String(meta.difficulty)} tone="info" /> : null}
        </View>
        <Text style={{ color: c.heroText, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 }}>{meta.name}</Text>
        <Text style={{ color: c.heroMuted, fontSize: 13, fontWeight: '600' }}>
          {[meta.category_name, meta.stage_name, meta.format_label || meta.subject_label].filter(Boolean).join(' · ')}
        </Text>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
          {stats.map((s) => (
            <View key={s.label} style={[styles.heroStat, { backgroundColor: c.heroSoft }]}>
              <Ionicons name={s.icon} size={16} color={c.heroMuted} />
              <Text style={{ color: c.heroText, fontSize: 18, fontWeight: '800', marginTop: 4 }}>{s.value}</Text>
              <Text style={{ color: c.heroMuted, fontSize: 11, fontWeight: '600' }}>{s.label}</Text>
            </View>
          ))}
        </View>
      </Card>

      {error ? <ErrorBanner message={error} /> : null}
      {startsAtGate ? (
        <Card tone="soft" style={{ marginBottom: space.md, flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          <IconTile icon="alarm" color={c.primary} bg={c.surface} size={40} />
          <View style={{ flex: 1 }}>
            <AppText style={{ fontWeight: '800' }}>Live session scheduled</AppText>
            <AppText variant="small" muted>
              Opens {new Date(startsAtGate).toLocaleString()}
            </AppText>
          </View>
        </Card>
      ) : null}

      {sections.length > 0 ? (
        <>
          <SectionHeader title={`Sections · ${sections.length}`} />
          <Card style={{ paddingVertical: space.sm }}>
            {sections.map((sec, idx) => (
              <View
                key={sec.section_key}
                style={[styles.sectionRow, idx > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border } : null]}>
                <View style={[styles.num, { backgroundColor: c.primarySoft }]}>
                  <Text style={{ color: c.primary, fontWeight: '800', fontSize: 12 }}>{idx + 1}</Text>
                </View>
                <AppText style={{ fontWeight: '600', flex: 1 }}>{sec.name}</AppText>
                {sec.duration_minutes ? (
                  <AppText variant="small" muted>
                    {sec.duration_minutes} min
                  </AppText>
                ) : null}
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Before you begin" />
      <Card style={{ gap: space.md }}>
        {(
          [
            ['timer', 'Timer follows the server clock and auto-submits at 00:00.'],
            ['cloud-done', 'Answers autosave, so you can resume if your connection drops.'],
            ['flag', 'Mark questions for review and revisit them from the palette.'],
          ] as const
        ).map(([icon, text]) => (
          <View key={icon} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
            <Ionicons name={icon} size={18} color={c.primary} />
            <AppText variant="small" muted style={{ flex: 1 }}>
              {text}
            </AppText>
          </View>
        ))}
        {meta.official_cutoff ? (
          <AppText variant="small" style={{ color: c.primary, fontWeight: '700' }}>
            Official qualifying cutoff: {meta.official_cutoff} marks
          </AppText>
        ) : null}
      </Card>

      {/* Previous Attempt Banner */}
      {lastAttempt?.status === 'submitted' ? (
        <Card style={{ marginTop: space.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
            <View style={{ flex: 1 }}>
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
        </Card>
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
  heroStat: { flex: 1, padding: space.md, borderRadius: radius.md },
  num: { width: 26, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
  },
});

