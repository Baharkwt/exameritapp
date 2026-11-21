import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { getCategories, getExamPublishedTests } from '@/api/catalog';
import { getExamProgress } from '@/api/dashboard';
import { getStudentCategories, getStudentTargets } from '@/api/student';
import { FreeQuizItem, getFreeQuizzes } from '@/api/tests';
import {
  AppText,
  Badge,
  Button,
  Card,
  Chip,
  EmptyView,
  ErrorView,
  IconTile,
  LoadingView,
  Screen,
  Segmented,
  Skeleton,
} from '@/components/ui/kit';
import { ExamSwitcher } from '@/components/ExamSwitcher';
import { useActiveExam } from '@/features/exam/active-exam';
import { space, useColors } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function TestCard({
  title,
  meta,
  state,
  score,
  tier,
  featured,
  onPress,
}: {
  title: string;
  meta: string;
  state: 'new' | 'in_progress' | 'completed';
  score?: string;
  tier?: 'free' | 'pro';
  featured?: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const icon: IconName = state === 'completed' ? 'checkmark-circle' : state === 'in_progress' ? 'play-circle' : 'document-text';
  const [fg, bg] =
    state === 'completed' ? [c.success, c.successBg] : state === 'in_progress' ? [c.primary, c.primarySoft] : [c.textMuted, c.skeleton];
  const cta = state === 'completed' ? 'Review' : state === 'in_progress' ? 'Resume' : 'Start';
  return (
    <Card onPress={onPress} accessibilityLabel={`${title}, ${cta}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }}>
      <IconTile icon={icon} color={fg} bg={bg} size={44} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {featured ? <Ionicons name="star" size={13} color={c.star} /> : null}
          <AppText style={{ fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>
            {title}
          </AppText>
          {tier ? <Badge label={tier === 'free' ? 'Free' : 'Pro'} tone={tier === 'free' ? 'success' : 'warning'} /> : null}
        </View>
        <AppText variant="small" muted numberOfLines={1}>
          {meta}
        </AppText>
        {score ? (
          <Text style={{ color: c.success, fontWeight: '800', fontSize: 12.5 }}>Score {score}</Text>
        ) : state === 'in_progress' ? (
          <Text style={{ color: c.primary, fontWeight: '800', fontSize: 12.5 }}>In progress</Text>
        ) : null}
      </View>
      <Text style={{ color: c.primary, fontWeight: '800', fontSize: 13 }}>{cta}</Text>
    </Card>
  );
}

export default function TestsHubScreen() {

  const myCatsQ = useQuery({ queryKey: ['student-categories'], queryFn: getStudentCategories });
  const myTargetsQ = useQuery({ queryKey: ['student-targets'], queryFn: getStudentTargets });
  const allCatsQ = useQuery({ queryKey: ['categories'], queryFn: getCategories });

  const [tabMode, setTabMode] = useState<'mocks' | 'quizzes'>('mocks');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | undefined>(undefined);
  const [selectedFormat, setSelectedFormat] = useState<string | undefined>(undefined);

  const targets = useMemo(() => myTargetsQ.data ?? [], [myTargetsQ.data]);
  const { examId } = useActiveExam();
  const activeExamId = examId ?? '';

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

  const chipScroll = { marginHorizontal: -16 } as const;
  const chipRow = { paddingHorizontal: 16, gap: 8, paddingVertical: 6 } as const;
  const categoryChips = myCatsQ.data?.categories.length
    ? myCatsQ.data.categories.map((sc) => ({ id: sc.categoryId, name: sc.name }))
    : (allCatsQ.data ?? []).filter((cat) => cat.exam_count > 0).map((cat) => ({ id: cat.id, name: cat.name }));

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
        <View>
          <AppText variant="title">Practice</AppText>
          <AppText variant="small" muted>
            Mocks, quizzes and live tests
          </AppText>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label="Live" icon="radio" onPress={() => router.push('/live-tests')} />
          <Chip label="Exams" icon="school" onPress={() => router.push('/exams')} />
        </View>
      </View>

      <Segmented
        value={tabMode}
        onChange={setTabMode}
        options={[
          { key: 'mocks', label: 'Mock tests' },
          { key: 'quizzes', label: 'Quizzes & drills' },
        ]}
      />

      {tabMode === 'mocks' ? (
        <>
          {targets.length === 0 ? (
            <EmptyView
              title="No target exam yet"
              message="Choose up to 3 target exams to see their full-length mocks and sectional tests."
            />
          ) : (
            <>
              <ExamSwitcher />

              {mocksQ.isLoading ? (
                <ListSkeleton />
              ) : mocksQ.isError ? (
                <ErrorView message={mocksQ.error.message} onRetry={() => mocksQ.refetch()} />
              ) : (mocksQ.data ?? []).length === 0 ? (
                <EmptyView title="No published tests yet" message="Try Quizzes & drills or explore another exam." />
              ) : (
                <View style={{ gap: space.sm, marginTop: space.sm }}>
                  {(mocksQ.data ?? []).map((t) => {
                    const prog = progressMap.get(t.id);
                    const state = prog?.completed ? 'completed' : prog?.in_progress ? 'in_progress' : 'new';
                    return (
                      <TestCard
                        key={t.id}
                        title={t.name}
                        meta={[t.stage_name, t.format_label, `${t.question_count} Qs`, `${t.duration_minutes}m`, `${t.max_score} marks`]
                          .filter(Boolean)
                          .join(' · ')}
                        state={state}
                        score={prog?.completed ? `${prog.latest_score ?? 0}/${prog.max_score ?? t.max_score}` : undefined}
                        tier={t.access_tier === 'free' ? 'free' : 'pro'}
                        onPress={() => router.push({ pathname: '/tests/[id]', params: { id: t.id } })}
                      />
                    );
                  })}
                </View>
              )}
            </>
          )}
          <View style={{ marginTop: space.lg }}>
            <Button title="Explore all exams" variant="outline" onPress={() => router.push('/exams')} />
          </View>
        </>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={chipScroll} contentContainerStyle={chipRow}>
            {categoryChips.map((cat) => (
              <Chip
                key={cat.id}
                label={cat.name}
                selected={activeCategoryId === cat.id}
                onPress={() => {
                  setSelectedCategoryId(cat.id);
                  setSelectedSubject(undefined);
                }}
              />
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={chipScroll} contentContainerStyle={chipRow}>
            <Chip
              label="All"
              selected={!selectedSubject && !selectedFormat}
              onPress={() => {
                setSelectedSubject(undefined);
                setSelectedFormat(undefined);
              }}
            />
            <Chip
              label="Speed drills"
              icon="flash"
              selected={selectedFormat === 'speed'}
              onPress={() => setSelectedFormat(selectedFormat === 'speed' ? undefined : 'speed')}
            />
            {(freeQuizzesQ.data?.subjects ?? []).map((subj) => (
              <Chip
                key={subj.key}
                label={`${subj.label} · ${subj.count}`}
                selected={selectedSubject === subj.key}
                onPress={() => setSelectedSubject(selectedSubject === subj.key ? undefined : subj.key)}
              />
            ))}
          </ScrollView>

          {freeQuizzesQ.isLoading ? (
            <ListSkeleton />
          ) : freeQuizzesQ.isError ? (
            <ErrorView message={freeQuizzesQ.error.message} onRetry={() => freeQuizzesQ.refetch()} />
          ) : (freeQuizzesQ.data?.quizzes ?? []).length === 0 ? (
            <EmptyView title="No quizzes here" message="No quizzes match your current filter in this category." />
          ) : (
            <View style={{ gap: space.sm, marginTop: space.sm }}>
              {(freeQuizzesQ.data?.quizzes ?? []).map((q: FreeQuizItem) => (
                <TestCard
                  key={q.id}
                  title={q.title}
                  featured={q.isFeatured}
                  meta={[q.subjectLabel, q.formatLabel, `${q.questions} Qs`, `${q.durationMin}m`, `${q.marks} marks`]
                    .filter(Boolean)
                    .join(' · ')}
                  state={q.attemptState === 'completed' ? 'completed' : q.attemptState === 'in_progress' ? 'in_progress' : 'new'}
                  score={q.attemptState === 'completed' ? `${q.lastScore ?? 0}/${q.lastMaxScore ?? q.marks}` : undefined}
                  onPress={() => router.push({ pathname: '/tests/[id]', params: { id: q.id } })}
                />
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

function ListSkeleton() {
  return (
    <View style={{ gap: 10, marginTop: 8 }}>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} height={76} radiusPx={26} />
      ))}
    </View>
  );
}
