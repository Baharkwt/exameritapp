import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  addBookmark,
  CurrentAffairArticle,
  getBookmarks,
  getCurrentAffairs,
  getCurrentAffairTopics,
  removeBookmark,
} from '@/api/learning';
import { AppText, EmptyView, ErrorView, LoadingView, Screen } from '@/components/ui/kit';
import { radius, space, useColors } from '@/theme';

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
      <View style={styles.headerRow}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/learn'))} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="title" style={{ fontSize: 22 }}>
            Current Affairs & News
          </AppText>
          <AppText variant="small" muted>
            Daily exam-relevant updates & saved bookmarks
          </AppText>
        </View>
      </View>

      {/* Topic & Saved Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.md }}>
        <View style={{ flexDirection: 'row', gap: space.xs }}>
          <Pressable
            onPress={() => {
              setSelectedTopic(undefined);
              setOnlySaved(false);
            }}
            style={[
              styles.chip,
              {
                backgroundColor: !selectedTopic && !onlySaved ? c.primary : c.surface,
                borderColor: c.border,
              },
            ]}>
            <AppText
              variant="small"
              style={{ color: !selectedTopic && !onlySaved ? c.primaryText : c.text, fontWeight: '600' }}>
              All News
            </AppText>
          </Pressable>

          <Pressable
            onPress={() => setOnlySaved(!onlySaved)}
            style={[
              styles.chip,
              {
                backgroundColor: onlySaved ? c.primary : c.surface,
                borderColor: c.border,
              },
            ]}>
            <AppText
              variant="small"
              style={{ color: onlySaved ? c.primaryText : c.text, fontWeight: '600' }}>
              ★ Saved ({bookmarkedIds.size})
            </AppText>
          </Pressable>

          {(topicsQ.data ?? []).map((t) => {
            const active = selectedTopic === t.topic;
            return (
              <Pressable
                key={t.topic}
                onPress={() => setSelectedTopic(active ? undefined : t.topic)}
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
                  {t.topic} ({t.count})
                </AppText>
              </Pressable>
            );
          })}
        </View>
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
              <Pressable
                key={art.id}
                onPress={() =>
                  router.push({
                    pathname: '/current-affairs/[id]',
                    params: { id: String(art.id) },
                  })
                }
                style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
                <View style={{ flex: 1, gap: 4 }}>
                  <AppText variant="small" style={{ color: c.primary, fontWeight: '700' }}>
                    {[art.topic, art.category, new Date(art.created_at).toLocaleDateString()]
                      .filter(Boolean)
                      .join(' · ')}
                  </AppText>
                  <AppText style={{ fontWeight: '700' }}>{art.title}</AppText>
                  {art.summary ? (
                    <AppText variant="small" muted numberOfLines={2}>
                      {art.summary}
                    </AppText>
                  ) : null}
                </View>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    toggleBookmark(art.id);
                  }}
                  hitSlop={10}>
                  <Ionicons
                    name={isSaved ? 'bookmark' : 'bookmark-outline'}
                    size={22}
                    color={isSaved ? c.primary : c.textMuted}
                  />
                </Pressable>
              </Pressable>
            );
          })}
        </View>
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
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: space.md,
  },
});

