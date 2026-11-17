import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { getGlobalLeaderboard, getQuizLeaderboard } from '@/api/live';
import { AppText, EmptyView, ErrorView, LoadingView, Screen } from '@/components/ui/kit';
import { useAuth } from '@/features/auth/auth-provider';
import { radius, space, useColors } from '@/theme';

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
      <View style={styles.headerRow}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="title" style={{ fontSize: 22 }}>
            {quizId ? 'Quiz Leaderboard' : 'All-India Leaderboard'}
          </AppText>
          <AppText variant="small" muted>
            {quizId ? `Test ID: ${quizId}` : 'Ranked by total XP & active study streak'}
          </AppText>
        </View>
      </View>

      {/* Current User Rank Banner */}
      <View style={[styles.myRankCard, { backgroundColor: c.primary }]}>
        <View>
          <AppText variant="small" style={{ color: c.primaryText, opacity: 0.85 }}>
            YOUR CURRENT RANK
          </AppText>
          <AppText variant="title" style={{ color: c.primaryText }}>
            #{userRank ?? '—'}
          </AppText>
        </View>
        <Ionicons name="trophy" size={36} color={c.primaryText} />
      </View>

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
              <View
                key={`${r.rank}-${r.id}`}
                style={[
                  styles.rowCard,
                  {
                    backgroundColor: c.surface,
                    borderColor: isMe ? c.primary : c.border,
                    borderWidth: isMe ? 2 : 1,
                  },
                ]}>
                <View
                  style={[
                    styles.rankCircle,
                    {
                      backgroundColor:
                        r.rank === 1
                          ? c.warningBg
                          : r.rank === 2
                            ? c.border
                            : r.rank === 3
                              ? c.warningBg
                              : c.bg,
                    },
                  ]}>
                  <AppText variant="small" style={{ fontWeight: '700' }}>
                    #{r.rank}
                  </AppText>
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontWeight: isMe ? '700' : '600' }}>
                    {r.name} {isMe ? '(You)' : ''}
                  </AppText>
                  {subValue ? (
                    <AppText variant="small" muted>
                      {subValue}
                    </AppText>
                  ) : null}
                </View>
                <AppText style={{ fontWeight: '700', color: c.primary }}>{rightValue}</AppText>
              </View>
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
  myRankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.lg,
    borderRadius: radius.md,
    marginBottom: space.lg,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.md,
    gap: space.md,
  },
  rankCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

