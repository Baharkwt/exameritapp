import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { getGlobalLeaderboard, getQuizLeaderboard } from '@/api/live';
import { AppText, Card, EmptyView, ErrorView, LoadingView, Screen, ScreenHeader } from '@/components/ui/kit';
import { useAuth } from '@/features/auth/auth-provider';
import { space, useColors } from '@/theme';

export default function LeaderboardScreen() {
  const c = useColors();
  const { user } = useAuth();
  const { quizId } = useLocalSearchParams<{ quizId?: string }>();

  const globalQ = useQuery({
    queryKey: ['leaderboard-global'],
    queryFn: getGlobalLeaderboard,
    enabled: !quizId,
  });

  const quizQ = useQuery({
    queryKey: ['leaderboard-quiz', quizId],
    queryFn: () => getQuizLeaderboard(quizId!),
    enabled: !!quizId,
  });

  if (globalQ.isLoading || quizQ.isLoading) return <LoadingView />;
  if (globalQ.isError || quizQ.isError) {
    const err = globalQ.error ?? quizQ.error;
    return (
      <ErrorView
        message={err?.message ?? 'Failed to load leaderboard'}
        onRetry={() => (quizId ? quizQ.refetch() : globalQ.refetch())}
      />
    );
  }

  const userRank = quizId ? quizQ.data?.user_rank : globalQ.data?.user_rank;
  const rows = quizId ? quizQ.data?.leaderboard ?? [] : globalQ.data?.leaderboard ?? [];

  return (
    <Screen>
      <ScreenHeader
        title={quizId ? 'Quiz leaderboard' : 'Leaderboard'}
        subtitle={quizId ? `Test ${quizId}` : 'Ranked by total XP and streak'}
      />

      <Card tone="hero" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg }}>
        <View>
          <Text style={{ color: c.heroMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>YOUR RANK</Text>
          <Text style={{ color: c.heroText, fontSize: 40, fontWeight: '800', letterSpacing: -1 }}>#{userRank ?? '—'}</Text>
        </View>
        <Ionicons name="trophy" size={48} color={c.star} />
      </Card>

      {rows.length === 0 ? (
        <EmptyView title="No rankings yet" message="Complete quizzes and tests to climb the leaderboard." />
      ) : (
        <View style={{ gap: space.sm }}>
          {rows.map((r) => {
            const isMe = String(r.id) === String(user?.id);
            const rightValue =
              'total_points' in r ? `${r.total_points} XP` : `${r.score} pts`;
            const subValue =
              'current_streak' in r
                ? `🔥 ${r.current_streak}d streak · ${r.total_quizzes_taken} quizzes`
                : r.duration
                  ? `Time: ${r.duration}s`
                  : '';

            return (
              <Card
                key={`${r.rank}-${r.id}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  padding: space.md,
                  borderWidth: isMe ? 2 : 0,
                  borderColor: c.primary,
                }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: r.rank <= 3 ? c.warningBg : c.skeleton,
                  }}>
                  {r.rank <= 3 ? (
                    <Text style={{ fontSize: 18 }}>{['🥇', '🥈', '🥉'][r.rank - 1]}</Text>
                  ) : (
                    <Text style={{ color: c.textMuted, fontWeight: '800' }}>{r.rank}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontWeight: '700' }} numberOfLines={1}>
                    {r.name} {isMe ? '(You)' : ''}
                  </AppText>
                  {subValue ? (
                    <AppText variant="small" muted>
                      {subValue}
                    </AppText>
                  ) : null}
                </View>
                <Text style={{ color: c.primary, fontWeight: '800' }}>{rightValue}</Text>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
