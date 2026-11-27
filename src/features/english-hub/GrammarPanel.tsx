import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
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

import type { GrammarTopicItem } from '@/api/englishHub';
import {
  AppText,
  Badge,
  Button,
  Card,
  EmptyView,
  ErrorBanner,
  ErrorView,
  LoadingView,
  ProgressBar,
  ProgressRing,
  SectionHeader,
} from '@/components/ui/kit';
import { useGrammarHub } from '@/features/english-hub/useEnglishHub';
import { haptic } from '@/lib/haptics';
import { elevation, radius, space, TOUCH, useColors } from '@/theme';

const DIFFICULTY_META: Record<1 | 2 | 3, { label: string; tone: 'success' | 'info' | 'warning' }> = {
  1: { label: 'Foundation', tone: 'success' },
  2: { label: 'Intermediate', tone: 'info' },
  3: { label: 'Exam Ready', tone: 'warning' },
};

export function GrammarPanel() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const {
    levels,
    topics,
    completedTopics,
    recentlyViewed,
    quizResults,
    isLoading,
    isError,
    error,
    saveError,
    refetch,
    markViewed,
    toggleCompleted,
    submitQuizResult,
  } = useGrammarHub();

  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [lessonTopic, setLessonTopic] = useState<{ topic: GrammarTopicItem; levelTitle: string } | null>(null);
  const [revealedPractice, setRevealedPractice] = useState<Record<number, boolean>>({});

  // Topic Quiz modal state
  const [quizTopic, setQuizTopic] = useState<GrammarTopicItem | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const levelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of levels) m.set(l.id, l.title);
    return m;
  }, [levels]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    return levels
      .map((level) => {
        const items = topics.filter((t) => {
          if (t.levelId !== level.id) return false;
          if (!q) return true;
          return (
            t.title.toLowerCase().includes(q) ||
            t.subtitle.toLowerCase().includes(q) ||
            t.definition.toLowerCase().includes(q) ||
            level.title.toLowerCase().includes(q)
          );
        });
        return { level, items };
      })
      .filter((g) => g.items.length > 0);
  }, [levels, topics, search]);

  const completedCount = useMemo(
    () => topics.filter((t) => completedTopics.has(t.id)).length,
    [topics, completedTopics],
  );
  const progressRatio = topics.length > 0 ? completedCount / topics.length : 0;

  const earnedXp = useMemo(
    () => topics.filter((t) => completedTopics.has(t.id)).reduce((acc, t) => acc + (t.xpReward || 0), 0),
    [topics, completedTopics],
  );

  function openLesson(topic: GrammarTopicItem) {
    haptic.select();
    markViewed(topic.id);
    setRevealedPractice({});
    setLessonTopic({ topic, levelTitle: levelMap.get(topic.levelId) ?? topic.moduleTitle });
  }

  function openQuiz(topic: GrammarTopicItem) {
    haptic.select();
    markViewed(topic.id);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizTopic(topic);
  }

  async function handleSubmitQuiz() {
    if (!quizTopic) return;
    const score = quizTopic.quiz.reduce(
      (sum, q, i) => (quizAnswers[i] === q.correctIndex ? sum + 1 : sum),
      0,
    );
    setQuizSubmitted(true);
    haptic.success();
    await submitQuizResult(quizTopic.id, score, quizTopic.quiz.length);
  }

  if (isLoading) return <LoadingView />;
  if (isError) {
    return (
      <ErrorView
        message={error instanceof Error ? error.message : 'Unable to load grammar syllabus'}
        onRetry={refetch}
      />
    );
  }

  return (
    <View style={{ gap: space.md }}>
      {saveError ? <ErrorBanner message={saveError} /> : null}

      {/* Overall Mastery Card */}
      <Card tone="hero" style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.heroMuted, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.7 }}>
              GRAMMAR SYLLABUS
            </Text>
            <Text style={{ color: c.heroText, fontSize: 22, fontWeight: '800', marginTop: 2 }}>
              {completedCount} of {topics.length} Topics Mastered
            </Text>
          </View>
          <View style={[styles.xpPill, { backgroundColor: c.heroSoft }]}>
            <Ionicons name="flash" size={14} color={c.star} />
            <Text style={{ color: c.heroText, fontWeight: '800', fontSize: 12.5 }}>{earnedXp} XP</Text>
          </View>
        </View>
        <ProgressBar value={progressRatio} color={c.heroText} track={c.heroSoft} height={8} />
        <Text style={{ color: c.heroMuted, fontSize: 12.5, fontWeight: '600' }}>
          {levels.length} structured levels · {Object.keys(quizResults).length} quizzes completed
        </Text>
      </Card>

      {/* Search Bar */}
      <View style={[styles.searchBox, { backgroundColor: c.surface, borderColor: c.border }, elevation(c, 1)]}>
        <Ionicons name="search" size={18} color={c.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search grammar topics, rules, examples..."
          placeholderTextColor={c.textMuted}
          style={{ flex: 1, color: c.text, fontSize: 15, paddingVertical: 10 }}
        />
        {search ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => setSearch('')}
            hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={c.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {/* Recently Viewed / Continue Learning */}
      {recentlyViewed.length > 0 && !search ? (
        <View>
          <SectionHeader title="Continue learning" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -16 }}
            contentContainerStyle={{ paddingHorizontal: 16, gap: space.sm }}>
            {recentlyViewed.map((item) => {
              const found = topics.find((t) => t.id === item.topicId);
              if (!found) return null;
              return (
                <Card
                  key={item.topicId}
                  onPress={() => openLesson(found)}
                  style={{ width: 210, gap: 6, padding: space.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Badge label={item.categoryName} tone="primary" />
                    {completedTopics.has(found.id) ? (
                      <Ionicons name="checkmark-circle" size={18} color={c.success} />
                    ) : null}
                  </View>
                  <AppText style={{ fontWeight: '800', fontSize: 15 }} numberOfLines={2}>
                    {found.emoji ? `${found.emoji} ` : ''}
                    {found.title}
                  </AppText>
                  <AppText variant="small" muted>
                    {found.timeMinutes} min · {found.quiz.length} Qs
                  </AppText>
                </Card>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* Grammar Levels */}
      {grouped.length === 0 ? (
        <EmptyView title="No grammar topics found" message="Try clearing your search filter." />
      ) : (
        grouped.map(({ level, items }, index) => {
          const isOpen =
            search.trim().length > 0 || (expanded[level.id] ?? index < 2);
          const doneInLevel = items.filter((t) => completedTopics.has(t.id)).length;

          return (
            <Card key={level.id} style={{ padding: 0, overflow: 'hidden' }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  haptic.select();
                  setExpanded((prev) => ({ ...prev, [level.id]: !isOpen }));
                }}
                style={styles.levelHeader}>
                <View style={[styles.levelBadge, { backgroundColor: c.primarySoft }]}>
                  <Text style={{ color: c.primary, fontWeight: '800', fontSize: 13 }}>
                    L{level.number}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontWeight: '800', fontSize: 16 }}>{level.title}</AppText>
                  <AppText variant="small" muted numberOfLines={1}>
                    {level.subtitle || `${doneInLevel}/${items.length} completed`}
                  </AppText>
                </View>
                <Badge
                  label={`${doneInLevel}/${items.length}`}
                  tone={doneInLevel === items.length ? 'success' : 'muted'}
                />
                <Ionicons
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={c.textMuted}
                />
              </Pressable>

              {isOpen ? (
                <View style={{ borderTopWidth: 1, borderTopColor: c.border }}>
                  {items.map((topic, tIdx) => {
                    const done = completedTopics.has(topic.id);
                    const diff = DIFFICULTY_META[topic.difficulty] ?? DIFFICULTY_META[1];
                    const qr = quizResults[topic.id];
                    return (
                      <View
                        key={topic.id}
                        style={[
                          styles.topicRow,
                          tIdx > 0 ? { borderTopWidth: 1, borderTopColor: c.border } : null,
                        ]}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
                          <Pressable
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: done }}
                            accessibilityLabel={`Mark ${topic.title} complete`}
                            onPress={() => {
                              haptic.light();
                              toggleCompleted(topic.id);
                            }}
                            style={{ paddingTop: 2 }}>
                            <Ionicons
                              name={done ? 'checkmark-circle' : 'ellipse-outline'}
                              size={24}
                              color={done ? c.success : c.textMuted}
                            />
                          </Pressable>

                          <View style={{ flex: 1, gap: 4 }}>
                            <Pressable onPress={() => openLesson(topic)}>
                              <AppText style={{ fontWeight: '800', fontSize: 15.5 }}>
                                {topic.emoji ? `${topic.emoji} ` : ''}
                                {topic.title}
                              </AppText>
                              {topic.subtitle ? (
                                <AppText variant="small" muted numberOfLines={2}>
                                  {topic.subtitle}
                                </AppText>
                              ) : null}
                            </Pressable>

                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                              <Badge label={diff.label} tone={diff.tone} />
                              <Badge label={`${topic.timeMinutes}m · ${topic.xpReward} XP`} tone="muted" />
                              {qr ? (
                                <Badge label={`Quiz ${qr.score}/${qr.total}`} tone="success" />
                              ) : null}
                            </View>

                            <View style={{ flexDirection: 'row', gap: 8, marginTop: space.sm }}>
                              <Pressable
                                accessibilityRole="button"
                                onPress={() => openLesson(topic)}
                                style={[styles.miniBtn, { backgroundColor: c.primarySoft }]}>
                                <Ionicons name="book-outline" size={14} color={c.primary} />
                                <Text style={{ color: c.primary, fontSize: 12.5, fontWeight: '700' }}>
                                  Read Lesson
                                </Text>
                              </Pressable>
                              {topic.quiz.length > 0 ? (
                                <Pressable
                                  accessibilityRole="button"
                                  onPress={() => openQuiz(topic)}
                                  style={[styles.miniBtn, { backgroundColor: c.infoBg }]}>
                                  <Ionicons name="help-circle-outline" size={14} color={c.info} />
                                  <Text style={{ color: c.infoFg, fontSize: 12.5, fontWeight: '700' }}>
                                    Quiz ({topic.quiz.length})
                                  </Text>
                                </Pressable>
                              ) : null}
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </Card>
          );
        })
      )}

      {/* Lesson Reader Modal */}
      <Modal
        visible={!!lessonTopic}
        animationType="slide"
        onRequestClose={() => setLessonTopic(null)}>
        {lessonTopic ? (
          <View style={{ flex: 1, backgroundColor: c.bg }}>
            <View
              style={[
                styles.modalHeader,
                {
                  paddingTop: insets.top + 8,
                  backgroundColor: c.surface,
                  borderBottomColor: c.border,
                },
              ]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close lesson"
                onPress={() => setLessonTopic(null)}
                style={[styles.closeBtn, { backgroundColor: c.bg }]}>
                <Ionicons name="close" size={20} color={c.text} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.primary, fontSize: 11.5, fontWeight: '800' }} numberOfLines={1}>
                  {lessonTopic.levelTitle}
                </Text>
                <Text style={{ color: c.text, fontSize: 17, fontWeight: '800' }} numberOfLines={1}>
                  {lessonTopic.topic.emoji ? `${lessonTopic.topic.emoji} ` : ''}
                  {lessonTopic.topic.title}
                </Text>
              </View>
            </View>

            <ScrollView
              contentContainerStyle={{
                padding: space.lg,
                paddingBottom: 110,
                gap: space.md,
              }}>
              {lessonTopic.topic.definition ? (
                <Card tone="soft" style={{ gap: 6 }}>
                  <Text style={[styles.microLabel, { color: c.primary }]}>DEFINITION</Text>
                  <AppText style={{ fontWeight: '600', lineHeight: 23 }}>
                    {lessonTopic.topic.definition}
                  </AppText>
                </Card>
              ) : null}

              {lessonTopic.topic.simpleExplanation ? (
                <Card style={{ gap: 6 }}>
                  <Text style={[styles.microLabel, { color: c.textMuted }]}>INTUITIVE EXPLANATION</Text>
                  <AppText style={{ lineHeight: 23 }}>{lessonTopic.topic.simpleExplanation}</AppText>
                </Card>
              ) : null}

              {lessonTopic.topic.visualExamples.length > 0 ? (
                <Card style={{ gap: space.sm }}>
                  <Text style={[styles.microLabel, { color: c.textMuted }]}>EXAMPLES</Text>
                  {lessonTopic.topic.visualExamples.map((ex, idx) => (
                    <View key={idx} style={[styles.subBox, { backgroundColor: c.bg }]}>
                      <Text style={{ color: c.primary, fontWeight: '800', fontSize: 12.5 }}>
                        {ex.emoji ? `${ex.emoji} ` : ''}
                        {ex.label}
                      </Text>
                      <AppText style={{ marginTop: 3, fontWeight: '500' }}>{ex.sentence}</AppText>
                    </View>
                  ))}
                </Card>
              ) : null}

              {lessonTopic.topic.memoryTrick ? (
                <Card style={{ backgroundColor: c.warningBg, gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="bulb" size={16} color={c.warning} />
                    <Text style={[styles.microLabel, { color: c.warningFg, marginBottom: 0 }]}>
                      MEMORY SHORTCUT
                    </Text>
                  </View>
                  <Text style={{ color: c.warningFg, fontSize: 14.5, lineHeight: 21, fontWeight: '600' }}>
                    {lessonTopic.topic.memoryTrick}
                  </Text>
                </Card>
              ) : null}

              {lessonTopic.topic.commonMistakes.length > 0 ? (
                <Card style={{ gap: space.sm }}>
                  <Text style={[styles.microLabel, { color: c.danger }]}>COMMON EXAM MISTAKES</Text>
                  {lessonTopic.topic.commonMistakes.map((m, idx) => (
                    <View key={idx} style={[styles.subBox, { backgroundColor: c.bg, gap: 4 }]}>
                      <Text style={{ color: c.danger, fontSize: 13.5, fontWeight: '600' }}>
                        ✗ {m.wrong}
                      </Text>
                      <Text style={{ color: c.success, fontSize: 13.5, fontWeight: '700' }}>
                        ✓ {m.correct}
                      </Text>
                      {m.tip ? (
                        <AppText variant="small" muted>
                          {m.tip}
                        </AppText>
                      ) : null}
                    </View>
                  ))}
                </Card>
              ) : null}

              {lessonTopic.topic.practiceItems.length > 0 ? (
                <Card style={{ gap: space.sm }}>
                  <Text style={[styles.microLabel, { color: c.textMuted }]}>QUICK CHECK</Text>
                  {lessonTopic.topic.practiceItems.map((p, idx) => {
                    const shown = !!revealedPractice[idx];
                    return (
                      <View key={idx} style={[styles.subBox, { backgroundColor: c.bg, gap: 6 }]}>
                        <AppText variant="small" muted style={{ fontWeight: '700' }}>
                          {p.instruction}
                        </AppText>
                        <AppText style={{ fontWeight: '600' }}>{p.sentence}</AppText>
                        {shown ? (
                          <Text style={{ color: c.success, fontWeight: '700', fontSize: 13.5 }}>
                            Answer: {p.answer}
                          </Text>
                        ) : (
                          <Pressable
                            onPress={() =>
                              setRevealedPractice((prev) => ({ ...prev, [idx]: true }))
                            }>
                            <Text style={{ color: c.primary, fontWeight: '700', fontSize: 13 }}>
                              Tap to reveal answer
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </Card>
              ) : null}

              {lessonTopic.topic.revisionPoints.length > 0 ? (
                <Card style={{ gap: 6 }}>
                  <Text style={[styles.microLabel, { color: c.textMuted }]}>KEY TAKEAWAYS</Text>
                  {lessonTopic.topic.revisionPoints.map((pt, idx) => (
                    <AppText key={idx} variant="small" style={{ lineHeight: 20 }}>
                      • {pt}
                    </AppText>
                  ))}
                </Card>
              ) : null}

              {lessonTopic.topic.pdfs.length > 0 || lessonTopic.topic.videos.length > 0 ? (
                <Card style={{ gap: space.sm }}>
                  <Text style={[styles.microLabel, { color: c.textMuted }]}>STUDY RESOURCES</Text>
                  {lessonTopic.topic.pdfs.map((pdf) => (
                    <Pressable
                      key={pdf.id}
                      onPress={() => WebBrowser.openBrowserAsync(pdf.url)}
                      style={[styles.resourceRow, { backgroundColor: c.bg }]}>
                      <Ionicons name="document-text" size={18} color={c.primary} />
                      <Text style={{ flex: 1, color: c.text, fontWeight: '600', fontSize: 14 }}>
                        {pdf.title}
                      </Text>
                      <Ionicons name="open-outline" size={16} color={c.textMuted} />
                    </Pressable>
                  ))}
                  {lessonTopic.topic.videos.map((vid) => (
                    <Pressable
                      key={vid.id}
                      onPress={() => WebBrowser.openBrowserAsync(vid.url)}
                      style={[styles.resourceRow, { backgroundColor: c.bg }]}>
                      <Ionicons name="play-circle" size={18} color={c.info} />
                      <Text style={{ flex: 1, color: c.text, fontWeight: '600', fontSize: 14 }}>
                        {vid.title}
                      </Text>
                      <Ionicons name="open-outline" size={16} color={c.textMuted} />
                    </Pressable>
                  ))}
                </Card>
              ) : null}
            </ScrollView>

            <View
              style={[
                styles.modalFooter,
                {
                  paddingBottom: Math.max(insets.bottom, 12),
                  backgroundColor: c.surface,
                  borderTopColor: c.border,
                },
              ]}>
              <View style={{ flex: 1 }}>
                <Button
                  title={
                    completedTopics.has(lessonTopic.topic.id)
                      ? 'Completed ✓'
                      : 'Mark Completed'
                  }
                  variant={completedTopics.has(lessonTopic.topic.id) ? 'outline' : 'primary'}
                  onPress={() => {
                    haptic.success();
                    toggleCompleted(lessonTopic.topic.id);
                  }}
                />
              </View>
              {lessonTopic.topic.quiz.length > 0 ? (
                <View style={{ flex: 1 }}>
                  <Button
                    title={`Quiz (${lessonTopic.topic.quiz.length})`}
                    onPress={() => {
                      const t = lessonTopic.topic;
                      setLessonTopic(null);
                      openQuiz(t);
                    }}
                  />
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
      </Modal>

      {/* Topic Quiz Modal */}
      <Modal
        visible={!!quizTopic}
        animationType="slide"
        onRequestClose={() => setQuizTopic(null)}>
        {quizTopic ? (
          <View style={{ flex: 1, backgroundColor: c.bg }}>
            <View
              style={[
                styles.modalHeader,
                {
                  paddingTop: insets.top + 8,
                  backgroundColor: c.surface,
                  borderBottomColor: c.border,
                },
              ]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close quiz"
                onPress={() => setQuizTopic(null)}
                style={[styles.closeBtn, { backgroundColor: c.bg }]}>
                <Ionicons name="close" size={20} color={c.text} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.primary, fontSize: 11.5, fontWeight: '800' }}>
                  GRAMMAR TOPIC QUIZ
                </Text>
                <Text style={{ color: c.text, fontSize: 17, fontWeight: '800' }} numberOfLines={1}>
                  {quizTopic.title}
                </Text>
              </View>
            </View>

            <ScrollView
              contentContainerStyle={{
                padding: space.lg,
                paddingBottom: 110,
                gap: space.md,
              }}>
              {quizSubmitted ? (
                <Card tone="hero" style={{ alignItems: 'center', gap: space.sm }}>
                  <ProgressRing
                    value={
                      quizTopic.quiz.length > 0
                        ? quizTopic.quiz.filter((q, i) => quizAnswers[i] === q.correctIndex).length /
                          quizTopic.quiz.length
                        : 1
                    }
                    size={90}
                    stroke={9}
                    color={c.heroText}
                    track={c.heroSoft}>
                    <Text style={{ color: c.heroText, fontSize: 19, fontWeight: '800' }}>
                      {quizTopic.quiz.filter((q, i) => quizAnswers[i] === q.correctIndex).length}/
                      {quizTopic.quiz.length}
                    </Text>
                  </ProgressRing>
                  <Text style={{ color: c.heroText, fontSize: 18, fontWeight: '800' }}>
                    Quiz Saved · Topic Completed
                  </Text>
                </Card>
              ) : null}

              {quizTopic.quiz.map((q, qIndex) => {
                const chosen = quizAnswers[qIndex];
                return (
                  <Card key={qIndex} style={{ gap: space.sm }}>
                    <Badge label={`Q${qIndex + 1}`} tone="primary" />
                    <AppText style={{ fontWeight: '700', fontSize: 15.5, lineHeight: 22 }}>
                      {q.question}
                    </AppText>
                    <View style={{ gap: 8, marginTop: 4 }}>
                      {q.options.map((opt, optIdx) => {
                        const isSel = chosen === optIdx;
                        const isCorrect = q.correctIndex === optIdx;
                        const borderColor = quizSubmitted
                          ? isCorrect
                            ? c.success
                            : isSel
                              ? c.danger
                              : c.border
                          : isSel
                            ? c.primary
                            : c.border;
                        const bgColor = quizSubmitted
                          ? isCorrect
                            ? c.successBg
                            : isSel
                              ? c.dangerBg
                              : c.bg
                          : isSel
                            ? c.primarySoft
                            : c.bg;
                        return (
                          <Pressable
                            key={optIdx}
                            disabled={quizSubmitted}
                            onPress={() => {
                              haptic.select();
                              setQuizAnswers((prev) => ({ ...prev, [qIndex]: optIdx }));
                            }}
                            style={[styles.quizOption, { backgroundColor: bgColor, borderColor }]}>
                            <Text style={{ color: c.primary, fontWeight: '800', fontSize: 12 }}>
                              {String.fromCharCode(65 + optIdx)}.
                            </Text>
                            <Text style={{ flex: 1, color: c.text, fontSize: 14.5, fontWeight: '500' }}>
                              {opt}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    {quizSubmitted && q.explanation ? (
                      <View style={[styles.subBox, { backgroundColor: c.primarySoft, marginTop: 4 }]}>
                        <AppText variant="small" style={{ color: c.primary, fontWeight: '600' }}>
                          {q.explanation}
                        </AppText>
                      </View>
                    ) : null}
                  </Card>
                );
              })}
            </ScrollView>

            <View
              style={[
                styles.modalFooter,
                {
                  paddingBottom: Math.max(insets.bottom, 12),
                  backgroundColor: c.surface,
                  borderTopColor: c.border,
                },
              ]}>
              <View style={{ flex: 1 }}>
                {quizSubmitted ? (
                  <Button title="Done" onPress={() => setQuizTopic(null)} />
                ) : (
                  <Button
                    title={`Submit Quiz (${Object.keys(quizAnswers).length}/${quizTopic.quiz.length})`}
                    disabled={Object.keys(quizAnswers).length < quizTopic.quiz.length}
                    onPress={handleSubmitQuiz}
                  />
                )}
              </View>
            </View>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  xpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
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
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
  },
  levelBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicRow: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  miniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  microLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  subBox: {
    padding: space.md,
    borderRadius: radius.md,
  },
  resourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
  },
  quizOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  modalFooter: {
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
});
