import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  addBookmark,
  getBookmarks,
  getCurrentAffairById,
  removeBookmark,
  saveReadingProgress,
} from '@/api/learning';
import { AppText, ErrorView, LoadingView, Screen } from '@/components/ui/kit';
import { radius, space, useColors } from '@/theme';

function stripHtml(raw?: string | null): string {
  if (!raw) return '';
  return raw.replace(/<[^>]+>/g, '').trim();
}

export default function CurrentAffairDetailScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const artQ = useQuery({
    queryKey: ['current-affair', id],
    queryFn: () => getCurrentAffairById(id),
    enabled: !!id,
  });

  const bookmarksQ = useQuery({
    queryKey: ['bookmarks'],
    queryFn: getBookmarks,
  });

  // Record 100% reading progress when article is opened
  useEffect(() => {
    if (id) {
      saveReadingProgress(id, 100).catch(() => {});
    }
  }, [id]);

  if (artQ.isLoading) return <LoadingView />;
  if (artQ.isError) return <ErrorView message={artQ.error.message} onRetry={() => artQ.refetch()} />;

  const art = artQ.data!;
  const isSaved = (bookmarksQ.data ?? []).some((b) => String(b.article_id) === String(art.id));

  async function toggleBookmark() {
    if (isSaved) {
      await removeBookmark(art.id);
    } else {
      await addBookmark(art.id);
    }
    await qc.invalidateQueries({ queryKey: ['bookmarks'] });
  }

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/current-affairs'))} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="small" style={{ color: c.primary, fontWeight: '700' }}>
            {[art.topic, art.category].filter(Boolean).join(' · ')}
          </AppText>
        </View>
        <Pressable onPress={toggleBookmark} hitSlop={10}>
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={24}
            color={isSaved ? c.primary : c.text}
          />
        </Pressable>
      </View>

      <AppText variant="title" style={{ fontSize: 22, marginBottom: space.xs }}>
        {art.title}
      </AppText>
      <AppText variant="small" muted style={{ marginBottom: space.md }}>
        {new Date(art.published_at || art.created_at).toLocaleDateString()}
        {art.source ? ` · Source: ${art.source}` : ''}
      </AppText>

      {art.summary ? (
        <View style={[styles.summaryBox, { backgroundColor: c.surface, borderColor: c.border }]}>
          <AppText style={{ fontWeight: '600' }}>{art.summary}</AppText>
        </View>
      ) : null}

      <View style={[styles.bodyCard, { backgroundColor: c.surface, borderColor: c.border }]}>
        <AppText style={{ lineHeight: 24 }}>
          {stripHtml(art.content) || art.summary || 'No additional article body.'}
        </AppText>
      </View>
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
  summaryBox: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: space.md,
  },
  bodyCard: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});

