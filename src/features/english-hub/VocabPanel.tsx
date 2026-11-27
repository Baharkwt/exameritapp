import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { QuizQuestion, VocabWord } from '@/api/englishHub';
import {
  AppText,
  Badge,
  Button,
  Card,
  Chip,
  EmptyView,
  ErrorBanner,
  ErrorView,
  LoadingView,
  Segmented,
} from '@/components/ui/kit';
import { useVocabularyHub } from '@/features/english-hub/useEnglishHub';
import { VocabLessonModal } from '@/features/english-hub/VocabLessonModal';
import { VocabWordImage } from '@/features/english-hub/VocabWordImage';
import { haptic } from '@/lib/haptics';
import { elevation, radius, space, TOUCH, useColors } from '@/theme';

export type VocabSubView = 'lessons' | 'mywords' | 'revision';
type WordFilter = 'all' | 'mastered' | 'learning' | 'revision' | 'bookmarked';

export function VocabPanel({ initialView }: { initialView?: string }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const vocab = useVocabularyHub();

  const { dueRevisions, upcomingRevisions, wordMap, todayWords, getQuestionsForLesson } = vocab;
  const viewKey = initialView ?? '';
  const paramSubView: VocabSubView =
    initialView === 'mywords' || initialView === 'revision' ? initialView : 'lessons';
  const [subViewOverride, setSubViewOverride] = useState<{ key: string; view: VocabSubView } | null>(
    null,
  );
  const subView = subViewOverride?.key === viewKey ? subViewOverride.view : paramSubView;

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [wordFilter, setWordFilter] = useState<WordFilter>('all');
  const [wordSearch, setWordSearch] = useState('');
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Active lesson modal
  const [activeLessonModal, setActiveLessonModal] = useState<{
    lessonId: string;
    title: string;
    words: VocabWord[];
    questions: QuizQuestion[];
  } | null>(null);
  const [dismissedWotd, setDismissedWotd] = useState(false);

  // Active spaced-repetition session modal
  const [revSessionOpen, setRevSessionOpen] = useState(false);
  const [revIdx, setRevIdx] = useState(0);
  const [revRevealed, setRevRevealed] = useState(false);

  const effectiveLessonModal = useMemo(() => {
    if (activeLessonModal) return activeLessonModal;
    if (initialView === 'wordofday' && !dismissedWotd && todayWords.length > 0) {
      return {
        lessonId: 'wordofday',
        title: "Today's Word Batch",
        words: todayWords,
        questions: getQuestionsForLesson('wordofday', todayWords),
      };
    }
    return null;
  }, [activeLessonModal, dismissedWotd, getQuestionsForLesson, initialView, todayWords]);

  useEffect(() => {
    if (!feedbackToast) return;
    const t = setTimeout(() => setFeedbackToast(null), 2600);
    return () => clearTimeout(t);
  }, [feedbackToast]);

  const filteredLessons = useMemo(() => {
    if (selectedCategoryId === 'all') return vocab.lessons;
    return vocab.lessons.filter((l) => l.categoryId === selectedCategoryId);
  }, [vocab.lessons, selectedCategoryId]);

  const categoryNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const cat of vocab.categories) m.set(cat.id, cat.name);
    return m;
  }, [vocab.categories]);

  const revisionWordIds = useMemo(
    () => new Set(vocab.revisions.map((r) => r.wordId)),
    [vocab.revisions],
  );

  const filteredMyWords = useMemo(() => {
    const q = wordSearch.trim().toLowerCase();
    return vocab.activeWords.filter((w) => {
      const wp = vocab.wordProgressMap.get(w.id);
      if (wordFilter === 'mastered' && wp?.status !== 'mastered') return false;
      if (wordFilter === 'learning' && wp?.status !== 'learning' && wp?.status !== 'learned') {
        return false;
      }
      if (wordFilter === 'revision' && !revisionWordIds.has(w.id)) return false;
      if (wordFilter === 'bookmarked' && !wp?.isBookmarked) return false;
      if (!q) return true;
      return w.word.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q);
    });
  }, [vocab.activeWords, vocab.wordProgressMap, revisionWordIds, wordFilter, wordSearch]);

  const dueRevisionWords = useMemo(
    () =>
      dueRevisions
        .map((rev) => ({ rev, word: wordMap.get(rev.wordId) }))
        .filter((x): x is { rev: typeof dueRevisions[number]; word: VocabWord } => !!x.word),
    [dueRevisions, wordMap],
  );

  const upcomingRevisionWords = useMemo(
    () =>
      upcomingRevisions
        .map((rev) => ({ rev, word: wordMap.get(rev.wordId) }))
        .filter((x): x is { rev: typeof upcomingRevisions[number]; word: VocabWord } => !!x.word),
    [upcomingRevisions, wordMap],
  );

  function openLesson(lessonId: string, title: string, words: VocabWord[]) {
    haptic.select();
    setActiveLessonModal({
      lessonId,
      title,
      words,
      questions: vocab.getQuestionsForLesson(lessonId, words),
    });
  }

  function handleQuickWordOfDayAction(type: 'i_know' | 'need_revision') {
    const w = vocab.wordOfTheDay;
    if (!w) return;
    haptic.light();
    vocab.markWordSelfAssessment(w.id, type);
    setFeedbackToast(
      type === 'i_know'
        ? `"${w.word}" marked Mastered!`
        : `"${w.word}" added to Revision Queue!`,
    );
  }

  function handleStartRevisionSession() {
    if (dueRevisionWords.length === 0) return;
    haptic.select();
    setRevIdx(0);
    setRevRevealed(false);
    setRevSessionOpen(true);
  }

  function handleRateRevision(remembered: boolean) {
    const current = dueRevisionWords[revIdx];
    if (!current) {
      setRevSessionOpen(false);
      return;
    }
    if (remembered) haptic.success();
    else haptic.warning();

    vocab.advanceRevision(current.word.id, remembered);
    setRevRevealed(false);
    // Because dueRevisions filters out updated future-dated items immediately, clamp index cleanly.
    if (dueRevisionWords.length <= 1) {
      setRevSessionOpen(false);
      setFeedbackToast('Revision session completed!');
    } else if (revIdx >= dueRevisionWords.length - 1) {
      setRevIdx(0);
    }
  }

  if (vocab.isLoading) return <LoadingView />;
  if (vocab.isError) {
    return (
      <ErrorView
        message={vocab.error instanceof Error ? vocab.error.message : 'Unable to load vocabulary'}
        onRetry={vocab.refetch}
      />
    );
  }

  const wotd = vocab.wordOfTheDay;
  const wotdProgress = wotd ? vocab.wordProgressMap.get(wotd.id) : undefined;
  const currentRevItem = dueRevisionWords[revIdx];

  return (
    <View style={{ gap: space.md }}>
      {vocab.saveError ? <ErrorBanner message={vocab.saveError} /> : null}

      {feedbackToast ? (
        <View style={[styles.toastBanner, { backgroundColor: c.successBg, borderColor: c.success }]}>
          <Ionicons name="checkmark-circle" size={16} color={c.success} />
          <Text style={{ color: c.successFg, fontSize: 13.5, fontWeight: '700', flex: 1 }}>
            {feedbackToast}
          </Text>
        </View>
      ) : null}

      {/* Compact Stats Bar */}
      <View style={styles.statsRow}>
        <MiniStat label="Mastered" value={vocab.stats.mastered} color={c.success} bg={c.successBg} />
        <MiniStat
          label="Due Rev"
          value={vocab.stats.revisionDue}
          color={c.warning}
          bg={c.warningBg}
          onPress={() => setSubViewOverride({ key: viewKey, view: 'revision' })}
        />
        <MiniStat label="Accuracy" value={`${vocab.stats.accuracy}%`} color={c.info} bg={c.infoBg} />
        <MiniStat label="Streak" value={`${vocab.stats.streak}d`} color={c.primary} bg={c.primarySoft} />
      </View>

      {/* Word of the Day Spotlight */}
      {wotd ? (
        <Card tone="soft" style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Badge label="Word of the day" tone="primary" />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {wotdProgress?.status === 'mastered' ? (
                <Badge label="Mastered" tone="success" />
              ) : revisionWordIds.has(wotd.id) ? (
                <Badge label="In Revision" tone="warning" />
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Bookmark word of the day"
                onPress={() => {
                  haptic.select();
                  vocab.toggleWordBookmark(wotd.id);
                }}
                hitSlop={8}>
                <Ionicons
                  name={wotdProgress?.isBookmarked ? 'bookmark' : 'bookmark-outline'}
                  size={19}
                  color={wotdProgress?.isBookmarked ? c.warning : c.primary}
                />
              </Pressable>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
            <Text style={{ color: c.primary, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>
              {wotd.word}
            </Text>
            {wotd.pronunciation ? (
              <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '600' }}>
                {wotd.pronunciation}
              </Text>
            ) : null}
            {wotd.partOfSpeech ? <Badge label={wotd.partOfSpeech} tone="info" /> : null}
          </View>

          <AppText style={{ fontWeight: '600', lineHeight: 22 }}>{wotd.meaning}</AppText>

          <VocabWordImage word={wotd} height={160} />

          {wotd.example ? (
            <AppText variant="small" muted style={{ fontStyle: 'italic' }}>
              “{wotd.example}”
            </AppText>
          ) : null}

          {wotd.memoryTrick ? (
            <View style={[styles.tipPill, { backgroundColor: c.surface }]}>
              <Ionicons name="bulb-outline" size={14} color={c.warning} />
              <Text style={{ color: c.text, fontSize: 12.5, fontWeight: '600', flex: 1 }}>
                {wotd.memoryTrick}
              </Text>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => handleQuickWordOfDayAction('need_revision')}
              style={[styles.quickBtn, { backgroundColor: c.surface, borderColor: c.border, borderWidth: 1 }]}>
              <Ionicons name="repeat" size={14} color={c.warning} />
              <Text style={{ color: c.text, fontWeight: '700', fontSize: 12.5 }}>Need Revision</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => handleQuickWordOfDayAction('i_know')}
              style={[styles.quickBtn, { backgroundColor: c.primary }]}>
              <Ionicons name="checkmark" size={14} color={c.primaryText} />
              <Text style={{ color: c.primaryText, fontWeight: '700', fontSize: 12.5 }}>I Know This</Text>
            </Pressable>
          </View>

          {vocab.todayWords.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                openLesson('wordofday', "Today's Practice Batch", vocab.todayWords)
              }
              style={{ marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: c.primary, fontWeight: '800', fontSize: 13 }}>
                Practice today&rsquo;s {vocab.todayWords.length}-word guided batch →
              </Text>
            </Pressable>
          ) : null}
        </Card>
      ) : null}

      {/* Sub Navigation */}
      <Segmented
        options={[
          { key: 'lessons', label: 'Lessons' },
          { key: 'mywords', label: 'My Words' },
          {
            key: 'revision',
            label:
              vocab.stats.revisionDue > 0 ? `Revision (${vocab.stats.revisionDue})` : 'Revision',
          },
        ]}
        value={subView}
        onChange={(v) => {
          haptic.select();
          setSubViewOverride({ key: viewKey, view: v });
        }}
      />

      {subView === 'lessons' ? (
        <View style={{ gap: space.md }}>
          {vocab.categories.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -16 }}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 2 }}>
              <Chip
                label="All Categories"
                selected={selectedCategoryId === 'all'}
                onPress={() => setSelectedCategoryId('all')}
              />
              {vocab.categories.map((cat) => (
                <Chip
                  key={cat.id}
                  label={cat.name}
                  selected={selectedCategoryId === cat.id}
                  onPress={() =>
                    setSelectedCategoryId(selectedCategoryId === cat.id ? 'all' : cat.id)
                  }
                />
              ))}
            </ScrollView>
          ) : null}

          {filteredLessons.length === 0 ? (
            <EmptyView
              title="No published vocabulary lessons"
              message="Lessons added by your instructor will appear here."
            />
          ) : (
            filteredLessons.map((lesson) => {
              const words = vocab.getLessonWords(lesson.id);
              const lp = vocab.lessonProgressMap.get(lesson.id);
              const isDone = lp?.phase === 'completed';
              const categoryName = categoryNameMap.get(lesson.categoryId);
              return (
                <Card
                  key={lesson.id}
                  onPress={() => openLesson(lesson.id, lesson.name, words)}
                  style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                      {categoryName ? <Badge label={categoryName} tone="primary" /> : null}
                      <Badge
                        label={lesson.difficulty}
                        tone={
                          lesson.difficulty === 'easy'
                            ? 'success'
                            : lesson.difficulty === 'hard'
                              ? 'danger'
                              : 'warning'
                        }
                      />
                    </View>
                    {isDone ? (
                      <Badge label="Completed" tone="success" />
                    ) : lp ? (
                      <Badge label={lp.phase} tone="info" />
                    ) : null}
                  </View>

                  <AppText variant="heading">{lesson.name}</AppText>
                  {lesson.description ? (
                    <AppText variant="small" muted numberOfLines={2}>
                      {lesson.description}
                    </AppText>
                  ) : null}

                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 4,
                    }}>
                    <AppText variant="small" muted>
                      {words.length} words · ~{lesson.estimatedMinutes} min
                      {lp && lp.quizTotal > 0 ? ` · Quiz ${lp.quizScore}/${lp.quizTotal}` : ''}
                    </AppText>
                    <Text style={{ color: c.primary, fontWeight: '800', fontSize: 13 }}>
                      {isDone ? 'Review →' : lp ? 'Continue →' : 'Start Lesson →'}
                    </Text>
                  </View>
                </Card>
              );
            })
          )}
        </View>
      ) : subView === 'mywords' ? (
        <View style={{ gap: space.md }}>
          <View
            style={[
              styles.searchBox,
              { backgroundColor: c.surface, borderColor: c.border },
              elevation(c, 1),
            ]}>
            <Ionicons name="search" size={18} color={c.textMuted} />
            <TextInput
              value={wordSearch}
              onChangeText={setWordSearch}
              placeholder="Search words or meanings..."
              placeholderTextColor={c.textMuted}
              style={{ flex: 1, color: c.text, fontSize: 15, paddingVertical: 10 }}
            />
            {wordSearch ? (
              <Pressable onPress={() => setWordSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={c.textMuted} />
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -16 }}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 2 }}>
            {(
              [
                { key: 'all', label: `All (${vocab.activeWords.length})` },
                { key: 'mastered', label: `Mastered (${vocab.stats.mastered})` },
                { key: 'learning', label: `Learning (${vocab.stats.inProgress + vocab.stats.learned})` },
                { key: 'revision', label: `Revision (${vocab.revisions.length})` },
                { key: 'bookmarked', label: `Saved (${vocab.stats.bookmarked})` },
              ] as const
            ).map((f) => (
              <Chip
                key={f.key}
                label={f.label}
                selected={wordFilter === f.key}
                onPress={() => setWordFilter(f.key)}
              />
            ))}
          </ScrollView>

          {filteredMyWords.length === 0 ? (
            <EmptyView title="No matching words" message="Try switching filter tabs or clearing your search." />
          ) : (
            filteredMyWords.map((w) => {
              const wp = vocab.wordProgressMap.get(w.id);
              const statusTone =
                wp?.status === 'mastered'
                  ? 'success'
                  : wp?.status === 'learned'
                    ? 'info'
                    : wp?.status === 'learning'
                      ? 'warning'
                      : 'muted';
              return (
                <Card
                  key={w.id}
                  onPress={() => openLesson(`word_${w.id}`, w.word, [w])}
                  style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
                  <VocabWordImage word={w} width={60} height={60} borderRadius={radius.md} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' }}>
                        <AppText variant="heading">{w.word}</AppText>
                        {w.partOfSpeech ? <Badge label={w.partOfSpeech} tone="info" /> : null}
                        {wp?.status ? <Badge label={wp.status} tone={statusTone} /> : null}
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Toggle bookmark for ${w.word}`}
                        onPress={() => {
                          haptic.select();
                          vocab.toggleWordBookmark(w.id);
                        }}
                        hitSlop={8}>
                        <Ionicons
                          name={wp?.isBookmarked ? 'bookmark' : 'bookmark-outline'}
                          size={20}
                          color={wp?.isBookmarked ? c.warning : c.textMuted}
                        />
                      </Pressable>
                    </View>

                    <AppText variant="small">{w.meaning}</AppText>
                    {w.memoryTrick ? (
                      <AppText variant="small" muted>
                        Tip: {w.memoryTrick}
                      </AppText>
                    ) : null}
                  </View>
                </Card>
              );
            })
          )}
        </View>
      ) : (
        <View style={{ gap: space.md }}>
          <Card tone={dueRevisionWords.length > 0 ? 'hero' : 'surface'} style={{ gap: space.sm }}>
            <Badge
              label="Spaced Repetition"
              tone={dueRevisionWords.length > 0 ? 'warning' : 'success'}
            />
            <Text
              style={{
                color: dueRevisionWords.length > 0 ? c.heroText : c.text,
                fontSize: 21,
                fontWeight: '800',
              }}>
              {dueRevisionWords.length > 0
                ? `${dueRevisionWords.length} word${dueRevisionWords.length === 1 ? '' : 's'} due for review`
                : 'All caught up for today!'}
            </Text>
            <Text
              style={{
                color: dueRevisionWords.length > 0 ? c.heroMuted : c.textMuted,
                fontSize: 13.5,
              }}>
              {dueRevisionWords.length > 0
                ? 'Active recall strengthens long-term retention across 1, 3, 7, 15, and 30-day intervals.'
                : `${upcomingRevisionWords.length} word${upcomingRevisionWords.length === 1 ? '' : 's'} scheduled for upcoming days.`}
            </Text>
            {dueRevisionWords.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={handleStartRevisionSession}
                style={({ pressed }) => [
                  styles.heroCta,
                  { backgroundColor: c.heroText, opacity: pressed ? 0.9 : 1, marginTop: 4 },
                ]}>
                <Ionicons name="refresh" size={16} color={c.hero} />
                <Text style={{ color: c.hero, fontWeight: '800', fontSize: 14 }}>
                  Start Revision Flashcards
                </Text>
              </Pressable>
            ) : null}
          </Card>

          {dueRevisionWords.length > 0 ? (
            <View style={{ gap: space.sm }}>
              <AppText variant="heading">Due today</AppText>
              {dueRevisionWords.map(({ rev, word }) => (
                <Card
                  key={rev.id}
                  onPress={handleStartRevisionSession}
                  style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <AppText style={{ fontWeight: '800', fontSize: 16 }}>{word.word}</AppText>
                    <Badge label={`Level ${rev.level}/5`} tone="warning" />
                  </View>
                  <AppText variant="small" muted>
                    {word.meaning}
                  </AppText>
                </Card>
              ))}
            </View>
          ) : null}

          {upcomingRevisionWords.length > 0 ? (
            <View style={{ gap: space.sm }}>
              <AppText variant="heading">Upcoming schedule</AppText>
              {upcomingRevisionWords.map(({ rev, word }) => (
                <Card key={rev.id} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <AppText style={{ fontWeight: '800', fontSize: 16 }}>{word.word}</AppText>
                    <Badge label={rev.nextRevisionDate} tone="info" />
                  </View>
                  <AppText variant="small" muted numberOfLines={2}>
                    {word.meaning}
                  </AppText>
                </Card>
              ))}
            </View>
          ) : dueRevisionWords.length === 0 ? (
            <EmptyView
              title="No words in revision queue"
              message='Tap "Need Revision" on any word card to schedule spaced-repetition practice.'
            />
          ) : null}
        </View>
      )}

      {/* Guided Lesson Flow Modal */}
      {effectiveLessonModal ? (
        <VocabLessonModal
          visible={!!effectiveLessonModal}
          lessonId={effectiveLessonModal.lessonId}
          lessonTitle={effectiveLessonModal.title}
          words={effectiveLessonModal.words}
          questions={effectiveLessonModal.questions}
          isBookmarked={(wId) => !!vocab.wordProgressMap.get(wId)?.isBookmarked}
          onToggleBookmark={vocab.toggleWordBookmark}
          onSelfAssess={vocab.markWordSelfAssessment}
          onPhaseChange={vocab.updateLessonPhase}
          onRecordQuizAttempt={vocab.recordQuizAttempt}
          onApplyDecision={vocab.applyDecisionLogic}
          onClose={() => {
            setActiveLessonModal(null);
            if (initialView === 'wordofday') setDismissedWotd(true);
          }}
        />
      ) : null}

      {/* Spaced-Repetition Session Modal */}
      <Modal
        visible={revSessionOpen && !!currentRevItem}
        animationType="slide"
        onRequestClose={() => setRevSessionOpen(false)}>
        {currentRevItem ? (
          <View
            style={{
              flex: 1,
              backgroundColor: c.bg,
              paddingTop: insets.top + 8,
              paddingBottom: Math.max(insets.bottom, 16),
              paddingHorizontal: space.lg,
              justifyContent: 'space-between',
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close revision session"
                onPress={() => setRevSessionOpen(false)}
                style={[styles.closeBtn, { backgroundColor: c.surface }]}>
                <Ionicons name="close" size={20} color={c.text} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <AppText variant="heading">Spaced Revision</AppText>
                <AppText variant="small" muted>
                  {dueRevisionWords.length} remaining · Level {currentRevItem.rev.level}/5
                </AppText>
              </View>
            </View>

            <Card
              onPress={() => {
                haptic.select();
                setRevRevealed(!revRevealed);
              }}
              style={{ minHeight: 280, justifyContent: 'center', alignItems: 'center', gap: space.md, padding: space.xl }}>
              <Badge
                label={revRevealed ? 'Definition' : `Review Card (${dueRevisionWords.length} left)`}
                tone={revRevealed ? 'success' : 'warning'}
              />
              <VocabWordImage word={currentRevItem.word} height={140} />
              <Text style={{ color: c.text, fontSize: 30, fontWeight: '800', textAlign: 'center' }}>
                {currentRevItem.word.word}
              </Text>
              {currentRevItem.word.pronunciation ? (
                <Text style={{ color: c.textMuted, fontSize: 13 }}>
                  {currentRevItem.word.pronunciation}
                </Text>
              ) : null}
              {revRevealed ? (
                <View style={{ gap: 8, alignItems: 'center', marginTop: space.sm }}>
                  <AppText style={{ textAlign: 'center', fontSize: 17, fontWeight: '600' }}>
                    {currentRevItem.word.meaning}
                  </AppText>
                  {currentRevItem.word.example ? (
                    <AppText variant="small" muted style={{ textAlign: 'center', fontStyle: 'italic' }}>
                      “{currentRevItem.word.example}”
                    </AppText>
                  ) : null}
                  {currentRevItem.word.memoryTrick ? (
                    <Text style={{ color: c.primary, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
                      Tip: {currentRevItem.word.memoryTrick}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <AppText variant="small" muted style={{ marginTop: space.sm }}>
                  Tap to reveal meaning
                </AppText>
              )}
            </Card>

            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {!revRevealed ? (
                <View style={{ flex: 1 }}>
                  <Button title="Reveal Answer" onPress={() => setRevRevealed(true)} />
                </View>
              ) : (
                <>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Still Learning"
                      variant="outline"
                      onPress={() => handleRateRevision(false)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button title="Got It!" onPress={() => handleRateRevision(true)} />
                  </View>
                </>
              )}
            </View>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

function MiniStat({
  label,
  value,
  color,
  bg,
  onPress,
}: {
  label: string;
  value: string | number;
  color: string;
  bg: string;
  onPress?: () => void;
}) {
  const c = useColors();
  const content = (
    <View style={[styles.statTile, { backgroundColor: c.surface }, elevation(c, 1)]}>
      <View style={[styles.statDot, { backgroundColor: bg }]}>
        <Text style={{ color, fontWeight: '800', fontSize: 14 }}>{value}</Text>
      </View>
      <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: '700' }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
  if (!onPress) return <View style={{ flex: 1 }}>{content}</View>;
  return (
    <Pressable style={{ flex: 1 }} onPress={onPress}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statTile: {
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 4,
  },
  statDot: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  tipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: space.sm,
    borderRadius: radius.md,
  },
  quickBtn: {
    flex: 1,
    minHeight: TOUCH,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    minHeight: TOUCH + 4,
  },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: radius.lg,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
