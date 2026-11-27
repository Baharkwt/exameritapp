import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type {
  LessonPhase,
  QuizQuestion,
  SelfAssessment,
  VocabWord,
  WordStatus,
} from '@/api/englishHub';
import { AppText, Badge, Button, Card, ProgressBar, ProgressRing } from '@/components/ui/kit';
import { VocabWordImage } from '@/features/english-hub/VocabWordImage';
import { resolveMediaUrl } from '@/lib/config';
import { haptic } from '@/lib/haptics';
import { elevation, radius, space, TOUCH, useColors } from '@/theme';

interface VocabLessonModalProps {
  visible: boolean;
  lessonId: string;
  lessonTitle: string;
  words: VocabWord[];
  questions: QuizQuestion[];
  isBookmarked: (wordId: string) => boolean;
  onToggleBookmark: (wordId: string) => void;
  onSelfAssess: (wordId: string, assessment: SelfAssessment, lessonId?: string) => void;
  onPhaseChange: (
    lessonId: string,
    phase: LessonPhase,
    scores?: { flashcards?: number; spelling?: number; quiz?: number; quizTotal?: number },
  ) => void;
  onRecordQuizAttempt: (
    wordId: string,
    selected: string,
    correct: string,
    lessonId?: string,
  ) => boolean;
  onApplyDecision: (
    wordId: string,
    selfAssessment: SelfAssessment,
    quizCorrect: boolean,
  ) => WordStatus;
  onClose: () => void;
}

type Stage = 'learning' | 'flashcards' | 'spelling' | 'quiz' | 'result';

interface QuizAnswerRecord {
  question: QuizQuestion;
  selected: string;
  isCorrect: boolean;
}

export function VocabLessonModal(props: VocabLessonModalProps) {
  const { visible, lessonId, onClose } = props;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {visible ? <VocabLessonSession key={lessonId} {...props} /> : null}
    </Modal>
  );
}

