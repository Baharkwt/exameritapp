import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  CanonicalTopic,
  getCanonicalSyllabus,
  getMyTopicProgress,
  getTopicContent,
  TopicContentItem,
} from '@/api/learning';
import { getStudentTargets } from '@/api/student';
import { AppText, EmptyView, ErrorView, LoadingView, Screen } from '@/components/ui/kit';
import { radius, space, useColors } from '@/theme';

export default function KnowYourSyllabusScreen() {
  const c = useColors();

  const targetsQ = useQuery({ queryKey: ['student-targets'], queryFn: getStudentTargets });
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<number | null>(null);
  const [activeTopic, setActiveTopic] = useState<CanonicalTopic | null>(null);
  const [level, setLevel] = useState<'FOUNDATION' | 'CORE' | 'ADVANCED'>('CORE');

  const targets = useMemo(() => targetsQ.data ?? [], [targetsQ.data]);
  const examId = selectedExamId ?? targets[0]?.id ?? '';

  const syllabusQ = useQuery({
    queryKey: ['canonical-syllabus', examId],
    queryFn: () => getCanonicalSyllabus(examId),
    enabled: !!examId,
  });

  const progressQ = useQuery({
    queryKey: ['topic-progress', examId],
    queryFn: () => getMyTopicProgress(examId),
    enabled: !!examId,
  });

  const topicContentQ = useQuery({
    queryKey: ['topic-content', activeTopic?.id, level],
    queryFn: () => getTopicContent(activeTopic!.id, level),
    enabled: !!activeTopic,
  });

  const progressByTopicId = useMemo(() => {
    const map = new Map<number, string>();
    for (const row of progressQ.data ?? []) {
      map.set(row.topicId, row.state);
    }
    return map;
  }, [progressQ.data]);

  if (targetsQ.isLoading) return <LoadingView />;

  const stages = syllabusQ.data?.stages ?? [];
  const activeStage = stages.find((s) => s.id === selectedStageId) ?? stages[0] ?? null;

  function openContentItem(item: TopicContentItem) {
    if (item.type === 'TEST' && item.testId) {
      setActiveTopic(null);
      router.push({ pathname: '/tests/[id]', params: { id: item.testId } });
      return;
    }
    if (item.url) {
      Linking.openURL(item.url).catch(() => Alert.alert('Error', 'Could not open URL'));
    } else {
      Alert.alert('Locked Content', 'This study item requires an active Pro plan.');
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
            Know Your Syllabus
          </AppText>
          <AppText variant="small" muted>
            Canonical stage-wise topics & derived mastery
          </AppText>
        </View>
      </View>

      {targets.length === 0 ? (
        <EmptyView
          title="Select a Target Exam First"
          message="Add a target exam on the Home screen to inspect its official syllabus tree."
        />
      ) : (
        <>
          {/* Target Exam Picker */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.sm }}>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {targets.map((t) => {
                const active = examId === t.id;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => {
                      setSelectedExamId(t.id);
                      setSelectedStageId(null);
                    }}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? c.primary : c.surface,
                        borderColor: active ? c.primary : c.border,
                      },
                    ]}>
                    <AppText
                      variant="small"
                      style={{ color: active ? c.primaryText : c.text, fontWeight: '600' }}>
                      {t.name}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {syllabusQ.isLoading ? (
            <LoadingView />
          ) : syllabusQ.isError ? (
            <ErrorView message={syllabusQ.error.message} onRetry={() => syllabusQ.refetch()} />
          ) : !syllabusQ.data?.available || stages.length === 0 ? (
            <EmptyView
              title="Syllabus Being Authored"
              message="The canonical topic breakdown for this exam is not published yet."
            />
          ) : (
            <>
              {/* Stage Switcher */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.md }}>
                <View style={{ flexDirection: 'row', gap: space.xs }}>
                  {stages.map((st) => {
                    const active = activeStage?.id === st.id;
                    return (
                      <Pressable
                        key={st.id}
                        onPress={() => setSelectedStageId(st.id)}
                        style={[
                          styles.stageChip,
                          {
                            backgroundColor: active ? c.primary : c.surface,
                            borderColor: active ? c.primary : c.border,
                          },
                        ]}>
                        <AppText
                          variant="small"
                          style={{ color: active ? c.primaryText : c.text, fontWeight: '700' }}>
                          {st.name}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Subjects & Topics */}
              <View style={{ gap: space.md }}>
                {(activeStage?.subjects ?? []).map((subj) => (
                  <View
                    key={subj.id}
                    style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
                    <AppText variant="heading" style={{ marginBottom: space.sm }}>
                      {subj.name} ({subj.topics.length} topics)
                    </AppText>

                    {subj.topics.map((top, idx) => {
                      const state = progressByTopicId.get(top.id) ?? 'not_started';
                      return (
                        <Pressable
                          key={top.id}
                          onPress={() => setActiveTopic(top)}
                          style={[
                            styles.topicRow,
                            idx > 0 ? { borderTopWidth: 1, borderTopColor: c.border } : null,
                          ]}>
                          <View style={{ flex: 1 }}>
                            <AppText style={{ fontWeight: '600' }}>{top.name}</AppText>
                            <AppText variant="small" muted>
                              {[
                                top.importance ? `Importance: ${top.importance}` : null,
                                top.expectedDifficulty ? `Difficulty: ${top.expectedDifficulty}` : null,
                              ]
                                .filter(Boolean)
                                .join(' · ') || 'Tap to view learning resources'}
                            </AppText>
                          </View>
                          <View
                            style={[
                              styles.stateBadge,
                              {
                                backgroundColor:
                                  state === 'completed' || state === 'mastered'
                                    ? c.successBg
                                    : state === 'learning'
                                      ? c.infoBg
                                      : c.bg,
                              },
                            ]}>
                            <AppText
                              variant="small"
                              style={{
                                fontSize: 11,
                                fontWeight: '700',
                                color:
                                  state === 'completed' || state === 'mastered'
                                    ? c.successFg
                                    : state === 'learning'
                                      ? c.infoFg
                                      : c.textMuted,
                              }}>
                              {state.replace('_', ' ').toUpperCase()}
                            </AppText>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            </>
          )}
        </>
      )}

      {/* Topic Level Content Modal */}
      <Modal visible={!!activeTopic} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: c.surface }]}>
            <View style={styles.modalHeader}>
              <AppText variant="heading" style={{ flex: 1 }}>
                {activeTopic?.name}
              </AppText>
              <Pressable onPress={() => setActiveTopic(null)}>
                <Ionicons name="close" size={24} color={c.text} />
              </Pressable>
            </View>

            {/* Level Selector (FOUNDATION / CORE / ADVANCED) */}
            <View style={{ flexDirection: 'row', gap: space.xs, marginVertical: space.sm }}>
              {(['FOUNDATION', 'CORE', 'ADVANCED'] as const).map((lvl) => (
                <Pressable
                  key={lvl}
                  onPress={() => setLevel(lvl)}
                  style={[
                    styles.stageChip,
                    {
                      flex: 1,
                      alignItems: 'center',
                      backgroundColor: level === lvl ? c.primary : c.bg,
                      borderColor: level === lvl ? c.primary : c.border,
                    },
                  ]}>
                  <AppText
                    variant="small"
                    style={{ color: level === lvl ? c.primaryText : c.text, fontWeight: '700' }}>
                    {lvl}
                  </AppText>
                </Pressable>
              ))}
            </View>

            {topicContentQ.isLoading ? (
              <LoadingView />
            ) : (topicContentQ.data?.items ?? []).length === 0 ? (
              <EmptyView
                title="No Published Items at This Level"
                message="Try switching between Foundation, Core, and Advanced."
              />
            ) : (
              <ScrollView style={{ marginVertical: space.sm }}>
                {(topicContentQ.data?.items ?? []).map((item, i) => (
                  <Pressable
                    key={`${item.type}-${i}`}
                    onPress={() => openContentItem(item)}
                    style={[styles.topicRow, { borderBottomWidth: 1, borderBottomColor: c.border }]}>
                    <Ionicons
                      name={
                        item.type === 'TEST'
                          ? 'document-text-outline'
                          : item.type === 'PDF'
                            ? 'document-attach-outline'
                            : 'play-circle-outline'
                      }
                      size={22}
                      color={c.primary}
                    />
                    <View style={{ flex: 1, marginLeft: space.sm }}>
                      <AppText style={{ fontWeight: '600' }}>{item.title}</AppText>
                      <AppText variant="small" muted>
                        {item.typeLabel}
                        {item.questionCount ? ` · ${item.questionCount} Qs` : ''}
                        {item.durationMinutes ? ` · ${item.durationMinutes} mins` : ''}
                      </AppText>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  stageChip: {
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
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
    gap: space.sm,
  },
  stateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.lg,
    minHeight: 340,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

