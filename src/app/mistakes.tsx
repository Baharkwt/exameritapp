import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  completeRevisionItem,
  deleteMistake,
  getMistakes,
  getRevisionQueue,
  updateMistake,
} from '@/api/analytics';
import { AppText, Badge, Button, Card, Chip, EmptyView, ErrorView, LoadingView, Screen, ScreenHeader, Segmented } from '@/components/ui/kit';
import { space, useColors } from '@/theme';

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
      <ScreenHeader title="Mistake notebook" subtitle="Turn wrong answers into lasting memory" />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { key: 'mistakes', label: `Mistakes · ${mistakes.length}` },
          { key: 'revision', label: `Revision · ${revisions.length}` },
        ]}
      />

      {tab === 'mistakes' ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -16 }}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 10 }}>
            {(['ALL', 'UNRESOLVED', 'NEEDS_PRACTICE', 'RESOLVED'] as const).map((st) => (
              <Chip key={st} label={st.replace('_', ' ')} selected={statusFilter === st} onPress={() => setStatusFilter(st)} />
            ))}
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
                  <Card key={item.id} style={{ gap: space.xs }}>
                    <View style={styles.badgeRow}>
                      <Badge label={item.resolution_status} tone={isResolved ? 'success' : 'danger'} />
                      {item.subject_name || item.topic_name ? (
                        <AppText variant="small" muted style={{ flex: 1 }} numberOfLines={1}>
                          {[item.subject_name, item.topic_name].filter(Boolean).join(' · ')}
                        </AppText>
                      ) : null}
                      <Pressable
                        hitSlop={10}
                        accessibilityLabel="Delete mistake"
                        onPress={() =>
                          Alert.alert('Remove Mistake', 'Delete this question from your mistake notebook?', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: () => deleteMut.mutate(item.id) },
                          ])
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
                  </Card>
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
            <Card key={rev.id} style={{ gap: space.xs }}>
              <View style={styles.badgeRow}>
                <Badge label={`Stage ${rev.interval_stage} · ${rev.overdue ? 'overdue' : 'due'}`} tone={rev.overdue ? 'danger' : 'info'} />
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
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