function VocabLessonSession({
  lessonId,
  lessonTitle,
  words,
  questions,
  isBookmarked,
  onToggleBookmark,
  onSelfAssess,
  onPhaseChange,
  onRecordQuizAttempt,
  onApplyDecision,
  onClose,
}: VocabLessonModalProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();

  const [stage, setStage] = useState<Stage>('learning');
  const [wordIdx, setWordIdx] = useState(0);
  const [assessments, setAssessments] = useState<Record<string, SelfAssessment>>({});

  // Flashcards state
  const [fcIdx, setFcIdx] = useState(0);
  const [fcFlipped, setFcFlipped] = useState(false);
  const [fcScore, setFcScore] = useState(0);

  // Spelling state
  const [spIdx, setSpIdx] = useState(0);
  const [spInput, setSpInput] = useState('');
  const [spChecked, setSpChecked] = useState(false);
  const [spCorrect, setSpCorrect] = useState(false);
  const [spScore, setSpScore] = useState(0);

  // Quiz state
  const [qIdx, setQIdx] = useState(0);
  const [qSelected, setQSelected] = useState<string | null>(null);
  const [qRecords, setQRecords] = useState<QuizAnswerRecord[]>([]);
  const [outcomes, setOutcomes] = useState<{ word: VocabWord; status: WordStatus }[]>([]);

  useEffect(() => {
    onPhaseChange(lessonId, 'learning');
  }, [lessonId, onPhaseChange]);

  const activeWord = words[wordIdx];
  const fcWord = words[fcIdx];
  const spWord = words[spIdx];
  const activeQ = questions[qIdx];

  const quizCorrectCount = useMemo(
    () => qRecords.filter((r) => r.isCorrect).length,
    [qRecords],
  );

  function goToStage(next: Stage) {
    setStage(next);
    if (next === 'flashcards') {
      setFcIdx(0);
      setFcFlipped(false);
      setFcScore(0);
      onPhaseChange(lessonId, 'flashcards');
    } else if (next === 'spelling') {
      setSpIdx(0);
      setSpInput('');
      setSpChecked(false);
      setSpCorrect(false);
      setSpScore(0);
      onPhaseChange(lessonId, 'spelling', { flashcards: fcScore });
    } else if (next === 'quiz') {
      setQIdx(0);
      setQSelected(null);
      setQRecords([]);
      onPhaseChange(lessonId, 'quiz', { flashcards: fcScore, spelling: spScore });
    }
  }

  function handleAssess(type: 'i_know' | 'need_revision') {
    if (!activeWord) return;
    haptic.light();
    setAssessments((prev) => ({ ...prev, [activeWord.id]: type }));
    onSelfAssess(activeWord.id, type, lessonId);
    if (wordIdx + 1 < words.length) {
      setWordIdx(wordIdx + 1);
    } else {
      goToStage('flashcards');
    }
  }

  function handleFlashcardRate(knewIt: boolean) {
    haptic.light();
    const nextScore = knewIt ? fcScore + 1 : fcScore;
    setFcScore(nextScore);
    if (fcIdx + 1 < words.length) {
      setFcIdx(fcIdx + 1);
      setFcFlipped(false);
    } else {
      setStage('spelling');
      setSpIdx(0);
      setSpInput('');
      setSpChecked(false);
      setSpCorrect(false);
      setSpScore(0);
      onPhaseChange(lessonId, 'spelling', { flashcards: nextScore });
    }
  }

  function handleCheckSpelling() {
    if (!spWord || spChecked) return;
    const isOk = spInput.trim().toLowerCase() === spWord.word.trim().toLowerCase();
    if (isOk) {
      haptic.success();
      setSpScore((s) => s + 1);
    } else {
      haptic.warning();
    }
    setSpCorrect(isOk);
    setSpChecked(true);
  }

  function handleNextSpelling() {
    if (spIdx + 1 < words.length) {
      setSpIdx(spIdx + 1);
      setSpInput('');
      setSpChecked(false);
      setSpCorrect(false);
    } else {
      goToStage('quiz');
    }
  }

  function finishQuiz(finalRecords: QuizAnswerRecord[]) {
    const score = finalRecords.filter((r) => r.isCorrect).length;
    const total = questions.length;
    const nextOutcomes = words.map((w) => {
      const rec = finalRecords.find(
        (r) =>
          r.question.wordId === w.id ||
          r.question.correctAnswer.toLowerCase() === w.meaning.toLowerCase(),
      );
      const quizOk = rec ? rec.isCorrect : false;
      const sa = assessments[w.id] ?? null;
      const status = onApplyDecision(w.id, sa, quizOk);
      return { word: w, status };
    });
    setOutcomes(nextOutcomes);
    onPhaseChange(lessonId, 'completed', {
      flashcards: fcScore,
      spelling: spScore,
      quiz: score,
      quizTotal: total,
    });
    setStage('result');
  }

  function handleSelectOption(opt: string) {
    if (!activeQ || qSelected) return;
    setQSelected(opt);
    const wordId = activeQ.wordId || words[qIdx % Math.max(words.length, 1)]?.id;
    const isCorrect = wordId
      ? onRecordQuizAttempt(wordId, opt, activeQ.correctAnswer, lessonId)
      : opt === activeQ.correctAnswer;
    if (isCorrect) haptic.success();
    else haptic.warning();

    const record: QuizAnswerRecord = { question: activeQ, selected: opt, isCorrect };
    setQRecords((prev) => [...prev, record]);
  }

  function handleAdvanceQuiz() {
    if (qIdx + 1 < questions.length) {
      setQIdx(qIdx + 1);
      setQSelected(null);
    } else {
      finishQuiz(qRecords);
    }
  }

  const stageLabel: Record<Stage, string> = {
    learning: '1 · Learn Words',
    flashcards: '2 · Flashcards',
    spelling: '3 · Spelling',
    quiz: '4 · MCQ Quiz',
    result: 'Lesson Summary',
  };

  return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: c.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Top bar */}
        <View
          style={[
            styles.topBar,
            {
              paddingTop: insets.top + 8,
              backgroundColor: c.surface,
              borderBottomColor: c.border,
            },
          ]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close lesson"
            onPress={onClose}
            style={[styles.iconBtn, { backgroundColor: c.bg }]}>
            <Ionicons name="close" size={20} color={c.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }} numberOfLines={1}>
              {lessonTitle}
            </Text>
            <Text style={{ color: c.primary, fontWeight: '700', fontSize: 12 }}>
              {stageLabel[stage]}
            </Text>
          </View>
          {stage !== 'result' ? (
            <View style={styles.stagePills}>
              {(['learning', 'flashcards', 'spelling', 'quiz'] as const).map((s, i) => (
                <Pressable
                  key={s}
                  accessibilityRole="button"
                  accessibilityLabel={`Switch to ${stageLabel[s]}`}
                  onPress={() => goToStage(s)}
                  style={[
                    styles.stepDot,
                    {
                      backgroundColor: stage === s ? c.primary : c.skeleton,
                    },
                  ]}>
                  <Text
                    style={{
                      color: stage === s ? c.primaryText : c.textMuted,
                      fontSize: 11,
                      fontWeight: '800',
                    }}>
                    {i + 1}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {words.length === 0 ? (
          <View style={styles.center}>
            <AppText variant="heading">No words in this lesson yet</AppText>
            <AppText muted style={{ marginTop: 6, marginBottom: space.lg, textAlign: 'center' }}>
              Check back soon after your instructor adds words to this lesson.
            </AppText>
            <Button title="Go back" onPress={onClose} />
          </View>
        ) : stage === 'learning' && activeWord ? (
          <>
            {/* Word carousel pills */}
            <View style={{ backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: space.lg, paddingVertical: space.sm, gap: 8 }}>
                {words.map((w, idx) => {
                  const selected = idx === wordIdx;
                  const sa = assessments[w.id];
                  return (
                    <Pressable
                      key={w.id}
                      onPress={() => setWordIdx(idx)}
                      style={[
                        styles.wordTab,
                        {
                          backgroundColor: selected
                            ? c.primary
                            : sa === 'i_know'
                              ? c.successBg
                              : sa === 'need_revision'
                                ? c.warningBg
                                : c.bg,
                        },
                      ]}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: selected
                            ? c.primaryText
                            : sa === 'i_know'
                              ? c.successFg
                              : sa === 'need_revision'
                                ? c.warningFg
                                : c.textMuted,
                        }}>
                        {idx + 1}. {w.word}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <ScrollView
              contentContainerStyle={{
                padding: space.lg,
                paddingBottom: 120,
                gap: space.md,
              }}>
              <ProgressBar value={(wordIdx + 1) / words.length} height={6} />

              <Card style={{ gap: space.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.sm }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <Text style={{ color: c.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.6 }}>
                        {activeWord.word}
                      </Text>
                      {activeWord.partOfSpeech ? (
                        <Badge label={activeWord.partOfSpeech} tone="info" />
                      ) : null}
                      <Badge
                        label={activeWord.difficulty}
                        tone={
                          activeWord.difficulty === 'easy'
                            ? 'success'
                            : activeWord.difficulty === 'hard'
                              ? 'danger'
                              : 'warning'
                        }
                      />
                    </View>
                    {activeWord.pronunciation ? (
                      <Text style={{ color: c.textMuted, fontSize: 14, marginTop: 4, fontWeight: '600' }}>
                        {activeWord.pronunciation}
                      </Text>
                    ) : null}
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {resolveMediaUrl(activeWord.audioUrl) ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Play pronunciation audio"
                        onPress={() => WebBrowser.openBrowserAsync(resolveMediaUrl(activeWord.audioUrl)!)}
                        style={[styles.smallActionBtn, { backgroundColor: c.primarySoft }]}>
                        <Ionicons name="volume-high" size={18} color={c.primary} />
                      </Pressable>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Bookmark word"
                      onPress={() => {
                        haptic.select();
                        onToggleBookmark(activeWord.id);
                      }}
                      style={[
                        styles.smallActionBtn,
                        { backgroundColor: isBookmarked(activeWord.id) ? c.warningBg : c.bg },
                      ]}>
                      <Ionicons
                        name={isBookmarked(activeWord.id) ? 'bookmark' : 'bookmark-outline'}
                        size={18}
                        color={isBookmarked(activeWord.id) ? c.warning : c.textMuted}
                      />
                    </Pressable>
                  </View>
                </View>

                <VocabWordImage word={activeWord} height={180} />

                <View style={{ gap: 4 }}>
                  <Text style={[styles.microLabel, { color: c.textMuted }]}>MEANING</Text>
                  <AppText style={{ fontSize: 17, fontWeight: '600', lineHeight: 24 }}>
                    {activeWord.meaning}
                  </AppText>
                  {activeWord.detailedExplanation ? (
                    <AppText variant="small" muted style={{ marginTop: 4 }}>
                      {activeWord.detailedExplanation}
                    </AppText>
                  ) : null}
                </View>

                {activeWord.example || activeWord.example2 ? (
                  <View style={[styles.subCard, { backgroundColor: c.bg }]}>
                    <Text style={[styles.microLabel, { color: c.textMuted }]}>EXAMPLES</Text>
                    {activeWord.example ? (
                      <AppText variant="small" style={{ lineHeight: 20 }}>
                        • “{activeWord.example}”
                      </AppText>
                    ) : null}
                    {activeWord.example2 ? (
                      <AppText variant="small" style={{ lineHeight: 20, marginTop: 4 }}>
                        • “{activeWord.example2}”
                      </AppText>
                    ) : null}
                  </View>
                ) : null}

                {activeWord.memoryTrick ? (
                  <View style={[styles.subCard, { backgroundColor: c.warningBg }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Ionicons name="bulb" size={15} color={c.warning} />
                      <Text style={[styles.microLabel, { color: c.warningFg, marginBottom: 0 }]}>
                        MEMORY TRICK
                      </Text>
                    </View>
                    <Text style={{ color: c.warningFg, fontSize: 13.5, lineHeight: 20, fontWeight: '600' }}>
                      {activeWord.memoryTrick}
                    </Text>
                  </View>
                ) : null}

                {(activeWord.synonyms?.length ?? 0) > 0 || (activeWord.antonyms?.length ?? 0) > 0 ? (
                  <View style={{ gap: space.sm }}>
                    {(activeWord.synonyms?.length ?? 0) > 0 ? (
                      <View>
                        <Text style={[styles.microLabel, { color: c.textMuted }]}>SYNONYMS</Text>
                        <View style={styles.tagWrap}>
                          {activeWord.synonyms!.map((s) => (
                            <Badge key={`syn-${s}`} label={s} tone="success" />
                          ))}
                        </View>
                      </View>
                    ) : null}
                    {(activeWord.antonyms?.length ?? 0) > 0 ? (
                      <View>
                        <Text style={[styles.microLabel, { color: c.textMuted }]}>ANTONYMS</Text>
                        <View style={styles.tagWrap}>
                          {activeWord.antonyms!.map((a) => (
                            <Badge key={`ant-${a}`} label={a} tone="danger" />
                          ))}
                        </View>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {(activeWord.wordFamily?.length ?? 0) > 0 ? (
                  <View>
                    <Text style={[styles.microLabel, { color: c.textMuted }]}>WORD FAMILY</Text>
                    <View style={styles.tagWrap}>
                      {activeWord.wordFamily!.map((wf, i) => (
                        <Badge key={`${wf.word}-${i}`} label={`${wf.word} (${wf.pos})`} tone="primary" />
                      ))}
                    </View>
                  </View>
                ) : null}
              </Card>
            </ScrollView>

            <View
              style={[
                styles.bottomBar,
                {
                  paddingBottom: Math.max(insets.bottom, 12),
                  backgroundColor: c.surface,
                  borderTopColor: c.border,
                },
              ]}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Need Revision"
                  variant="outline"
                  onPress={() => handleAssess('need_revision')}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title={wordIdx + 1 === words.length ? 'Know · Flashcards' : 'I Know This'}
                  onPress={() => handleAssess('i_know')}
                />
              </View>
            </View>
          </>
        ) : stage === 'flashcards' && fcWord ? (
          <View style={{ flex: 1, padding: space.lg, justifyContent: 'space-between', paddingBottom: Math.max(insets.bottom, 16) }}>
            <View style={{ gap: space.sm }}>
              <ProgressBar value={(fcIdx + 1) / words.length} height={6} />
              <AppText variant="small" muted>
                Card {fcIdx + 1} of {words.length} · Tap card to flip
              </AppText>
            </View>

            <Card
              onPress={() => {
                haptic.select();
                setFcFlipped(!fcFlipped);
              }}
              style={{ minHeight: 280, justifyContent: 'center', alignItems: 'center', gap: space.md, padding: space.xl }}>
              <Badge label={fcFlipped ? 'Meaning & Tip' : 'Word'} tone={fcFlipped ? 'success' : 'primary'} />
              <VocabWordImage word={fcWord} height={130} />
              <Text style={{ color: c.text, fontSize: 30, fontWeight: '800', textAlign: 'center' }}>
                {fcWord.word}
              </Text>
              {fcWord.pronunciation ? (
                <Text style={{ color: c.textMuted, fontSize: 13 }}>{fcWord.pronunciation}</Text>
              ) : null}
              {fcFlipped ? (
                <View style={{ marginTop: space.sm, alignItems: 'center', gap: 8 }}>
                  <AppText style={{ textAlign: 'center', fontSize: 17, fontWeight: '600' }}>
                    {fcWord.meaning}
                  </AppText>
                  {fcWord.memoryTrick ? (
                    <Text style={{ color: c.primary, textAlign: 'center', fontSize: 13, fontWeight: '600' }}>
                      Tip: {fcWord.memoryTrick}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <AppText variant="small" muted style={{ marginTop: space.sm }}>
                  Tap card to reveal definition
                </AppText>
              )}
            </Card>

            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {!fcFlipped ? (
                <View style={{ flex: 1 }}>
                  <Button title="Reveal Meaning" onPress={() => setFcFlipped(true)} />
                </View>
              ) : (
                <>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Still Learning"
                      variant="outline"
                      onPress={() => handleFlashcardRate(false)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button title="Got It!" onPress={() => handleFlashcardRate(true)} />
                  </View>
                </>
              )}
            </View>
          </View>
        ) : stage === 'spelling' && spWord ? (
          <View style={{ flex: 1, padding: space.lg, justifyContent: 'space-between', paddingBottom: Math.max(insets.bottom, 16) }}>
            <View style={{ gap: space.sm }}>
              <ProgressBar value={(spIdx + 1) / words.length} height={6} />
              <AppText variant="small" muted>
                Spelling {spIdx + 1} of {words.length}
              </AppText>
            </View>

            <Card style={{ gap: space.md }}>
              <Badge label="Spell the word" tone="info" />
              <AppText style={{ fontSize: 18, fontWeight: '700', lineHeight: 26 }}>
                {spWord.meaning}
              </AppText>
              <VocabWordImage word={spWord} height={135} />
              {spWord.partOfSpeech ? (
                <AppText variant="small" muted>
                  Part of speech: {spWord.partOfSpeech} · Starts with &ldquo;{spWord.word.slice(0, 1).toUpperCase()}&rdquo; ({spWord.word.length} letters)
                </AppText>
              ) : (
                <AppText variant="small" muted>
                  Starts with &ldquo;{spWord.word.slice(0, 1).toUpperCase()}&rdquo; ({spWord.word.length} letters)
                </AppText>
              )}

              <TextInput
                value={spInput}
                onChangeText={(t) => {
                  if (!spChecked) setSpInput(t);
                }}
                editable={!spChecked}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Type the spelling here..."
                placeholderTextColor={c.textMuted}
                onSubmitEditing={handleCheckSpelling}
                style={[
                  styles.spellingInput,
                  {
                    backgroundColor: spChecked
                      ? spCorrect
                        ? c.successBg
                        : c.dangerBg
                      : c.inputBg,
                    color: spChecked
                      ? spCorrect
                        ? c.successFg
                        : c.dangerFg
                      : c.text,
                    borderColor: spChecked
                      ? spCorrect
                        ? c.success
                        : c.danger
                      : c.border,
                  },
                ]}
              />

              {spChecked ? (
                <View style={[styles.subCard, { backgroundColor: spCorrect ? c.successBg : c.dangerBg }]}>
                  <Text
                    style={{
                      color: spCorrect ? c.successFg : c.dangerFg,
                      fontWeight: '800',
                      fontSize: 14,
                    }}>
                    {spCorrect
                      ? 'Exact match! Well spelled.'
                      : `Correct spelling: ${spWord.word}`}
                  </Text>
                </View>
              ) : null}
            </Card>

            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {!spChecked ? (
                <>
                  <View style={{ flex: 1 }}>
                    <Button title="Skip to Quiz" variant="outline" onPress={() => goToStage('quiz')} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Check Spelling"
                      disabled={!spInput.trim()}
                      onPress={handleCheckSpelling}
                    />
                  </View>
                </>
              ) : (
                <View style={{ flex: 1 }}>
                  <Button
                    title={spIdx + 1 === words.length ? 'Start Quiz' : 'Next Word'}
                    onPress={handleNextSpelling}
                  />
                </View>
              )}
            </View>
          </View>
        ) : stage === 'quiz' && activeQ ? (
          <View style={{ flex: 1 }}>
            <ScrollView
              contentContainerStyle={{
                padding: space.lg,
                paddingBottom: 110,
                gap: space.md,
              }}>
              <ProgressBar value={(qIdx + 1) / questions.length} height={6} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Badge label={`Question ${qIdx + 1} / ${questions.length}`} tone="primary" />
                <Badge label={activeQ.type.replace('_', ' ')} tone="muted" />
              </View>

              <Card tone="hero" style={{ gap: space.sm }}>
                <VocabWordImage
                  imageUrl={activeQ.imageUrl}
                  word={words.find((w) => w.id === activeQ.wordId)}
                  fallbackToTheme={activeQ.type === 'image'}
                  height={150}
                />
                {resolveMediaUrl(activeQ.audioUrl) ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Play question audio"
                    onPress={() => WebBrowser.openBrowserAsync(resolveMediaUrl(activeQ.audioUrl)!)}
                    style={[
                      styles.smallActionBtn,
                      { backgroundColor: c.heroSoft, alignSelf: 'flex-start' },
                    ]}>
                    <Ionicons name="volume-high" size={18} color={c.heroText} />
                  </Pressable>
                ) : null}
                <Text style={{ color: c.heroMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 }}>
                  {activeQ.type === 'synonym'
                    ? 'FIND THE SYNONYM'
                    : activeQ.type === 'antonym'
                      ? 'FIND THE ANTONYM'
                      : 'CHOOSE THE CORRECT ANSWER'}
                </Text>
                <Text style={{ color: c.heroText, fontSize: 19, fontWeight: '800', lineHeight: 26 }}>
                  {activeQ.question}
                </Text>
              </Card>

              <View style={{ gap: space.sm }}>
                {activeQ.options.map((opt, idx) => {
                  const isSel = qSelected === opt;
                  const isCorrect = opt === activeQ.correctAnswer;
                  const answered = qSelected !== null;
                  const borderColor = answered
                    ? isCorrect
                      ? c.success
                      : isSel
                        ? c.danger
                        : c.border
                    : c.border;
                  const bgColor = answered
                    ? isCorrect
                      ? c.successBg
                      : isSel
                        ? c.dangerBg
                        : c.surface
                    : c.surface;
                  return (
                    <Pressable
                      key={`${opt}-${idx}`}
                      accessibilityRole="button"
                      disabled={answered}
                      onPress={() => handleSelectOption(opt)}
                      style={[
                        styles.optionBtn,
                        { backgroundColor: bgColor, borderColor },
                        elevation(c, 1),
                      ]}>
                      <View
                        style={[
                          styles.optionBadge,
                          {
                            backgroundColor: answered && isCorrect
                              ? c.success
                              : answered && isSel
                                ? c.danger
                                : c.primarySoft,
                          },
                        ]}>
                        <Text
                          style={{
                            color: answered && (isCorrect || isSel) ? '#FFFFFF' : c.primary,
                            fontWeight: '800',
                            fontSize: 12,
                          }}>
                          {String.fromCharCode(65 + idx)}
                        </Text>
                      </View>
                      <Text style={{ flex: 1, color: c.text, fontSize: 15, fontWeight: '600', lineHeight: 21 }}>
                        {opt}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {qSelected && activeQ.explanation ? (
                <Card tone="soft" style={{ gap: 4 }}>
                  <Text style={{ color: c.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>
                    EXPLANATION
                  </Text>
                  <AppText variant="small">{activeQ.explanation}</AppText>
                </Card>
              ) : null}
            </ScrollView>

            {qSelected ? (
              <View
                style={[
                  styles.bottomBar,
                  {
                    paddingBottom: Math.max(insets.bottom, 12),
                    backgroundColor: c.surface,
                    borderTopColor: c.border,
                  },
                ]}>
                <View style={{ flex: 1 }}>
                  <Button
                    title={qIdx + 1 === questions.length ? 'See Results' : 'Next Question'}
                    onPress={handleAdvanceQuiz}
                  />
                </View>
              </View>
            ) : null}
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{
              padding: space.lg,
              paddingBottom: Math.max(insets.bottom, 24),
              gap: space.md,
            }}>
            <Card tone="hero" style={{ alignItems: 'center', gap: space.md }}>
              <ProgressRing
                value={questions.length > 0 ? quizCorrectCount / questions.length : 1}
                size={104}
                stroke={10}
                color={c.heroText}
                track={c.heroSoft}>
                <Text style={{ color: c.heroText, fontSize: 22, fontWeight: '800' }}>
                  {questions.length > 0
                    ? `${Math.round((quizCorrectCount / questions.length) * 100)}%`
                    : '100%'}
                </Text>
              </ProgressRing>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Text style={{ color: c.heroText, fontSize: 22, fontWeight: '800' }}>
                  Lesson Complete!
                </Text>
                <Text style={{ color: c.heroMuted, fontSize: 13.5, fontWeight: '600' }}>
                  Quiz {quizCorrectCount}/{questions.length} · Flashcards {fcScore}/{words.length} · Spelling {spScore}/{words.length}
                </Text>
              </View>
            </Card>

            <Card style={{ gap: space.sm }}>
              <AppText variant="heading">Word Mastery Decisions</AppText>
              {outcomes.map(({ word, status }) => (
                <View
                  key={word.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: c.border,
                  }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <AppText style={{ fontWeight: '700' }}>{word.word}</AppText>
                    <AppText variant="small" muted numberOfLines={1}>
                      {word.meaning}
                    </AppText>
                  </View>
                  <Badge
                    label={status === 'mastered' ? 'Mastered' : status === 'learned' ? 'Learned · Revision' : 'Needs Revision'}
                    tone={status === 'mastered' ? 'success' : status === 'learned' ? 'info' : 'warning'}
                  />
                </View>
              ))}
            </Card>

            <Button title="Back to English Hub" onPress={onClose} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stagePills: {
    flexDirection: 'row',
    gap: 4,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordTab: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  microLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  subCard: {
    padding: space.md,
    borderRadius: radius.md,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: 1,
  },
  spellingInput: {
    minHeight: TOUCH + 10,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  optionBtn: {
    minHeight: TOUCH + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  optionBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
});
