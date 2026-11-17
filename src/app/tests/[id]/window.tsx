import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { toApiError } from '@/api/client';
import { upsertLiveTestRegistration } from '@/api/live';
import {
  AnswerState,
  getAttemptAnswers,
  getTestMetadata,
  getTestQuestions,
  getTestSections,
  reportQuestion,
  SavedAttemptAnswer,
  SubmitAnswerInput,
  TestQuestion,
} from '@/api/tests';
import { AppText, Button, ErrorBanner, ErrorView, LoadingView, Screen } from '@/components/ui/kit';
import { computeRemainingSeconds, recordServerTime } from '@/lib/clock';
import {
  flushAutosave,
  LocalAttemptSnapshot,
  readLocalAttempt,
  submitWithRetry,
  writeLocalAttempt,
} from '@/lib/test-attempt-storage';
import { radius, space, useColors } from '@/theme';

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}

const REPORT_TYPES = [
  'Wrong Question',
  'Wrong Options',
  'Formatting / Typo',
  'Out of Syllabus',
];

export default function TestWindowScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{
    id: string;
    attemptId: string;
    startedAt?: string;
    resume?: string;
  }>();

  const testId = params.id;
  const attemptId = Number(params.attemptId);

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
  const questionsQ = useQuery({
    queryKey: ['test-questions', testId],
    queryFn: () => getTestQuestions(testId),
    enabled: !!testId,
  });

  const [answersMap, setAnswersMap] = useState<Record<number, SavedAttemptAnswer>>({});
  const [startedAtIso, setStartedAtIso] = useState<string>(params.startedAt || new Date().toISOString());
  const [hydrated, setHydrated] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportType, setReportType] = useState(REPORT_TYPES[0]);
  const [reportComment, setReportComment] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'saved' | 'saving' | 'offline'>('saved');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);

  const questionEnteredAtRef = useRef<number>(0);
  const snapshotRef = useRef<LocalAttemptSnapshot | null>(null);
  const autoSubmitTriggeredRef = useRef(false);

  useEffect(() => {
    questionEnteredAtRef.current = Date.now();
  }, [currentIndex]);

  const questions = useMemo(() => questionsQ.data ?? [], [questionsQ.data]);
  const sections = useMemo(() => sectionsQ.data ?? [], [sectionsQ.data]);
  const durationMinutes = metaQ.data?.duration_minutes ?? 60;

  // Hydrate saved answers from local storage + server on mount
  useEffect(() => {
    if (!testId || !Number.isFinite(attemptId) || hydrated) return;
    let alive = true;

    (async () => {
      const local = await readLocalAttempt(testId, attemptId);
      let serverStartedAt = params.startedAt ?? local?.startedAt ?? new Date().toISOString();
      const merged: Record<number, SavedAttemptAnswer> = { ...(local?.answers ?? {}) };

      if (params.resume === '1' || !params.startedAt) {
        try {
          const remote = await getAttemptAnswers(testId, attemptId);
          if (remote.startedAt) {
            serverStartedAt = remote.startedAt;
            recordServerTime(remote.startedAt);
          }
          for (const a of remote.answers) {
            // Keep local if local is newer/dirty, otherwise take server
            if (!merged[a.questionId]) {
              merged[a.questionId] = a;
            }
          }
        } catch {
          /* offline or new attempt — rely on local snapshot */
        }
      }

      if (!alive) return;
      setStartedAtIso(serverStartedAt);
      setAnswersMap(merged);
      const snap: LocalAttemptSnapshot = {
        testId,
        attemptId,
        startedAt: serverStartedAt,
        durationMinutes,
        answers: merged,
        dirty: false,
        pendingSubmit: false,
        updatedAt: Date.now(),
      };
      snapshotRef.current = snap;
      await writeLocalAttempt(snap);
      setHydrated(true);
    })();

    return () => {
      alive = false;
    };
  }, [testId, attemptId, hydrated, params.startedAt, params.resume, durationMinutes]);

  // Persist helper + debounced autosave
  const persistAnswerUpdate = useCallback(
    async (nextMap: Record<number, SavedAttemptAnswer>) => {
      setAnswersMap(nextMap);
      const snap: LocalAttemptSnapshot = {
        testId,
        attemptId,
        startedAt: startedAtIso,
        durationMinutes,
        answers: nextMap,
        dirty: true,
        pendingSubmit: false,
        updatedAt: Date.now(),
      };
      snapshotRef.current = snap;
      await writeLocalAttempt(snap);
      setSyncStatus('saving');
      const ok = await flushAutosave(snap);
      setSyncStatus(ok ? 'saved' : 'offline');
    },
    [testId, attemptId, startedAtIso, durationMinutes],
  );

  // Record time spent on the current question before leaving or submitting
  const commitTimeOnCurrentQuestion = useCallback(
    (baseMap: Record<number, SavedAttemptAnswer>): Record<number, SavedAttemptAnswer> => {
      const q = questions[currentIndex];
      if (!q) return baseMap;
    const elapsedSec =
      questionEnteredAtRef.current > 0
        ? Math.max(0, Math.round((Date.now() - questionEnteredAtRef.current) / 1000))
        : 0;
    questionEnteredAtRef.current = Date.now();
      const existing = baseMap[q.question_id];
      const nextState: AnswerState = existing?.answerState ?? 'not_answered';
      return {
        ...baseMap,
        [q.question_id]: {
          questionId: q.question_id,
          sectionKey: q.section_key,
          selectedAnswer: existing?.selectedAnswer ?? null,
          answerState: nextState === 'not_visited' ? 'not_answered' : nextState,
          timeSpentSec: (existing?.timeSpentSec ?? 0) + elapsedSec,
        },
      };
    },
    [questions, currentIndex],
  );

  const isLiveFormat = metaQ.data?.format === 'live';

  // Final submission handler (used by manual submit and timer expiry)
  const executeSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    const finalMap = commitTimeOnCurrentQuestion(answersMap);
    const payload: SubmitAnswerInput[] = questions.map((q) => {
      const saved = finalMap[q.question_id];
      return {
        questionId: q.question_id,
        selectedAnswer: saved?.selectedAnswer ?? null,
        answerState: saved?.answerState ?? 'not_visited',
        timeSpentSec: saved?.timeSpentSec ?? 0,
      };
    });

    try {
      const outcome = await submitWithRetry(testId, attemptId, payload, 3);
      if (isLiveFormat) {
        upsertLiveTestRegistration(testId, {
          status: 'completed',
          score: outcome.response?.score ?? null,
        }).catch(() => {});
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['my-test-attempts', testId] }),
        qc.invalidateQueries({ queryKey: ['exam-progress'] }),
        qc.invalidateQueries({ queryKey: ['free-quizzes'] }),
        qc.invalidateQueries({ queryKey: ['live-test-registrations'] }),
      ]);
      router.replace({
        pathname: '/tests/[id]/result',
        params: { id: testId, attemptId: String(attemptId) },
      });
    } catch (e) {
      setSubmitError(toApiError(e).message);
      setSubmitting(false);
    }
  }, [submitting, commitTimeOnCurrentQuestion, answersMap, questions, testId, attemptId, qc, isLiveFormat]);

  // Server-authoritative 1-second timer + AppState foreground resync
  useEffect(() => {
    if (!hydrated || !metaQ.data) return;

    const tick = () => {
      const rem = computeRemainingSeconds(startedAtIso, metaQ.data.duration_minutes);
      setRemainingSec(rem);
      if (rem <= 0 && !autoSubmitTriggeredRef.current && questions.length > 0) {
        autoSubmitTriggeredRef.current = true;
        executeSubmit();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [hydrated, metaQ.data, startedAtIso, questions.length, executeSubmit]);

  // Periodic background autosave flush + AppState background flush
  useEffect(() => {
    const interval = setInterval(async () => {
      if (snapshotRef.current?.dirty) {
        const ok = await flushAutosave(snapshotRef.current);
        setSyncStatus(ok ? 'saved' : 'offline');
      }
    }, 10_000);

    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && snapshotRef.current) {
        flushAutosave(snapshotRef.current);
      }
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, []);

  if (metaQ.isLoading || sectionsQ.isLoading || questionsQ.isLoading || !hydrated) {
    return <LoadingView />;
  }
  if (questionsQ.isError || metaQ.isError) {
    return (
      <ErrorView
        message={(questionsQ.error ?? metaQ.error)?.message ?? 'Unable to load test paper'}
        onRetry={() => {
          metaQ.refetch();
          questionsQ.refetch();
        }}
      />
    );
  }

  const maybeQuestion: TestQuestion | undefined = questions[currentIndex];
  if (!maybeQuestion) {
    return <ErrorView message="This test has no questions." onRetry={() => router.back()} />;
  }
  const currentQuestion: TestQuestion = maybeQuestion;

  const currentSaved = answersMap[currentQuestion.question_id];
  const selectedVal = currentSaved?.selectedAnswer ?? null;
  const isMsq = currentQuestion.question_type === 'msq';
  const isNumerical = currentQuestion.question_type === 'numerical';

  function selectOption(optionId: string) {
    const base = commitTimeOnCurrentQuestion(answersMap);
    const prev = base[currentQuestion.question_id];
    const wasMarked =
      prev?.answerState === 'marked_for_review' || prev?.answerState === 'answered_and_marked';

    let nextSelected: string | string[] | null;
    if (isMsq) {
      const currentArr = Array.isArray(prev?.selectedAnswer) ? prev.selectedAnswer : [];
      nextSelected = currentArr.includes(optionId)
        ? currentArr.filter((x) => x !== optionId)
        : [...currentArr, optionId];
      if (nextSelected.length === 0) nextSelected = null;
    } else {
      nextSelected = prev?.selectedAnswer === optionId ? null : optionId;
    }

    const hasAnswer =
      nextSelected !== null && (!Array.isArray(nextSelected) || nextSelected.length > 0);
    const nextState: AnswerState = hasAnswer
      ? wasMarked
        ? 'answered_and_marked'
        : 'answered'
      : wasMarked
        ? 'marked_for_review'
        : 'not_answered';

    persistAnswerUpdate({
      ...base,
      [currentQuestion.question_id]: {
        questionId: currentQuestion.question_id,
        sectionKey: currentQuestion.section_key,
        selectedAnswer: nextSelected,
        answerState: nextState,
        timeSpentSec: prev?.timeSpentSec ?? 0,
      },
    });
  }

  function setNumericalAnswer(text: string) {
    const base = commitTimeOnCurrentQuestion(answersMap);
    const prev = base[currentQuestion.question_id];
    const trimmed = text.trim();
    const hasAnswer = trimmed.length > 0;
    const wasMarked =
      prev?.answerState === 'marked_for_review' || prev?.answerState === 'answered_and_marked';
    const nextState: AnswerState = hasAnswer
      ? wasMarked
        ? 'answered_and_marked'
        : 'answered'
      : wasMarked
        ? 'marked_for_review'
        : 'not_answered';

    persistAnswerUpdate({
      ...base,
      [currentQuestion.question_id]: {
        questionId: currentQuestion.question_id,
        sectionKey: currentQuestion.section_key,
        selectedAnswer: hasAnswer ? trimmed : null,
        answerState: nextState,
        timeSpentSec: prev?.timeSpentSec ?? 0,
      },
    });
  }

  function toggleMarkForReview() {
    const base = commitTimeOnCurrentQuestion(answersMap);
    const prev = base[currentQuestion.question_id];
    const sel = prev?.selectedAnswer ?? null;
    const hasAnswer = sel !== null && (!Array.isArray(sel) || sel.length > 0);
    const currentlyMarked =
      prev?.answerState === 'marked_for_review' || prev?.answerState === 'answered_and_marked';

    const nextState: AnswerState = currentlyMarked
      ? hasAnswer
        ? 'answered'
        : 'not_answered'
      : hasAnswer
        ? 'answered_and_marked'
        : 'marked_for_review';

    persistAnswerUpdate({
      ...base,
      [currentQuestion.question_id]: {
        questionId: currentQuestion.question_id,
        sectionKey: currentQuestion.section_key,
        selectedAnswer: sel,
        answerState: nextState,
        timeSpentSec: prev?.timeSpentSec ?? 0,
      },
    });
  }

  function clearResponse() {
    const base = commitTimeOnCurrentQuestion(answersMap);
    const prev = base[currentQuestion.question_id];
    persistAnswerUpdate({
      ...base,
      [currentQuestion.question_id]: {
        questionId: currentQuestion.question_id,
        sectionKey: currentQuestion.section_key,
        selectedAnswer: null,
        answerState: 'not_answered',
        timeSpentSec: prev?.timeSpentSec ?? 0,
      },
    });
  }

  function goToQuestion(idx: number) {
    if (idx < 0 || idx >= questions.length) return;
    const updated = commitTimeOnCurrentQuestion(answersMap);
    persistAnswerUpdate(updated);
    setCurrentIndex(idx);
    setPaletteOpen(false);
  }

  function confirmSubmit() {
    const answeredCount = Object.values(answersMap).filter(
      (a) => a.answerState === 'answered' || a.answerState === 'answered_and_marked',
    ).length;

    Alert.alert(
      'Submit Test?',
      `You have answered ${answeredCount} of ${questions.length} questions. Once submitted, you cannot change your answers.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit Now', style: 'destructive', onPress: executeSubmit },
      ],
    );
  }

  async function handleSendReport() {
    setReportSending(true);
    try {
      const secObj = sections.find((s) => s.section_key === currentQuestion.section_key);
      await reportQuestion({
        categoryId: metaQ.data?.category_id,
        examId: metaQ.data?.exam_id,
        testId,
        sectionId: currentQuestion.section_key,
        sectionName: secObj?.name ?? currentQuestion.section_key,
        questionId: currentQuestion.question_id,
        questionNumber: currentIndex + 1,
        reportType,
        studentComment: reportComment.trim() || undefined,
        questionSnapshot: {
          questionText: currentQuestion.question_text,
          options: currentQuestion.options,
          questionType: currentQuestion.question_type,
        },
        studentSelectedAnswer: selectedVal,
      });
      setReportModalOpen(false);
      setReportComment('');
      Alert.alert('Reported', 'Thank you! Our academic team will review this question.');
    } catch (e) {
      Alert.alert('Error', toApiError(e).message);
    } finally {
      setReportSending(false);
    }
  }

  const isLowTime = remainingSec !== null && remainingSec < 300;
  const isMarked =
    currentSaved?.answerState === 'marked_for_review' ||
    currentSaved?.answerState === 'answered_and_marked';

  return (
    <Screen scroll={false} padded={false}>
      {/* Top Exam Bar */}
      <View style={[styles.topBar, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <View style={{ flex: 1 }}>
          <AppText style={{ fontWeight: '700' }} numberOfLines={1}>
            {metaQ.data?.name}
          </AppText>
          <AppText variant="small" muted>
            {syncStatus === 'saved'
              ? '✓ Autosaved'
              : syncStatus === 'saving'
                ? 'Syncing...'
                : '⚡ Saved on device (offline)'}
          </AppText>
        </View>

        <View
          style={[
            styles.timerPill,
            { backgroundColor: isLowTime ? c.dangerBg : c.bg, borderColor: isLowTime ? c.danger : c.border },
          ]}>
          <Ionicons name="time-outline" size={16} color={isLowTime ? c.danger : c.text} />
          <AppText
            style={{
              fontWeight: '700',
              fontVariant: ['tabular-nums'],
              color: isLowTime ? c.danger : c.text,
            }}>
            {remainingSec !== null ? formatClock(remainingSec) : '--:--'}
          </AppText>
        </View>

        <Pressable
          onPress={() => setPaletteOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Open question palette"
          hitSlop={8}
          style={[styles.iconBtn, { borderColor: c.border }]}>
          <Ionicons name="apps-outline" size={20} color={c.text} />
        </Pressable>
      </View>

      {/* Section Tabs */}
      {sections.length > 1 ? (
        <View style={{ backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.secStrip}>
            {sections.map((sec) => {
              const active = currentQuestion.section_key === sec.section_key;
              return (
                <Pressable
                  key={sec.section_key}
                  onPress={() => {
                    const firstIdx = questions.findIndex((q) => q.section_key === sec.section_key);
                    if (firstIdx >= 0) goToQuestion(firstIdx);
                  }}
                  style={[
                    styles.secChip,
                    {
                      backgroundColor: active ? c.primary : c.bg,
                      borderColor: active ? c.primary : c.border,
                    },
                  ]}>
                  <AppText
                    variant="small"
                    style={{ color: active ? c.primaryText : c.text, fontWeight: '600' }}>
                    {sec.name}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* Question Content Scroll */}
      <ScrollView contentContainerStyle={styles.questionScroll}>
        {submitError ? <ErrorBanner message={submitError} /> : null}

        {/* Question Header Meta */}
        <View style={styles.qMetaRow}>
          <AppText variant="heading">
            Q{currentIndex + 1} of {questions.length}
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <AppText variant="small" style={{ color: c.success, fontWeight: '700' }}>
              +{currentQuestion.marks}
            </AppText>
            <AppText variant="small" style={{ color: c.danger, fontWeight: '700' }}>
              -{currentQuestion.negative_marks}
            </AppText>
            <Pressable
              onPress={() => setReportModalOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Report this question"
              hitSlop={12}>
              <Ionicons name="flag-outline" size={18} color={c.textMuted} />
            </Pressable>
          </View>
        </View>

        {/* Shared Passage / DI Set Content if present */}
        {currentQuestion.sets?.sharedContent ? (
          <View style={[styles.passageBox, { backgroundColor: c.surface, borderColor: c.border }]}>
            <AppText variant="small" style={{ fontWeight: '700', marginBottom: 4 }}>
              Directions / Passage:
            </AppText>
            <AppText variant="small">{currentQuestion.sets.sharedContent}</AppText>
          </View>
        ) : null}

        {/* Question Stem */}
        <View style={[styles.stemCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <AppText style={{ fontSize: 16, lineHeight: 24 }}>{currentQuestion.question_text}</AppText>
          {isMsq ? (
            <AppText variant="small" muted style={{ marginTop: 6 }}>
              (Multiple Select Question — select all that apply)
            </AppText>
          ) : null}
        </View>

        {/* Options or Numerical Input */}
        {isNumerical ? (
          <View style={{ marginTop: space.md }}>
            <AppText style={{ fontWeight: '600', marginBottom: 6 }}>Your Numerical Answer:</AppText>
            <TextInput
              value={typeof selectedVal === 'string' ? selectedVal : ''}
              onChangeText={setNumericalAnswer}
              keyboardType="numeric"
              placeholder="Enter numeric value"
              placeholderTextColor={c.textMuted}
              style={[
                styles.numInput,
                { backgroundColor: c.surface, color: c.text, borderColor: c.border },
              ]}
            />
          </View>
        ) : (
          <View style={{ gap: space.sm, marginTop: space.md }}>
            {(currentQuestion.options ?? []).map((opt, oIdx) => {
              const selected = Array.isArray(selectedVal)
                ? selectedVal.includes(opt.id)
                : selectedVal === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => selectOption(opt.id)}
                  accessibilityRole={isMsq ? 'checkbox' : 'radio'}
                  accessibilityLabel={`Option ${String.fromCharCode(65 + oIdx)}: ${opt.text}`}
                  accessibilityState={{ checked: selected }}
                  style={[
                    styles.optionRow,
                    {
                      backgroundColor: selected ? c.primary : c.surface,
                      borderColor: selected ? c.primary : c.border,
                    },
                  ]}>
                  <View
                    style={[
                      styles.optionLetter,
                      {
                        backgroundColor: selected ? c.primaryText : c.bg,
                      },
                    ]}>
                    <AppText
                      variant="small"
                      style={{
                        fontWeight: '700',
                        color: selected ? c.primary : c.text,
                      }}>
                      {String.fromCharCode(65 + oIdx)}
                    </AppText>
                  </View>
                  <AppText
                    style={{
                      flex: 1,
                      color: selected ? c.primaryText : c.text,
                      fontWeight: selected ? '600' : '400',
                    }}>
                    {opt.text}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Secondary Actions (Mark for Review & Clear) */}
        <View style={styles.secondaryActions}>
          <Pressable
            onPress={toggleMarkForReview}
            accessibilityRole="button"
            accessibilityState={{ selected: isMarked }}
            style={[
              styles.secActionBtn,
              {
                borderColor: isMarked ? c.marked : c.border,
                backgroundColor: isMarked ? c.markedBg : c.surface,
              },
            ]}>
            <Ionicons
              name={isMarked ? 'bookmark' : 'bookmark-outline'}
              size={16}
              color={isMarked ? c.marked : c.text}
            />
            <AppText
              variant="small"
              style={{ color: isMarked ? c.marked : c.text, fontWeight: '600' }}>
              {isMarked ? 'Marked for Review' : 'Mark for Review'}
            </AppText>
          </Pressable>

          <Pressable
            onPress={clearResponse}
            accessibilityRole="button"
            accessibilityLabel="Clear response"
            style={[styles.secActionBtn, { borderColor: c.border, backgroundColor: c.surface }]}>
            <AppText variant="small" muted>
              Clear Response
            </AppText>
          </Pressable>
        </View>
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View style={[styles.bottomBar, { backgroundColor: c.surface, borderTopColor: c.border }]}>
        <Button
          title="Prev"
          variant="outline"
          disabled={currentIndex === 0}
          onPress={() => goToQuestion(currentIndex - 1)}
        />
        <Button
          title="Submit Test"
          variant="danger"
          loading={submitting}
          onPress={confirmSubmit}
        />
        <Button
          title={currentIndex === questions.length - 1 ? 'Palette' : 'Next'}
          onPress={() => {
            if (currentIndex === questions.length - 1) {
              setPaletteOpen(true);
            } else {
              goToQuestion(currentIndex + 1);
            }
          }}
        />
      </View>

      {/* Question Palette Modal */}
      <Modal visible={paletteOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: c.surface }]}>
            <View style={styles.modalHeader}>
              <AppText variant="heading">Question Palette</AppText>
              <Pressable onPress={() => setPaletteOpen(false)}>
                <Ionicons name="close" size={24} color={c.text} />
              </Pressable>
            </View>

            {/* Legend */}
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: c.success }]} />
                <AppText variant="small">Answered</AppText>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: c.danger }]} />
                <AppText variant="small">Visited</AppText>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: c.marked }]} />
                <AppText variant="small">Review</AppText>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.paletteGrid}>
              {questions.map((q, idx) => {
                const st = answersMap[q.question_id]?.answerState ?? 'not_visited';
                let bg = c.bg;
                let fg = c.text;
                if (st === 'answered') {
                  bg = c.success;
                  fg = '#fff';
                } else if (st === 'answered_and_marked' || st === 'marked_for_review') {
                  bg = c.marked;
                  fg = '#fff';
                } else if (st === 'not_answered') {
                  bg = c.danger;
                  fg = '#fff';
                }
                return (
                  <Pressable
                    key={q.question_id}
                    onPress={() => goToQuestion(idx)}
                    style={[
                      styles.paletteCell,
                      {
                        backgroundColor: bg,
                        borderColor: idx === currentIndex ? c.primary : c.border,
                        borderWidth: idx === currentIndex ? 2.5 : 1,
                      },
                    ]}>
                    <AppText variant="small" style={{ color: fg, fontWeight: '700' }}>
                      {idx + 1}
                    </AppText>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Button
              title="Submit Test"
              variant="danger"
              loading={submitting}
              onPress={() => {
                setPaletteOpen(false);
                confirmSubmit();
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Report Question Modal */}
      <Modal visible={reportModalOpen} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: c.surface }]}>
            <View style={styles.modalHeader}>
              <AppText variant="heading">Report Question #{currentIndex + 1}</AppText>
              <Pressable onPress={() => setReportModalOpen(false)}>
                <Ionicons name="close" size={24} color={c.text} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginVertical: space.sm }}>
              {REPORT_TYPES.map((rt) => (
                <Pressable
                  key={rt}
                  onPress={() => setReportType(rt)}
                  style={[
                    styles.secChip,
                    {
                      backgroundColor: reportType === rt ? c.primary : c.bg,
                      borderColor: reportType === rt ? c.primary : c.border,
                    },
                  ]}>
                  <AppText
                    variant="small"
                    style={{ color: reportType === rt ? c.primaryText : c.text }}>
                    {rt}
                  </AppText>
                </Pressable>
              ))}
            </View>
            <TextInput
              placeholder="Describe the issue (optional)"
              placeholderTextColor={c.textMuted}
              value={reportComment}
              onChangeText={setReportComment}
              multiline
              style={[
                styles.reportInput,
                { backgroundColor: c.bg, color: c.text, borderColor: c.border },
              ]}
            />
            <Button title="Submit Report" loading={reportSending} onPress={handleSendReport} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    gap: space.sm,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  iconBtn: {
    padding: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  secStrip: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    gap: space.xs,
  },
  secChip: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  questionScroll: {
    padding: space.md,
    paddingBottom: space.xxl,
  },
  qMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  passageBox: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: space.sm,
  },
  stemCard: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: space.md,
  },
  optionLetter: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    fontSize: 16,
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: space.lg,
    gap: space.sm,
  },
  secActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderTopWidth: 1,
    gap: space.sm,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  legendRow: {
    flexDirection: 'row',
    gap: space.md,
    marginBottom: space.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    paddingVertical: space.md,
  },
  paletteCell: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    minHeight: 80,
    marginVertical: space.sm,
    textAlignVertical: 'top',
  },
});
