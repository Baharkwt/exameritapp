import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  CanonicalTopic,
  getCanonicalSyllabus,
  getMyTopicProgress,
  getTopicContent,
  TopicContentItem,
} from '@/api/learning';
import {
  AppText,
  Badge,
  Card,
  Chip,
  EmptyView,
  ErrorView,
  IconTile,
  LoadingView,
  ProgressBar,
  Screen,
  ScreenHeader,
  Segmented,
} from '@/components/ui/kit';
import { ExamSwitcher } from '@/components/ExamSwitcher';
import { useActiveExam } from '@/features/exam/active-exam';
import { radius, space, useColors } from '@/theme';

export default function KnowYourSyllabusScreen() {
  const c = useColors();

  const { targets, examId: activeExamId } = useActiveExam();
  const [selectedStageId, setSelectedStageId] = useState<number | null>(null);
  const [activeTopic, setActiveTopic] = useState<CanonicalTopic | null>(null);
  const [level, setLevel] = useState<'FOUNDATION' | 'CORE' | 'ADVANCED'>('CORE');

  const examId = activeExamId ?? '';

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
      <ScreenHeader title="Syllabus" subtitle="Stage-wise topics and your mastery" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/learn'))} />

      {targets.length === 0 ? (
        <EmptyView
          title="Select a Target Exam First"
          message="Add a target exam on the Home screen to inspect its official syllabus tree."
        />
      ) : (
        <>
          <ExamSwitcher />

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
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 6 }}>
                {stages.map((st) => (
                  <Chip key={st.id} label={st.name} selected={activeStage?.id === st.id} onPress={() => setSelectedStageId(st.id)} />
                ))}
              </ScrollView>

              {/* Subjects & Topics */}
              <View style={{ gap: space.md }}>
                {(activeStage?.subjects ?? []).map((subj) => (
                  <Card key={subj.id} style={{ paddingVertical: space.md }}>
                    <View style={{ marginBottom: space.sm, gap: 6 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: c.text, fontSize: 17, fontWeight: '800', flex: 1 }}>{subj.name}</Text>
                        <Text style={{ color: c.textMuted, fontWeight: '700', fontSize: 12 }}>
                          {subj.topics.filter((tp) => ['completed', 'mastered'].includes(progressByTopicId.get(tp.id) ?? '')).length}/{subj.topics.length}
                        </Text>
                      </View>
                      <ProgressBar
                        value={
                          subj.topics.filter((tp) => ['completed', 'mastered'].includes(progressByTopicId.get(tp.id) ?? '')).length /
                          Math.max(1, subj.topics.length)
                        }
                        color={c.success}
                      />
                    </View>

                    {subj.topics.map((top, idx) => {
                      const state = progressByTopicId.get(top.id) ?? 'not_started';
                      return (
                        <Pressable
                          key={top.id}
                          onPress={() => setActiveTopic(top)}
                          style={[
                            styles.topicRow,
                            idx > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border } : null,
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
                          <Badge
                            label={state.replace('_', ' ')}
                            tone={state === 'completed' || state === 'mastered' ? 'success' : state === 'learning' ? 'info' : 'muted'}
                          />
                        </Pressable>
                      );
                    })}
                  </Card>
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
              <Text style={{ color: c.text, fontSize: 19, fontWeight: '800', flex: 1, letterSpacing: -0.3 }}>
                {activeTopic?.name}
              </Text>
              <Pressable accessibilityLabel="Close" onPress={() => setActiveTopic(null)} hitSlop={10}>
                <Ionicons name="close" size={24} color={c.text} />
              </Pressable>
            </View>

            <View style={{ marginVertical: space.md }}>
              <Segmented
                value={level}
                onChange={setLevel}
                options={[
                  { key: 'FOUNDATION', label: 'Foundation' },
                  { key: 'CORE', label: 'Core' },
                  { key: 'ADVANCED', label: 'Advanced' },
                ]}
              />
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
                    style={styles.topicRow}>
                    <IconTile
                      icon={item.type === 'TEST' ? 'document-text' : item.type === 'PDF' ? 'document-attach' : 'play-circle'}
                      color={c.primary}
                      bg={c.primarySoft}
                      size={38}
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
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
    gap: space.sm,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
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

