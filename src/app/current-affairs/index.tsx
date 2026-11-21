import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import {
  addBookmark,
  CurrentAffairArticle,
  getBookmarks,
  getCurrentAffairs,
  getCurrentAffairTopics,
  removeBookmark,
} from '@/api/learning';
import { AppText, Badge, Card, Chip, EmptyView, ErrorView, LoadingView, Screen, ScreenHeader } from '@/components/ui/kit';
import { haptic } from '@/lib/haptics';
import { space, useColors } from '@/theme';

export default function CurrentAffairsListScreen() {
  const c = useColors();
  const qc = useQueryClient();

  const [selectedTopic, setSelectedTopic] = useState<string | undefined>(undefined);
  const [onlySaved, setOnlySaved] = useState(false);

  const topicsQ = useQuery({
    queryKey: ['ca-topics'],
    queryFn: getCurrentAffairTopics,
  });

  const articlesQ = useQuery({
    queryKey: ['current-affairs', selectedTopic],
    queryFn: () => getCurrentAffairs({ topic: selectedTopic }),
  });

  const bookmarksQ = useQuery({
    queryKey: ['bookmarks'],
    queryFn: getBookmarks,
  });

  const bookmarkedIds = useMemo(
    () => new Set((bookmarksQ.data ?? []).map((b) => String(b.article_id))),
    [bookmarksQ.data],
  );

  const displayedArticles = useMemo(() => {
    const all = articlesQ.data?.articles ?? [];
    if (!onlySaved) return all;
    return all.filter((a) => bookmarkedIds.has(String(a.id)));
  }, [articlesQ.data, onlySaved, bookmarkedIds]);

  async function toggleBookmark(articleId: number) {
    const idStr = String(articleId);
    if (bookmarkedIds.has(idStr)) {
      await removeBookmark(idStr);
    } else {
      await addBookmark(idStr);
    }
    await qc.invalidateQueries({ queryKey: ['bookmarks'] });
  }

  return (
    <Screen>
      <ScreenHeader
        title="Daily news"
        subtitle="Exam-relevant updates and saved articles"
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/learn'))}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -16 }}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 6, marginBottom: space.sm }}>
        <Chip
          label="All news"
          selected={!selectedTopic && !onlySaved}
          onPress={() => {
            setSelectedTopic(undefined);
            setOnlySaved(false);
          }}
        />
        <Chip label={`Saved · ${bookmarkedIds.size}`} icon="bookmark" selected={onlySaved} onPress={() => setOnlySaved(!onlySaved)} />
        {(topicsQ.data ?? []).map((t) => (
          <Chip
            key={t.topic}
            label={`${t.topic} · ${t.count}`}
            selected={selectedTopic === t.topic}
            onPress={() => setSelectedTopic(selectedTopic === t.topic ? undefined : t.topic)}
          />
        ))}
      </ScrollView>

      {articlesQ.isLoading ? (
        <LoadingView />
      ) : articlesQ.isError ? (
        <ErrorView message={articlesQ.error.message} onRetry={() => articlesQ.refetch()} />
      ) : displayedArticles.length === 0 ? (
        <EmptyView title="No articles found" message="Try switching topics or clearing the saved filter." />
      ) : (
        <View style={{ gap: space.sm }}>
          {displayedArticles.map((art: CurrentAffairArticle) => {
            const isSaved = bookmarkedIds.has(String(art.id));
            return (
              <Card
                key={art.id}
                onPress={() => router.push({ pathname: '/current-affairs/[id]', params: { id: String(art.id) } })}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md, padding: space.md }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {art.topic || art.category ? <Badge label={String(art.topic ?? art.category)} tone="info" /> : null}
                    <AppText variant="small" muted>
                      {new Date(art.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </AppText>
                  </View>
                  <AppText style={{ fontWeight: '700' }}>{art.title}</AppText>
                  {art.summary ? (
                    <AppText variant="small" muted numberOfLines={2}>
                      {art.summary}
                    </AppText>
                  ) : null}
                </View>
                <Pressable
                  accessibilityLabel={isSaved ? 'Remove bookmark' : 'Save article'}
                  onPress={(e) => {
                    e.stopPropagation();
                    haptic.light();
                    toggleBookmark(art.id);
                  }}
                  hitSlop={10}>
                  <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={22} color={isSaved ? c.primary : c.textMuted} />
                </Pressable>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
