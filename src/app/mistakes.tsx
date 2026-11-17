import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  completeRevisionItem,
  deleteMistake,
  getMistakes,
  getRevisionQueue,
  updateMistake,
} from '@/api/analytics';
import { AppText, Button, EmptyView, ErrorView, LoadingView, Screen } from '@/components/ui/kit';
import { radius, space, useColors } from '@/theme';

type StatusFilter = 'ALL' | 'UNRESOLVED' | 'NEEDS_PRACTICE' | 'RESOLVED';

export default function MistakesScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'mistakes' | 'revision'>('mistakes');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const mistakesQ = useQuery({
    queryKey: ['mistakes', statusFilter],
    queryFn: () =>
      getMistakes(statusFilter === 'ALL' ? undefined : { status: statusFilter }),
  });

  const revisionQ = useQuery({
    queryKey: ['revision-queue'],
    queryFn: () => getRevisionQueue(),
  });

  const resolveMut = useMutation({
    mutationFn: ({
      id,
      resolutionStatus,
    }: {
      id: string;
      resolutionStatus: 'UNRESOLVED' | 'NEEDS_PRACTICE' | 'RESOLVED';
    }) => updateMistake(id, { resolutionStatus }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mistakes'] });
      qc.invalidateQueries({ queryKey: ['learning-summary'] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteMistake(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mistakes'] });
      qc.invalidateQueries({ queryKey: ['learning-summary'] });
    },
  });

  const completeRevMut = useMutation({
    mutationFn: (id: string) => completeRevisionItem(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['revision-queue'] });
      qc.invalidateQueries({ queryKey: ['learning-summary'] });
      if (res.graduated) {
        Alert.alert('Mastered!', 'You have completed all spaced-repetition stages for this item.');
      }
    },
  });

  const mistakes = mistakesQ.data ?? [];
  const revisions = revisionQ.data ?? [];

  return (
    <Screen>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="heading">Mistake Notebook & Revision</AppText>
          <AppText variant="small" muted>
            Turn wrong answers into lasting exam memory
          </AppText>
        </View>
      </View>

      {/* Primary Segmented Control */}
      <View style={[styles.tabRow, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Pressable
          onPress={() => setTab('mistakes')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'mistakes' }}
          style={[
            styles.tabBtn,
            tab === 'mistakes' && { backgroundColor: c.primary },
          ]}>
          <AppText
            variant="small"
            style={{
              fontWeight: '700',
              color: tab === 'mistakes' ? c.primaryText : c.text,
            }}>
            Mistake Notebook ({mistakes.length})
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => setTab('revision')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'revision' }}
          style={[
            styles.tabBtn,
            tab === 'revision' && { backgroundColor: c.primary },
          ]}>
          <AppText
            variant="small"
            style={{
              fontWeight: '700',
              color: tab === 'revision' ? c.primaryText : c.text,
            }}>
            Revision Queue ({revisions.length})
          </AppText>
        </Pressable>
      </View>

      {tab === 'mistakes' ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: space.md }}>
            <View style={{ flexDirection: 'row', gap: space.xs }}>
              {(['ALL', 'UNRESOLVED', 'NEEDS_PRACTICE', 'RESOLVED'] as const).map((st) => {
                const active = statusFilter === st;
                return (
                  <Pressable
                    key={st}
                    onPress={() => setStatusFilter(st)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: active ? c.primary : c.surface,
                        borderColor: active ? c.primary : c.border,
                      },
                    ]}>
                    <AppText
                      variant="small"
                      style={{
                        color: active ? c.primaryText : c.text,
                        fontWeight: '600',
                      }}>
                      {st.replace('_', ' ')}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {mistakesQ.isLoading ? (
            <LoadingView />
          ) : mistakesQ.isError ? (
            <ErrorView message={mistakesQ.error.message} onRetry={() => mistakesQ.refetch()} />
          ) : mistakes.length === 0 ? (
            <EmptyView
              title="No mistakes in this view"
              message="Questions you get wrong in mock tests appear here automatically so you can master them."
            />
          ) : (
            <View style={{ gap: space.md }}>
              {mistakes.map((item) => {
                const isResolved = item.resolution_status === 'RESOLVED';
                return (
                  <View
                    key={item.id}
                    style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
                    <View style={styles.badgeRow}>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: isResolved ? c.successBg : c.liveBg,
                          },
                        ]}>
                        <AppText
                          variant="small"
                          style={{
                            color: isResolved ? c.successFg : c.dangerFg,
                            fontWeight: '700',
                            fontSize: 11,
                          }}>
                          {item.resolution_status}
                        </AppText>
                      </View>
                      {item.subject_name || item.topic_name ? (
                        <AppText variant="small" muted style={{ flex: 1 }} numberOfLines={1}>
                          {[item.subject_name, item.topic_name].filter(Boolean).join(' · ')}
                        </AppText>
                      ) : null}
                      <Pressable
                        onPress={() =>
                          Alert.alert(
                            'Remove Mistake',
                            'Delete this question from your mistake notebook?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: () => deleteMut.mutate(item.id),
                              },
                            ],
                          )
                        }>
                        <Ionicons name="trash-outline" size={18} color={c.textMuted} />
                      </Pressable>
                    </View>

                    <AppText style={{ fontWeight: '600', marginVertical: space.xs }}>
                      {item.question_text || 'Saved test question'}
                    </AppText>

                    {item.note ? (
                      <AppText variant="small" muted style={{ marginBottom: space.xs }}>
                        Note: {item.note}
                      </AppText>
                    ) : null}

                    <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xs }}>
                      {item.resolution_status !== 'RESOLVED' ? (
                        <Button
                          title="Mark Resolved"
                          onPress={() =>
                            resolveMut.mutate({ id: item.id, resolutionStatus: 'RESOLVED' })
                          }
                          loading={resolveMut.isPending}
                        />
                      ) : (
                        <Button
                          title="Reopen for Practice"
                          variant="outline"
                          onPress={() =>
                            resolveMut.mutate({ id: item.id, resolutionStatus: 'NEEDS_PRACTICE' })
                          }
                          loading={resolveMut.isPending}
                        />
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </>
      ) : revisionQ.isLoading ? (
        <LoadingView />
      ) : revisionQ.isError ? (
        <ErrorView message={revisionQ.error.message} onRetry={() => revisionQ.refetch()} />
      ) : revisions.length === 0 ? (
        <EmptyView
          title="Revision queue is clear"
          message="Spaced-repetition items scheduled from your mistakes and bookmarks will appear here when due."
        />
      ) : (
        <View style={{ gap: space.md }}>
          {revisions.map((rev) => (
            <View
              key={rev.id}
              style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: rev.overdue ? c.liveBg : c.infoBg },
                  ]}>
                  <AppText
                    variant="small"
                    style={{
                      color: rev.overdue ? c.dangerFg : c.infoFg,
                      fontWeight: '700',
                      fontSize: 11,
                    }}>
                    Stage {rev.interval_stage} · {rev.overdue ? 'OVERDUE' : 'DUE'}
                  </AppText>
                </View>
                {rev.topic_name ? (
                  <AppText variant="small" muted style={{ flex: 1 }} numberOfLines={1}>
                    {rev.topic_name}
                  </AppText>
                ) : null}
              </View>

              <AppText style={{ fontWeight: '600', marginVertical: space.xs }}>
                {rev.question_text || `${rev.source_type} revision item`}
              </AppText>

              <AppText variant="small" muted style={{ marginBottom: space.sm }}>
                Due:{' '}
                {new Date(rev.due_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </AppText>

              <Button
                title="Complete Review"
                onPress={() => completeRevMut.mutate(rev.id)}
                loading={completeRevMut.isPending}
              />
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.md,
  },
  backBtn: {
    padding: 6,
  },
  tabRow: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 4,
    marginBottom: space.md,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: space.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  filterChip: {
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
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
});

