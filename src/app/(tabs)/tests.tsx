import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { getCategories, getExamPublishedTests } from '@/api/catalog';
import { getExamProgress } from '@/api/dashboard';
import { getStudentCategories, getStudentTargets } from '@/api/student';
import { FreeQuizItem, getFreeQuizzes } from '@/api/tests';
import { AppText, Button, EmptyView, ErrorView, LoadingView, Screen } from '@/components/ui/kit';
import { radius, space, useColors } from '@/theme';

export default function TestsHubScreen() {
  const c = useColors();

  const myCatsQ = useQuery({ queryKey: ['student-categories'], queryFn: getStudentCategories });
  const myTargetsQ = useQuery({ queryKey: ['student-targets'], queryFn: getStudentTargets });
  const allCatsQ = useQuery({ queryKey: ['categories'], queryFn: getCategories });

  const [tabMode, setTabMode] = useState<'mocks' | 'quizzes'>('mocks');
  const [selectedTargetExamId, setSelectedTargetExamId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | undefined>(undefined);
  const [selectedFormat, setSelectedFormat] = useState<string | undefined>(undefined);

  const targets = useMemo(() => myTargetsQ.data ?? [], [myTargetsQ.data]);
  const activeExamId = useMemo(
    () => selectedTargetExamId ?? targets[0]?.id ?? '',
    [selectedTargetExamId, targets],
  );

  const activeCategoryId = useMemo(() => {
    if (selectedCategoryId) return selectedCategoryId;
    const studentCat = myCatsQ.data?.categories[0]?.categoryId;
    if (studentCat) return studentCat;
    return allCatsQ.data?.find((cat) => cat.exam_count > 0)?.id ?? 'banking';
  }, [selectedCategoryId, myCatsQ.data, allCatsQ.data]);

  const mocksQ = useQuery({
    queryKey: ['exam-published-tests', activeExamId],
    queryFn: () => getExamPublishedTests(activeExamId),
    enabled: tabMode === 'mocks' && !!activeExamId,
  });

  const progressQ = useQuery({
    queryKey: ['exam-progress', activeExamId],
    queryFn: () => getExamProgress(activeExamId),
    enabled: tabMode === 'mocks' && !!activeExamId,
  });

  const freeQuizzesQ = useQuery({
    queryKey: ['free-quizzes', activeCategoryId, selectedSubject, selectedFormat],
    queryFn: () =>
      getFreeQuizzes({
        category: activeCategoryId,
        subject: selectedSubject,
        format: selectedFormat,
        page: 1,
        pageSize: 30,
      }),
    enabled: tabMode === 'quizzes' && !!activeCategoryId,
  });

  const progressMap = useMemo(() => {
    const map = new Map<
      string,
      {
        completed: boolean;
        in_progress: boolean;
        latest_score: string | number | null;
        max_score: string | number | null;
      }
    >();
    for (const row of progressQ.data ?? []) {
      map.set(row.test_id, row);
    }
    return map;
  }, [progressQ.data]);

  if (myCatsQ.isLoading || myTargetsQ.isLoading) return <LoadingView />;

  const refreshing = mocksQ.isRefetching || freeQuizzesQ.isRefetching;
  const onRefresh = () => {
    if (tabMode === 'mocks') {
      mocksQ.refetch();
      progressQ.refetch();
    } else {
      freeQuizzesQ.refetch();
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.headerRow}>
        <AppText variant="title">Tests & Quizzes</AppText>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Pressable
            onPress={() => router.push('/exams')}
            style={[styles.browseBtn, { backgroundColor: c.surface, borderColor: c.border }]}>
            <AppText variant="small" style={{ color: c.primary, fontWeight: '700' }}>
              All Exams
            </AppText>
          </Pressable>
          <Pressable
            onPress={() => router.push('/live-tests')}
            style={[styles.browseBtn, { backgroundColor: c.liveBg, borderColor: c.danger }]}>
            <Ionicons name="radio-outline" size={14} color={c.danger} />
            <AppText variant="small" style={{ color: c.danger, fontWeight: '700' }}>
              Live
            </AppText>
          </Pressable>
        </View>
      </View>

      {/* Mode Switcher */}
      <View style={[styles.segmented, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Pressable
          onPress={() => setTabMode('mocks')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tabMode === 'mocks' }}
          style={[
            styles.segmentBtn,
            tabMode === 'mocks' ? { backgroundColor: c.primary } : null,
          ]}>
          <AppText
            variant="small"
            style={{
              color: tabMode === 'mocks' ? c.primaryText : c.text,
              fontWeight: '700',
            }}>
            Exam Mock Tests
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => setTabMode('quizzes')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tabMode === 'quizzes' }}
          style={[
            styles.segmentBtn,
            tabMode === 'quizzes' ? { backgroundColor: c.primary } : null,
          ]}>
          <AppText
            variant="small"
            style={{
              color: tabMode === 'quizzes' ? c.primaryText : c.text,
              fontWeight: '700',
            }}>
            Daily Quizzes & Drills
          </AppText>
        </Pressable>
      </View>

      {tabMode === 'mocks' ? (
        <>
          {targets.length === 0 ? (
            <EmptyView
              title="No Target Exam Selected"
              message="Choose up to 3 target exams to see their full-length mocks and sectional tests."
            />
          ) : (
            <>
              {/* Target Exam Selector */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginVertical: space.sm }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {targets.map((t) => {
                    const active = activeExamId === t.id;
                    return (
                      <Pressable
                        key={t.id}
                        onPress={() => setSelectedTargetExamId(t.id)}
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

              {mocksQ.isLoading ? (
                <LoadingView />
              ) : mocksQ.isError ? (
                <ErrorView message={mocksQ.error.message} onRetry={() => mocksQ.refetch()} />
              ) : (mocksQ.data ?? []).length === 0 ? (
                <EmptyView
                  title="No published tests yet"
                  message="Try switching to Daily Quizzes & Drills or exploring another exam."
                />
              ) : (
                <View style={{ gap: 6 }}>
                  {(mocksQ.data ?? []).map((t) => {
                    const prog = progressMap.get(t.id);
                    return (
                      <Pressable
                        key={t.id}
                        onPress={() => router.push({ pathname: '/tests/[id]', params: { id: t.id } })}
                        style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
                        <View style={{ flex: 1, gap: 2 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <AppText style={{ fontWeight: '600', flex: 1 }} numberOfLines={1}>
                              {t.name}
                            </AppText>
                            <View
                              style={[
                                styles.tierBadge,
                                { backgroundColor: t.access_tier === 'free' ? c.successBg : c.warningBg },
                              ]}>
                              <AppText
                                variant="small"
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: '700',
                                  color: t.access_tier === 'free' ? c.successFg : c.warningFg,
                                }}>
                                {t.access_tier === 'free' ? 'FREE' : 'PRO'}
                              </AppText>
                            </View>
                          </View>
                          <AppText variant="small" muted>
                            {[
                              t.stage_name,
                              t.format_label,
                              `${t.question_count} Qs`,
                              `${t.duration_minutes}m`,
                              `${t.max_score} marks`,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </AppText>
                          {prog?.completed ? (
                            <AppText variant="small" style={{ color: c.success, fontWeight: '600' }}>
                              ✓ Score: {prog.latest_score ?? 0}/{prog.max_score ?? t.max_score}
                            </AppText>
                          ) : prog?.in_progress ? (
                            <AppText variant="small" style={{ color: c.primary, fontWeight: '600' }}>
                              ● Resume Attempt
                            </AppText>
                          ) : null}
                        </View>
                        <View style={[styles.startPill, { backgroundColor: c.bg }]}>
                          <AppText
                            variant="small"
                            style={{ color: c.primary, fontWeight: '700', fontSize: 11 }}>
                            {prog?.completed ? 'Review' : prog?.in_progress ? 'Resume' : 'Start'}
                          </AppText>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </>
          )}
          <View style={{ marginTop: space.md }}>
            <Button title="Explore All Exams" variant="outline" onPress={() => router.push('/exams')} />
          </View>
        </>
      ) : (
        <>
          {/* Category Picker for Free Quizzes */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: space.sm }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {(myCatsQ.data?.categories.length
                ? myCatsQ.data.categories.map((sc) => ({ id: sc.categoryId, name: sc.name }))
                : (allCatsQ.data ?? [])
                    .filter((cat) => cat.exam_count > 0)
                    .map((cat) => ({ id: cat.id, name: cat.name }))
              ).map((cat) => {
                const active = activeCategoryId === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => {
                      setSelectedCategoryId(cat.id);
                      setSelectedSubject(undefined);
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
                      {cat.name}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Subject & Speed Format Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pressable
                onPress={() => {
                  setSelectedSubject(undefined);
                  setSelectedFormat(undefined);
                }}
                style={[
                  styles.smallChip,
                  {
                    backgroundColor: !selectedSubject && !selectedFormat ? c.primary : c.surface,
                    borderColor: c.border,
                  },
                ]}>
                <AppText
                  variant="small"
                  style={{ color: !selectedSubject && !selectedFormat ? c.primaryText : c.text }}>
                  All
                </AppText>
              </Pressable>
              <Pressable
                onPress={() => setSelectedFormat(selectedFormat === 'speed' ? undefined : 'speed')}
                style={[
                  styles.smallChip,
                  {
                    backgroundColor: selectedFormat === 'speed' ? c.primary : c.surface,
                    borderColor: c.border,
                  },
                ]}>
                <AppText
                  variant="small"
                  style={{ color: selectedFormat === 'speed' ? c.primaryText : c.text }}>
                  ⚡ Speed Drills
                </AppText>
              </Pressable>
              {(freeQuizzesQ.data?.subjects ?? []).map((subj) => {
                const active = selectedSubject === subj.key;
                return (
                  <Pressable
                    key={subj.key}
                    onPress={() => setSelectedSubject(active ? undefined : subj.key)}
                    style={[
                      styles.smallChip,
                      {
                        backgroundColor: active ? c.primary : c.surface,
                        borderColor: c.border,
                      },
                    ]}>
                    <AppText variant="small" style={{ color: active ? c.primaryText : c.text }}>
                      {subj.label} ({subj.count})
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {freeQuizzesQ.isLoading ? (
            <LoadingView />
          ) : freeQuizzesQ.isError ? (
            <ErrorView message={freeQuizzesQ.error.message} onRetry={() => freeQuizzesQ.refetch()} />
          ) : (freeQuizzesQ.data?.quizzes ?? []).length === 0 ? (
            <EmptyView
              title="No Free Quizzes Available"
              message="No quizzes match your current filter in this category."
            />
          ) : (
            <View style={{ gap: 6 }}>
              {(freeQuizzesQ.data?.quizzes ?? []).map((q: FreeQuizItem) => (
                <Pressable
                  key={q.id}
                  onPress={() => router.push({ pathname: '/tests/[id]', params: { id: q.id } })}
                  style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      {q.isFeatured ? (
                        <AppText variant="small" style={{ color: c.warning, fontWeight: '700' }}>
                          ★
                        </AppText>
                      ) : null}
                      <AppText style={{ fontWeight: '600', flex: 1 }} numberOfLines={1}>
                        {q.title}
                      </AppText>
                    </View>
                    <AppText variant="small" muted>
                      {[
                        q.subjectLabel,
                        q.formatLabel,
                        `${q.questions} Qs`,
                        `${q.durationMin}m`,
                        `${q.marks} marks`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </AppText>
                    {q.attemptState === 'completed' ? (
                      <AppText variant="small" style={{ color: c.success, fontWeight: '600' }}>
                        ✓ Score: {q.lastScore ?? 0}/{q.lastMaxScore ?? q.marks}
                      </AppText>
                    ) : q.attemptState === 'in_progress' ? (
                      <AppText variant="small" style={{ color: c.primary, fontWeight: '600' }}>
                        ● Resume
                      </AppText>
                    ) : null}
                  </View>
                  <View style={[styles.startPill, { backgroundColor: c.bg }]}>
                    <AppText variant="small" style={{ color: c.primary, fontWeight: '700', fontSize: 11 }}>
                      {q.attemptState === 'completed'
                        ? 'Review'
                        : q.attemptState === 'in_progress'
                          ? 'Resume'
                          : 'Start'}
                    </AppText>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
    gap: space.sm,
  },
  browseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  smallChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: space.sm,
  },
  tierBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  startPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
  },
});
