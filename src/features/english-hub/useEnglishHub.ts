import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import {
  getGrammarContent,
  getGrammarMyProgress,
  getVocabularyContent,
  getVocabularyMyProgress,
  saveVocabularyMyProgress,
  updateGrammarTopicProgress,
  type GrammarContentResponse,
  type GrammarProgressState,
  type LessonPhase,
  type LessonProgress,
  type QuizAttempt,
  type QuizQuestion,
  type RevisionEntry,
  type SelfAssessment,
  type UpdateGrammarProgressPayload,
  type VocabContent,
  type VocabProgress,
  type VocabProgressChanges,
  type VocabProgressState,
  type VocabWord,
  type WordStatus,
} from '@/api/englishHub';
import { useAuth } from '@/features/auth/auth-provider';

const EMPTY_VOCAB_CONTENT: VocabContent = {
  categories: [],
  lessons: [],
  words: [],
  questions: [],
};

const EMPTY_VOCAB_PROGRESS: VocabProgressState = {
  wordProgress: [],
  revisions: [],
  lessonProgress: [],
  quizAttempts: [],
};

const EMPTY_GRAMMAR_CONTENT: GrammarContentResponse = {
  levels: [],
  topics: [],
};

const EMPTY_GRAMMAR_PROGRESS: GrammarProgressState = {
  completedTopicIds: [],
  recentlyViewed: [],
  quizResults: {},
};

const REVISION_SCHEDULE = [0, 1, 3, 7, 15, 30] as const;

export const todayStr = () => new Date().toISOString().split('T')[0];

export const addDays = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

export const isNumericId = (val?: string | null): val is string =>
  typeof val === 'string' && /^\d+$/.test(val);

