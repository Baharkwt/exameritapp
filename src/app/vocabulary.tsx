import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  getVocabularyCategories,
  getVocabularyPractice,
  getVocabularyWords,
  recordVocabularyProgress,
  VocabularyWord,
} from '@/api/learning';
import { AppText, Button, EmptyView, ErrorView, LoadingView, Screen } from '@/components/ui/kit';
import { radius, space, useColors } from '@/theme';

export default function VocabularyHubScreen() {
  const c = useColors();
  const qc = useQueryClient();

  const [mode, setMode] = useState<'browse' | 'practice'>('browse');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [practiceIdx, setPracticeIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);

  const catsQ = useQuery({
    queryKey: ['vocab-categories'],
    queryFn: getVocabularyCategories,
  });

  const wordsQ = useQuery({
    queryKey: ['vocab-words', selectedCategory],
    queryFn: () => getVocabularyWords({ category: selectedCategory }),
    enabled: mode === 'browse',
  });

  const practiceQ = useQuery({
    queryKey: ['vocab-practice'],
    queryFn: getVocabularyPractice,
    enabled: mode === 'practice',
  });

  async function handleAnswerPractice(word: VocabularyWord, knewIt: boolean) {
    setSaving(true);
    try {
      await recordVocabularyProgress(word.id, knewIt);
      setRevealed(false);
      const list = practiceQ.data ?? [];
      if (practiceIdx + 1 < list.length) {
        setPracticeIdx(practiceIdx + 1);
      } else {
        setPracticeIdx(0);
        await qc.invalidateQueries({ queryKey: ['vocab-practice'] });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/learn'))} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="title" style={{ fontSize: 22 }}>
            Vocabulary & Grammar Hub
          </AppText>
          <AppText variant="small" muted>
            Spaced-repetition flashcards & exam word bank
          </AppText>
        </View>
      </View>

      {/* Mode Switcher */}
      <View style={[styles.segmented, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Pressable
          onPress={() => setMode('browse')}
          style={[styles.segmentBtn, mode === 'browse' ? { backgroundColor: c.primary } : null]}>
          <AppText
            variant="small"
            style={{ color: mode === 'browse' ? c.primaryText : c.text, fontWeight: '700' }}>
            Word Bank
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => {
            setMode('practice');
            setPracticeIdx(0);
            setRevealed(false);
          }}
          style={[styles.segmentBtn, mode === 'practice' ? { backgroundColor: c.primary } : null]}>
          <AppText
            variant="small"
            style={{ color: mode === 'practice' ? c.primaryText : c.text, fontWeight: '700' }}>
            Flashcard Practice
          </AppText>
        </Pressable>
      </View>

      {mode === 'browse' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: space.md }}>
            <View style={{ flexDirection: 'row', gap: space.xs }}>
              <Pressable
                onPress={() => setSelectedCategory(undefined)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: !selectedCategory ? c.primary : c.surface,
                    borderColor: c.border,
                  },
                ]}>
                <AppText
                  variant="small"
                  style={{ color: !selectedCategory ? c.primaryText : c.text, fontWeight: '600' }}>
                  All Words
                </AppText>
              </Pressable>
              {(catsQ.data ?? []).map((cat) => {
                const active = selectedCategory === cat.category;
                return (
                  <Pressable
                    key={cat.category}
                    onPress={() => setSelectedCategory(active ? undefined : cat.category)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? c.primary : c.surface,
                        borderColor: c.border,
                      },
                    ]}>
                    <AppText
                      variant="small"
                      style={{ color: active ? c.primaryText : c.text }}>
                      {cat.category} ({cat.word_count})
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {wordsQ.isLoading ? (
            <LoadingView />
          ) : wordsQ.isError ? (
            <ErrorView message={wordsQ.error.message} onRetry={() => wordsQ.refetch()} />
          ) : (wordsQ.data?.words ?? []).length === 0 ? (
            <EmptyView title="No vocabulary words found" message="Try selecting another category." />
          ) : (
            <View style={{ gap: space.sm }}>
              {(wordsQ.data?.words ?? []).map((w: VocabularyWord) => (
                <View
                  key={w.id}
                  style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <AppText variant="heading">{w.word}</AppText>
                    {w.category ? (
                      <AppText variant="small" muted>
                        {w.category}
                      </AppText>
                    ) : null}
                  </View>
                  <AppText style={{ marginTop: 4 }}>{w.definition}</AppText>
                  {w.example_sentence ? (
                    <AppText variant="small" muted style={{ marginTop: 4, fontStyle: 'italic' }}>
                      &ldquo;{w.example_sentence}&rdquo;
                    </AppText>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </>
      ) : practiceQ.isLoading ? (
        <LoadingView />
      ) : practiceQ.isError ? (
        <ErrorView message={practiceQ.error.message} onRetry={() => practiceQ.refetch()} />
      ) : (practiceQ.data ?? []).length === 0 ? (
        <EmptyView
          title="All Caught Up!"
          message="You have reviewed all due flashcards for now."
        />
      ) : (
        (() => {
          const list = practiceQ.data ?? [];
          const current = list[practiceIdx] ?? list[0];
          return (
            <View style={{ marginTop: space.lg, gap: space.md }}>
              <AppText variant="small" muted style={{ textAlign: 'center' }}>
                Card {practiceIdx + 1} of {list.length} · Mastery:{' '}
                {(current.mastery_level || 'new').toUpperCase()}
              </AppText>

              <Pressable
                onPress={() => setRevealed(!revealed)}
                style={[styles.flashcard, { backgroundColor: c.surface, borderColor: c.border }]}>
                <AppText variant="title" style={{ textAlign: 'center' }}>
                  {current.word}
                </AppText>
                {revealed ? (
                  <View style={{ marginTop: space.lg, alignItems: 'center', gap: space.sm }}>
                    <AppText style={{ textAlign: 'center', fontSize: 16 }}>
                      {current.definition}
                    </AppText>
                    {current.example_sentence ? (
                      <AppText variant="small" muted style={{ textAlign: 'center' }}>
                        &ldquo;{current.example_sentence}&rdquo;
                      </AppText>
                    ) : null}
                  </View>
                ) : (
                  <AppText variant="small" muted style={{ marginTop: space.lg }}>
                    Tap card to reveal meaning
                  </AppText>
                )}
              </Pressable>

              {revealed ? (
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Need Review"
                      variant="danger"
                      loading={saving}
                      onPress={() => handleAnswerPractice(current, false)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="I Knew It ✓"
                      loading={saving}
                      onPress={() => handleAnswerPractice(current, true)}
                    />
                  </View>
                </View>
              ) : (
                <Button title="Show Meaning" variant="outline" onPress={() => setRevealed(true)} />
              )}
            </View>
          );
        })()
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
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  card: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  flashcard: {
    minHeight: 230,
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

