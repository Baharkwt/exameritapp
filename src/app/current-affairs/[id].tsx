import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  addBookmark,
  getBookmarks,
  getCurrentAffairById,
  removeBookmark,
  saveReadingProgress,
} from '@/api/learning';
import { AppText, Badge, Card, ErrorView, LoadingView, Screen, ScreenHeader } from '@/components/ui/kit';
import { space, useColors } from '@/theme';

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
      <ScreenHeader
        title="Article"
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/current-affairs'))}
        right={
          <Pressable accessibilityLabel={isSaved ? 'Remove bookmark' : 'Save article'} onPress={toggleBookmark} hitSlop={10}>
            <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={24} color={isSaved ? c.primary : c.text} />
          </Pressable>
        }
      />

      {art.topic || art.category ? (
        <View style={{ marginBottom: space.sm }}>
          <Badge label={[art.topic, art.category].filter(Boolean).join(' · ')} tone="info" />
        </View>
      ) : null}
      <Text style={{ color: c.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.6, lineHeight: 32 }}>{art.title}</Text>
      <AppText variant="small" muted style={{ marginTop: space.sm, marginBottom: space.lg }}>
        {new Date(art.published_at || art.created_at).toLocaleDateString()}
        {art.source ? ` · ${art.source}` : ''}
      </AppText>

      {art.summary ? (
        <Card tone="soft" style={{ marginBottom: space.md }}>
          <AppText style={{ fontWeight: '700' }}>{art.summary}</AppText>
        </Card>
      ) : null}

      <Card>
        <AppText style={{ lineHeight: 25, fontSize: 16 }}>
          {stripHtml(art.content) || art.summary || 'No additional article body.'}
        </AppText>
      </Card>
    </Screen>
  );
}