const attemptId = () =>
  `mob_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const vocabProgressKey = (uid: string) => ['vocabulary', 'me', uid] as const;
const grammarProgressKey = (uid: string) => ['grammar', 'me', uid] as const;

interface Snapshot {
  words: Map<string, string>;
  revisions: Map<string, string>;
  lessons: Map<string, string>;
  attempts: Set<string>;
}

const snapshotOf = (s: VocabProgressState): Snapshot => ({
  words: new Map(s.wordProgress.map((p) => [p.wordId, JSON.stringify(p)])),
  revisions: new Map(s.revisions.map((r) => [r.wordId, JSON.stringify(r)])),
  lessons: new Map(s.lessonProgress.map((l) => [l.lessonId, JSON.stringify(l)])),
  attempts: new Set(s.quizAttempts.map((a) => a.id)),
});

const confirmedSnapshots = new Map<string, Snapshot>();
const pendingSaves = new Map<string, Promise<void>>();

function diffVocabChanges(base: Snapshot, next: VocabProgressState): VocabProgressChanges | null {
  const revisionIds = new Set(next.revisions.map((r) => r.wordId));
  const changes: VocabProgressChanges = {
    wordProgress: next.wordProgress.filter((p) => base.words.get(p.wordId) !== JSON.stringify(p)),
    revisions: next.revisions.filter((r) => base.revisions.get(r.wordId) !== JSON.stringify(r)),
    revisionsRemoved: [...base.revisions.keys()].filter((id) => !revisionIds.has(id)),
    lessonProgress: next.lessonProgress.filter((l) => base.lessons.get(l.lessonId) !== JSON.stringify(l)),
    quizAttempts: next.quizAttempts.filter((a) => !base.attempts.has(a.id)),
  };
  return Object.values(changes).some((list) => list && list.length > 0) ? changes : null;
}

function enqueueVocabSync(
  qc: QueryClient,
  uid: string,
  onError: (msg: string | null) => void,
) {
  const prev = pendingSaves.get(uid) ?? Promise.resolve();
  const nextTask = prev.then(async () => {
    const state = qc.getQueryData<VocabProgressState>(vocabProgressKey(uid));
    const base = confirmedSnapshots.get(uid);
    if (!state || !base) return;
    const changes = diffVocabChanges(base, state);
    if (!changes) return;
    try {
      await saveVocabularyMyProgress(changes);
      confirmedSnapshots.set(uid, snapshotOf(state));
      onError(null);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to save vocabulary progress');
    }
  });
  pendingSaves.set(
    uid,
    nextTask.finally(() => {
      if (pendingSaves.get(uid) === nextTask) {
        pendingSaves.delete(uid);
      }
    }),
  );
}

function upsertWordProgressState(
  s: VocabProgressState,
  uid: string,
  wordId: string,
  updates: Partial<VocabProgress>,
): VocabProgressState {
  const idx = s.wordProgress.findIndex((p) => p.wordId === wordId);
  if (idx >= 0) {
    const wordProgress = [...s.wordProgress];
    wordProgress[idx] = { ...wordProgress[idx], ...updates };
    return { ...s, wordProgress };
  }
  const entry: VocabProgress = {
    id: `${uid}_${wordId}`,
    userId: uid,
    wordId,
    status: 'new',
    selfAssessment: null,
    assignedDate: todayStr(),
    timesShown: 1,
    quizAttempts: 0,
    quizAccuracy: 0,
    revisionLevel: 0,
    revisionAttempts: 0,
    isBookmarked: false,
    isDifficult: false,
    ...updates,
  };
  return { ...s, wordProgress: [...s.wordProgress, entry] };
}

function removeRevisionState(s: VocabProgressState, wordId: string): VocabProgressState {
  return { ...s, revisions: s.revisions.filter((r) => r.wordId !== wordId) };
}

function upsertRevisionState(
  s: VocabProgressState,
  uid: string,
  wordId: string,
  level: number,
  extra?: Partial<RevisionEntry>,
): VocabProgressState {
  const nextRevisionDate = addDays(REVISION_SCHEDULE[Math.min(Math.max(level, 0), 5)]);
  const idx = s.revisions.findIndex((r) => r.wordId === wordId);
  if (idx >= 0) {
    const revisions = [...s.revisions];
    revisions[idx] = {
      ...revisions[idx],
      level,
      nextRevisionDate,
      attempts: revisions[idx].attempts + 1,
      ...extra,
    };
    return { ...s, revisions };
  }
  return {
    ...s,
    revisions: [
      ...s.revisions,
      {
        id: `rev_${uid}_${wordId}`,
        userId: uid,
        wordId,
        level,
        nextRevisionDate,
        accuracy: 0,
        attempts: 1,
        ...extra,
      },
    ],
  };
}

function streakFromAttempts(attempts: QuizAttempt[]): number {
  const days = new Set(attempts.map((a) => (a.attemptDate || '').slice(0, 10)).filter(Boolean));
  if (days.size === 0) return 0;
  let streak = 0;
  const cursor = new Date();
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!days.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Deterministic daily index so the spotlight word rotates each day across the active bank. */
export function pickWordOfTheDay(activeWords: VocabWord[], nowMs: number): VocabWord | undefined {
  if (activeWords.length === 0) return undefined;
  const dayIndex = Math.floor(nowMs / 86_400_000) % activeWords.length;
  return activeWords[dayIndex];
}

/** Builds quiz questions for a lesson, falling back to word meanings if none are pre-authored. */
export function buildQuestionsForWords(
  lessonId: string,
  words: VocabWord[],
  allWords: VocabWord[],
  authoredQuestions: QuizQuestion[],
): QuizQuestion[] {
  const matching = isNumericId(lessonId)
    ? authoredQuestions.filter((q) => q.lessonId === lessonId && q.options.length > 1)
    : [];
  if (matching.length > 0) return matching;

  const fallbackPool = [
    'To express doubt or hesitation in formal writing',
    'Relating to ancient cultural traditions and customs',
    'Causing sudden confusion or widespread astonishment',
    'Showing persistent effort despite major obstacles',
  ];

  return words.map((w, idx) => {
    const otherMeanings = allWords
      .filter((other) => other.id !== w.id && other.meaning.trim() !== w.meaning.trim())
      .map((other) => other.meaning.trim());
    const distractors: string[] = [];
    for (const candidate of [...otherMeanings, ...fallbackPool]) {
      if (distractors.length >= 3) break;
      if (candidate !== w.meaning.trim() && !distractors.includes(candidate)) {
        distractors.push(candidate);
      }
    }
    const rawOptions = [w.meaning.trim(), ...distractors];
    // Deterministic rotation per word index so options are balanced without unstable render jitter
    const shift = (idx + w.word.length) % rawOptions.length;
    const options = [...rawOptions.slice(shift), ...rawOptions.slice(0, shift)];

    return {
      id: `auto_${lessonId}_${w.id}`,
      lessonId,
      wordId: w.id,
      type: 'meaning',
      question: `What is the primary meaning of "${w.word}"?`,
      options,
      correctAnswer: w.meaning.trim(),
      explanation: w.memoryTrick
        ? `${w.meaning.trim()} — Tip: ${w.memoryTrick}`
        : `Meaning: ${w.meaning.trim()}`,
      difficulty: w.difficulty,
      marks: 1,
    };
  });
}

export function useVocabularyHub() {
  const { user } = useAuth();
  const uid = user?.id ?? '';
  const qc = useQueryClient();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const contentQ = useQuery({
    queryKey: ['vocabulary', 'content'],
    queryFn: getVocabularyContent,
    staleTime: 3 * 60 * 1000,
  });

  const progressQ = useQuery({
    queryKey: vocabProgressKey(uid),
    enabled: !!uid,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const state = await getVocabularyMyProgress();
      confirmedSnapshots.set(uid, snapshotOf(state));
      return state;
    },
  });

  const content = contentQ.data ?? EMPTY_VOCAB_CONTENT;
  const progress = progressQ.data ?? EMPTY_VOCAB_PROGRESS;

  const categories = useMemo(
    () => content.categories.filter((c) => c.isActive),
    [content.categories],
  );

  const lessons = useMemo(() => {
    return content.lessons.filter(
      (l) => l.status === 'published' && (!l.publishAt || new Date(l.publishAt).getTime() <= nowMs),
    );
  }, [content.lessons, nowMs]);

  const activeWords = useMemo(
    () => content.words.filter((w) => w.isActive && w.contentStatus === 'approved'),
    [content.words],
  );

  const wordMap = useMemo(() => {
    const m = new Map<string, VocabWord>();
    for (const w of activeWords) m.set(w.id, w);
    return m;
  }, [activeWords]);

  const wordProgressMap = useMemo(() => {
    const m = new Map<string, VocabProgress>();
    for (const p of progress.wordProgress) m.set(p.wordId, p);
    return m;
  }, [progress.wordProgress]);

  const lessonProgressMap = useMemo(() => {
    const m = new Map<string, LessonProgress>();
    for (const lp of progress.lessonProgress) m.set(lp.lessonId, lp);
    return m;
  }, [progress.lessonProgress]);

  const today = todayStr();
  const dueRevisions = useMemo(
    () => progress.revisions.filter((r) => r.nextRevisionDate <= today),
    [progress.revisions, today],
  );

  const upcomingRevisions = useMemo(
    () =>
      progress.revisions
        .filter((r) => r.nextRevisionDate > today)
        .sort((a, b) => a.nextRevisionDate.localeCompare(b.nextRevisionDate)),
    [progress.revisions, today],
  );

  const wordOfTheDay = useMemo(() => pickWordOfTheDay(activeWords, nowMs), [activeWords, nowMs]);

  const todayWords = useMemo(() => {
    const overdueIds = new Set(dueRevisions.map((r) => r.wordId));
    const learningIds = new Set(
      progress.wordProgress
        .filter((p) => p.status === 'learning' || p.status === 'learned')
        .map((p) => p.wordId),
    );
    const seenIds = new Set(progress.wordProgress.map((p) => p.wordId));
    const picked: VocabWord[] = [];
    const pushUnique = (w: VocabWord) => {
      if (picked.length < 10 && !picked.some((x) => x.id === w.id)) picked.push(w);
    };
    activeWords.filter((w) => overdueIds.has(w.id)).forEach(pushUnique);
    activeWords.filter((w) => learningIds.has(w.id) && !overdueIds.has(w.id)).forEach(pushUnique);
    activeWords.filter((w) => !seenIds.has(w.id)).forEach(pushUnique);
    return picked.length > 0 ? picked : activeWords.slice(0, 10);
  }, [activeWords, dueRevisions, progress.wordProgress]);

  const stats = useMemo(() => {
    const mastered = progress.wordProgress.filter((p) => p.status === 'mastered').length;
    const learned = progress.wordProgress.filter((p) => p.status === 'learned').length;
    const inProgress = progress.wordProgress.filter((p) => p.status === 'learning').length;
    const bookmarked = progress.wordProgress.filter((p) => p.isBookmarked).length;
    const correct = progress.quizAttempts.filter((a) => a.isCorrect).length;
    const accuracy =
      progress.quizAttempts.length > 0
        ? Math.round((correct / progress.quizAttempts.length) * 100)
        : 0;
    const streak = streakFromAttempts(progress.quizAttempts);
    const level =
      mastered < 20
        ? 'Beginner'
        : mastered < 50
          ? 'Intermediate'
          : mastered < 100
            ? 'Advanced'
            : 'Expert';
    return {
      total: activeWords.length,
      mastered,
      learned,
      inProgress,
      bookmarked,
      revisionDue: dueRevisions.length,
      accuracy,
      streak,
      level,
    };
  }, [activeWords.length, dueRevisions.length, progress.quizAttempts, progress.wordProgress]);

  const mutateProgress = useCallback(
    (updater: (prev: VocabProgressState) => VocabProgressState) => {
      if (!uid) return;
      const key = vocabProgressKey(uid);
      const current = qc.getQueryData<VocabProgressState>(key) ?? EMPTY_VOCAB_PROGRESS;
      if (!confirmedSnapshots.has(uid)) {
        confirmedSnapshots.set(uid, snapshotOf(current));
      }
      const next = updater(current);
      qc.setQueryData<VocabProgressState>(key, next);
      enqueueVocabSync(qc, uid, setSaveError);
    },
    [qc, uid],
  );

  const markWordSelfAssessment = useCallback(
    (wordId: string, assessment: SelfAssessment, lessonId?: string) => {
      const validLesson = isNumericId(lessonId) ? lessonId : undefined;
      mutateProgress((s) => {
        const prev = s.wordProgress.find((p) => p.wordId === wordId);
        const timesShown = (prev?.timesShown ?? 0) + 1;
        if (assessment === 'i_know') {
          const next = upsertWordProgressState(s, uid, wordId, {
            ...(validLesson ? { lessonId: validLesson } : {}),
            selfAssessment: 'i_know',
            status: 'mastered',
            masteredDate: todayStr(),
            timesShown,
          });
          return removeRevisionState(next, wordId);
        }
        if (assessment === 'need_revision') {
          const next = upsertWordProgressState(s, uid, wordId, {
            ...(validLesson ? { lessonId: validLesson } : {}),
            selfAssessment: 'need_revision',
            status: 'learning',
            isDifficult: true,
            timesShown,
          });
          return upsertRevisionState(next, uid, wordId, 1, { nextRevisionDate: addDays(1) });
        }
        return s;
      });
    },
    [mutateProgress, uid],
  );

  const toggleWordBookmark = useCallback(
    (wordId: string) => {
      mutateProgress((s) => {
        const prev = s.wordProgress.find((p) => p.wordId === wordId);
        return upsertWordProgressState(s, uid, wordId, { isBookmarked: !prev?.isBookmarked });
      });
    },
    [mutateProgress, uid],
  );

  const recordQuizAttempt = useCallback(
    (wordId: string, selectedOption: string, correctOption: string, lessonId?: string): boolean => {
      const isCorrect = selectedOption === correctOption;
      const validLesson = isNumericId(lessonId) ? lessonId : undefined;
      const attempt: QuizAttempt = {
        id: attemptId(),
        userId: uid,
        wordId,
        ...(validLesson ? { lessonId: validLesson } : {}),
        selectedOption,
        correctOption,
        isCorrect,
        attemptDate: new Date().toISOString(),
      };
      mutateProgress((s) => ({ ...s, quizAttempts: [...s.quizAttempts, attempt] }));
      return isCorrect;
    },
    [mutateProgress, uid],
  );

  const applyDecisionLogic = useCallback(
    (wordId: string, selfAssessment: SelfAssessment, quizCorrect: boolean): WordStatus => {
      let resultingStatus: WordStatus = 'learning';
      mutateProgress((s) => {
        const existingRev = s.revisions.find((r) => r.wordId === wordId);
        if (selfAssessment === 'i_know' && quizCorrect) {
          resultingStatus = 'mastered';
          return removeRevisionState(
            upsertWordProgressState(s, uid, wordId, {
              status: 'mastered',
              masteredDate: todayStr(),
            }),
            wordId,
          );
        }
        if (selfAssessment === 'need_revision' && quizCorrect) {
          resultingStatus = 'learned';
          const newLevel = existingRev ? Math.min(existingRev.level + 1, 5) : 1;
          return upsertRevisionState(
            upsertWordProgressState(s, uid, wordId, {
              status: 'learned',
              learnedDate: todayStr(),
            }),
            uid,
            wordId,
            newLevel,
          );
        }
        resultingStatus = 'learning';
        const level =
          selfAssessment === 'i_know' ? 1 : existingRev ? existingRev.level : 1;
        return upsertRevisionState(
          upsertWordProgressState(s, uid, wordId, { status: 'learning' }),
          uid,
          wordId,
          level,
        );
      });
      return resultingStatus;
    },
    [mutateProgress, uid],
  );

  const advanceRevision = useCallback(
    (wordId: string, remembered: boolean) => {
      mutateProgress((s) => {
        const entry = s.revisions.find((r) => r.wordId === wordId);
        if (!entry) return s;
        if (!remembered) {
          return upsertRevisionState(
            upsertWordProgressState(s, uid, wordId, { status: 'learning', isDifficult: true }),
            uid,
            wordId,
            1,
            { lastRevisedDate: todayStr(), nextRevisionDate: addDays(1) },
          );
        }
        if (entry.level >= 5) {
          return removeRevisionState(
            upsertWordProgressState(s, uid, wordId, {
              status: 'mastered',
              masteredDate: todayStr(),
              isDifficult: false,
            }),
            wordId,
          );
        }
        const nextLevel = entry.level + 1;
        return upsertRevisionState(
          upsertWordProgressState(s, uid, wordId, {
            status: 'learned',
            learnedDate: todayStr(),
          }),
          uid,
          wordId,
          nextLevel,
          {
            lastRevisedDate: todayStr(),
            accuracy: Math.min(entry.accuracy + 10, 100),
          },
        );
      });
    },
    [mutateProgress, uid],
  );

  const updateLessonPhase = useCallback(
    (
      lessonId: string,
      phase: LessonPhase,
      scores?: { flashcards?: number; spelling?: number; quiz?: number; quizTotal?: number },
    ) => {
      if (!isNumericId(lessonId)) return;
      mutateProgress((s) => {
        const idx = s.lessonProgress.findIndex((lp) => lp.lessonId === lessonId);
        if (idx >= 0) {
          if (phase === 'learning') return s;
          const list = [...s.lessonProgress];
          list[idx] = {
            ...list[idx],
            phase,
            ...(phase === 'completed' ? { completedAt: new Date().toISOString() } : {}),
            ...(scores?.flashcards !== undefined ? { flashcardsScore: scores.flashcards } : {}),
            ...(scores?.spelling !== undefined ? { spellingScore: scores.spelling } : {}),
            ...(scores?.quiz !== undefined ? { quizScore: scores.quiz } : {}),
            ...(scores?.quizTotal !== undefined ? { quizTotal: scores.quizTotal } : {}),
          };
          return { ...s, lessonProgress: list };
        }
        const created: LessonProgress = {
          id: `lp_${uid}_${lessonId}`,
          userId: uid,
          lessonId,
          phase,
          startedAt: new Date().toISOString(),
          ...(phase === 'completed' ? { completedAt: new Date().toISOString() } : {}),
          flashcardsScore: scores?.flashcards ?? 0,
          spellingScore: scores?.spelling ?? 0,
          quizScore: scores?.quiz ?? 0,
          quizTotal: scores?.quizTotal ?? 0,
          timeSpentSeconds: 0,
          selfAssessments: {},
        };
        return { ...s, lessonProgress: [...s.lessonProgress, created] };
      });
    },
    [mutateProgress, uid],
  );

  const getLessonWords = useCallback(
    (lessonId: string): VocabWord[] => {
      const lesson = lessons.find((l) => l.id === lessonId);
      if (!lesson) return [];
      return lesson.wordIds.map((id) => wordMap.get(id)).filter(Boolean) as VocabWord[];
    },
    [lessons, wordMap],
  );

  const getQuestionsForLesson = useCallback(
    (lessonId: string, words: VocabWord[]) =>
      buildQuestionsForWords(lessonId, words, activeWords, content.questions),
    [activeWords, content.questions],
  );

  const refetch = useCallback(() => {
    setNowMs(Date.now());
    void contentQ.refetch();
    if (uid) void progressQ.refetch();
  }, [contentQ, progressQ, uid]);

  return {
    categories,
    lessons,
    activeWords,
    wordMap,
    wordOfTheDay,
    todayWords,
    wordProgress: progress.wordProgress,
    wordProgressMap,
    revisions: progress.revisions,
    dueRevisions,
    upcomingRevisions,
    lessonProgressMap,
    quizAttempts: progress.quizAttempts,
    stats,
    isLoading: contentQ.isLoading || (!!uid && progressQ.isLoading),
    isRefetching: contentQ.isRefetching || progressQ.isRefetching,
    isError: contentQ.isError || progressQ.isError,
    error: contentQ.error ?? progressQ.error,
    saveError,
    clearSaveError: () => setSaveError(null),
    refetch,
    getLessonWords,
    getQuestionsForLesson,
    markWordSelfAssessment,
    toggleWordBookmark,
    recordQuizAttempt,
    applyDecisionLogic,
    advanceRevision,
    updateLessonPhase,
  };
}

export function useGrammarHub() {
  const { user } = useAuth();
  const uid = user?.id ?? '';
  const qc = useQueryClient();

  const contentQ = useQuery({
    queryKey: ['grammar', 'content'],
    queryFn: getGrammarContent,
    staleTime: 5 * 60 * 1000,
  });

  const progressQ = useQuery({
    queryKey: grammarProgressKey(uid),
    enabled: !!uid,
    staleTime: 60 * 1000,
    queryFn: getGrammarMyProgress,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      topicId,
      payload,
    }: {
      topicId: string;
      payload: UpdateGrammarProgressPayload;
    }) => updateGrammarTopicProgress(topicId, payload),
    onSuccess: (next) => {
      if (uid) qc.setQueryData(grammarProgressKey(uid), next);
    },
  });

  const content = contentQ.data ?? EMPTY_GRAMMAR_CONTENT;
  const progress = progressQ.data ?? EMPTY_GRAMMAR_PROGRESS;

  const completedTopics = useMemo(
    () => new Set(progress.completedTopicIds),
    [progress.completedTopicIds],
  );

  const markViewed = useCallback(
    (topicId: string) => {
      if (!uid) return;
      updateMutation.mutate({ topicId, payload: { viewed: true } });
    },
    [uid, updateMutation],
  );

  const toggleCompleted = useCallback(
    (topicId: string) => {
      if (!uid) return;
      const currentlyCompleted = completedTopics.has(topicId);
      updateMutation.mutate({
        topicId,
        payload: { completed: !currentlyCompleted },
      });
    },
    [completedTopics, uid, updateMutation],
  );

  const submitQuizResult = useCallback(
    async (topicId: string, quizScore: number, quizTotal: number) => {
      return updateMutation.mutateAsync({
        topicId,
        payload: { completed: true, quizScore, quizTotal },
      });
    },
    [updateMutation],
  );

  const refetch = useCallback(() => {
    void contentQ.refetch();
    if (uid) void progressQ.refetch();
  }, [contentQ, progressQ, uid]);

  return {
    levels: content.levels,
    topics: content.topics,
    completedTopics,
    recentlyViewed: progress.recentlyViewed,
    quizResults: progress.quizResults,
    isLoading: contentQ.isLoading || (!!uid && progressQ.isLoading),
    isRefetching: contentQ.isRefetching || progressQ.isRefetching,
    isError: contentQ.isError || progressQ.isError,
    error: contentQ.error ?? progressQ.error,
    saveError: updateMutation.error ? updateMutation.error.message : null,
    isSaving: updateMutation.isPending,
    refetch,
    markViewed,
    toggleCompleted,
    submitQuizResult,
  };
}
