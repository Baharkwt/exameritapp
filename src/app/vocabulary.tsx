import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  getVocabularyCategories,
  getVocabularyPractice,
  getVocabularyWords,
  recordVocabularyProgress,
  VocabularyWord,
} from '@/api/learning';
import {
  AppText,
  Badge,
  Button,
  Card,
  Chip,
  EmptyView,
  ErrorView,
  LoadingView,
  ProgressBar,
  Screen,
  ScreenHeader,
  Segmented,
} from '@/components/ui/kit';
import { haptic } from '@/lib/haptics';
import { elevation, radius, space, useColors } from '@/theme';

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
      if (knewIt) haptic.success();
      else haptic.warning();
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
      <ScreenHeader title="Vocabulary" subtitle="Word bank and flashcard practice" />
      <Segmented
        value={mode}
        onChange={(m) => {
          setMode(m);
          if (m === 'practice') {
            setPracticeIdx(0);
            setRevealed(false);
          }
        }}
        options={[
          { key: 'browse', label: 'Word bank' },
          { key: 'practice', label: 'Flashcards' },
        ]}
      />

      {mode === 'browse' ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -16 }}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 10 }}>
            <Chip label="All words" selected={!selectedCategory} onPress={() => setSelectedCategory(undefined)} />
            {(catsQ.data ?? []).map((cat) => (
              <Chip
                key={cat.category}
                label={`${cat.category} · ${cat.word_count}`}
                selected={selectedCategory === cat.category}
                onPress={() => setSelectedCategory(selectedCategory === cat.category ? undefined : cat.category)}
              />
            ))}
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
                <Card key={w.id} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: c.primary, fontSize: 19, fontWeight: '800', letterSpacing: -0.3 }}>{w.word}</Text>
                    {w.category ? <Badge label={w.category} tone="muted" /> : null}
                  </View>
                  <AppText>{w.definition}</AppText>
                  {w.example_sentence ? (
                    <AppText variant="small" muted style={{ fontStyle: 'italic' }}>
                      &ldquo;{w.example_sentence}&rdquo;
                    </AppText>
                  ) : null}
                </Card>
              ))}
            </View>
          )}
        </>
      ) : practiceQ.isLoading ? (
        <LoadingView />
      ) : practiceQ.isError ? (
        <ErrorView message={practiceQ.error.message} onRetry={() => practiceQ.refetch()} />
      ) : (practiceQ.data ?? []).length === 0 ? (
        <EmptyView title="All caught up!" message="You have reviewed all due flashcards for now." />
      ) : (
        (() => {
          const list = practiceQ.data ?? [];
          const current = list[practiceIdx] ?? list[0];
          return (
            <View style={{ marginTop: space.lg, gap: space.md }}>
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <AppText variant="small" muted>
                    Card {practiceIdx + 1} of {list.length}
                  </AppText>
                  <Badge label={current.mastery_level || 'new'} tone="primary" />
                </View>
                <ProgressBar value={(practiceIdx + 1) / list.length} />
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={revealed ? 'Hide meaning' : 'Reveal meaning'}
                onPress={() => {
                  haptic.light();
                  setRevealed(!revealed);
                }}
                style={[styles.flashcard, { backgroundColor: revealed ? c.primarySoft : c.surface }, elevation(c, 2)]}>
                <Text style={{ color: c.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.8, textAlign: 'center' }}>
                  {current.word}
                </Text>
                {revealed ? (
                  <View style={{ marginTop: space.lg, alignItems: 'center', gap: space.sm }}>
                    <AppText style={{ textAlign: 'center', fontSize: 16 }}>{current.definition}</AppText>
                    {current.example_sentence ? (
                      <AppText variant="small" muted style={{ textAlign: 'center', fontStyle: 'italic' }}>
                        &ldquo;{current.example_sentence}&rdquo;
                      </AppText>
                    ) : null}
                  </View>
                ) : (
                  <AppText variant="small" muted style={{ marginTop: space.lg }}>
                    Tap to reveal meaning
                  </AppText>
                )}
              </Pressable>

              {revealed ? (
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button title="Need review" variant="danger" loading={saving} onPress={() => handleAnswerPractice(current, false)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button title="I knew it" loading={saving} onPress={() => handleAnswerPractice(current, true)} />
                  </View>
                </View>
              ) : (
                <Button title="Show meaning" variant="outline" onPress={() => setRevealed(true)} />
              )}
            </View>
          );
        })()
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flashcard: {
    minHeight: 260,
    padding: space.xl,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
