import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { toApiError } from '@/api/client';
import {
  CourseItem,
  downloadMaterial,
  getCourses,
  getCurrentAffairs,
  getEnrolledCourses,
  getMaterials,
  getMyTopicProgress,
  getVocabularyPractice,
  StudyMaterial,
} from '@/api/learning';
import {
  AppText,
  Badge,
  Card,
  EmptyView,
  ErrorView,
  IconTile,
  ProgressBar,
  ProgressRing,
  Screen,
  SectionHeader,
  Segmented,
  Skeleton,
} from '@/components/ui/kit';
import { ExamSwitcher } from '@/components/ExamSwitcher';
import { useActiveExam } from '@/features/exam/active-exam';
import { elevation, radius, space, useColors } from '@/theme';

function ListSkeleton() {
  return (
    <View style={{ gap: 10, marginTop: 12 }}>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} height={72} radiusPx={26} />
      ))}
    </View>
  );
}

export default function LearnHubScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const { exam } = useActiveExam();

  // Shelves
  const shelfEnrolledQ = useQuery({ queryKey: ['courses-enrolled'], queryFn: getEnrolledCourses });
  const progressQ = useQuery({
    queryKey: ['topic-progress', exam?.id ?? 'all'],
    queryFn: () => getMyTopicProgress(exam?.id),
  });
  const wordQ = useQuery({ queryKey: ['vocab-practice'], queryFn: getVocabularyPractice });
  const newsQ = useQuery({ queryKey: ['current-affairs-shelf'], queryFn: () => getCurrentAffairs({ limit: 4 }) });

  const topicRows = progressQ.data ?? [];
  const doneTopics = topicRows.filter((t) => t.state === 'completed' || t.state === 'mastered').length;
  const learningTopics = topicRows.filter((t) => t.state === 'learning').length;
  const continueCourse = (shelfEnrolledQ.data ?? []).find((cr) => Number(cr.progressPct ?? 0) < 100);
  const word = wordQ.data?.[0];
  const articles = newsQ.data?.articles ?? [];

  const [tab, setTab] = useState<'courses' | 'enrolled' | 'materials'>('courses');
  const [search, setSearch] = useState('');

  const coursesQ = useQuery({
    queryKey: ['courses', search],
    queryFn: () => getCourses({ search: search.trim() || undefined }),
    enabled: tab === 'courses',
  });

  const enrolledQ = useQuery({
    queryKey: ['courses-enrolled'],
    queryFn: getEnrolledCourses,
    enabled: tab === 'enrolled',
  });

  const materialsQ = useQuery({
    queryKey: ['materials', search],
    queryFn: () => getMaterials({ search: search.trim() || undefined }),
    enabled: tab === 'materials',
  });

  async function handleOpenMaterial(m: StudyMaterial) {
    try {
      const updated = await downloadMaterial(m.id);
      await qc.invalidateQueries({ queryKey: ['materials'] });
      const url = updated.fileUrl || m.fileUrl;
      if (url) {
        Linking.openURL(url).catch(() =>
          Alert.alert('Material Ready', `Download recorded for "${m.title}".`),
        );
      } else {
        Alert.alert('Material', 'Download recorded.');
      }
    } catch (e) {
      Alert.alert('Access Restricted', toApiError(e).message);
    }
  }

  const shortcuts = [
    { label: 'Syllabus', sub: 'Topic tracker', icon: 'map', color: c.marked, bg: c.markedBg, to: '/syllabus' },
    { label: 'Daily News', sub: 'Current affairs', icon: 'newspaper', color: c.info, bg: c.infoBg, to: '/current-affairs' },
    { label: 'Vocab', sub: 'Word practice', icon: 'language', color: c.success, bg: c.successBg, to: '/vocabulary' },
  ] as const;

  return (
    <Screen>
      <AppText variant="title">Learn</AppText>
      <AppText variant="small" muted style={{ marginBottom: space.md }}>
        Courses, notes and daily reading
      </AppText>

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {shortcuts.map((s) => (
          <Card
            key={s.label}
            onPress={() => router.push(s.to)}
            accessibilityLabel={s.label}
            style={{ flex: 1, padding: space.md, gap: 8 }}>
            <IconTile icon={s.icon} color={s.color} bg={s.bg} size={38} />
            <View>
              <Text style={{ color: c.text, fontWeight: '800', fontSize: 14 }}>{s.label}</Text>
              <Text style={{ color: c.textMuted, fontSize: 11.5, fontWeight: '600' }} numberOfLines={1}>
                {s.sub}
              </Text>
            </View>
          </Card>
        ))}
      </View>

      {!search ? (
        <>
          {continueCourse ? (
            <>
              <SectionHeader title="Continue learning" />
              <Card
                tone="hero"
                onPress={() => router.push({ pathname: '/courses/[id]', params: { id: String(continueCourse.id) } })}
                style={{ gap: space.md }}>
                <Text style={{ color: c.heroMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>UP NEXT</Text>
                <Text style={{ color: c.heroText, fontSize: 18, fontWeight: '800' }} numberOfLines={2}>
                  {continueCourse.title}
                </Text>
                <ProgressBar value={Number(continueCourse.progressPct ?? 0) / 100} color={c.heroText} track={c.heroSoft} />
                <Text style={{ color: c.heroMuted, fontSize: 12.5, fontWeight: '600' }}>
                  {Number(continueCourse.progressPct ?? 0)}% complete
                </Text>
              </Card>
            </>
          ) : null}

          {topicRows.length > 0 ? (
            <>
              <SectionHeader title="Syllabus progress" action="Open" onAction={() => router.push('/syllabus')} />
              <ExamSwitcher />
              <Card
                onPress={() => router.push('/syllabus')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
                <ProgressRing value={doneTopics / topicRows.length} size={72} stroke={8}>
                  <Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }}>
                    {Math.round((doneTopics / topicRows.length) * 100)}%
                  </Text>
                </ProgressRing>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText style={{ fontWeight: '800' }}>{exam?.name ?? 'Your syllabus'}</AppText>
                  <AppText variant="small" muted>
                    {doneTopics} done · {learningTopics} in progress · {topicRows.length} tracked topics
                  </AppText>
                </View>
              </Card>
            </>
          ) : null}

          {word ? (
            <>
              <SectionHeader title="Word of the day" action="Practice" onAction={() => router.push('/vocabulary')} />
              <Card tone="soft" onPress={() => router.push('/vocabulary')} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: c.primary, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 }}>{word.word}</Text>
                  {word.part_of_speech ? <Badge label={word.part_of_speech} tone="primary" /> : null}
                </View>
                <AppText variant="small">{word.definition}</AppText>
                {word.example_sentence ? (
                  <AppText variant="small" muted style={{ fontStyle: 'italic' }}>
                    “{word.example_sentence}”
                  </AppText>
                ) : null}
              </Card>
            </>
          ) : null}

          {articles.length > 0 ? (
            <>
              <SectionHeader title="Today’s reading" action="See all" onAction={() => router.push('/current-affairs')} />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -16 }}
                contentContainerStyle={{ paddingHorizontal: 16, gap: space.sm, paddingVertical: 4 }}>
                {articles.map((a) => (
                  <Card
                    key={a.id}
                    onPress={() => router.push({ pathname: '/current-affairs/[id]', params: { id: String(a.id) } })}
                    style={{ width: 230, gap: 8, padding: space.md }}>
                    {a.topic || a.category ? <Badge label={String(a.topic ?? a.category)} tone="info" /> : null}
                    <AppText style={{ fontWeight: '700' }} numberOfLines={3}>
                      {a.title}
                    </AppText>
                  </Card>
                ))}
              </ScrollView>
            </>
          ) : null}

          <SectionHeader title="Browse library" />
        </>
      ) : null}

      <View style={[styles.searchBox, { backgroundColor: c.surface }, elevation(c, 1)]}>
        <Ionicons name="search" size={18} color={c.textMuted} />
        <TextInput
          accessibilityLabel="Search courses or materials"
          placeholder="Search courses or PDF materials"
          placeholderTextColor={c.textMuted}
          value={search}
          onChangeText={setSearch}
          style={[styles.searchInput, { color: c.text }]}
        />
        {search ? (
          <Pressable accessibilityLabel="Clear search" onPress={() => setSearch('')} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={c.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { key: 'courses', label: 'Courses' },
          { key: 'enrolled', label: 'My learning' },
          { key: 'materials', label: 'PDFs' },
        ]}
      />

      {tab === 'courses' ? (
        coursesQ.isLoading ? (
          <ListSkeleton />
        ) : coursesQ.isError ? (
          <ErrorView message={coursesQ.error.message} onRetry={() => coursesQ.refetch()} />
        ) : (coursesQ.data?.courses ?? []).length === 0 ? (
          <EmptyView title="No courses found" message="Check back soon for new courses." />
        ) : (
          <View style={{ gap: space.sm, marginTop: space.md }}>
            {(coursesQ.data?.courses ?? []).map((course: CourseItem) => (
              <Card
                key={course.id}
                onPress={() => router.push({ pathname: '/courses/[id]', params: { id: String(course.id) } })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }}>
                <IconTile icon="play-circle" color={c.primary} bg={c.primarySoft} size={46} />
                <View style={{ flex: 1, gap: 3 }}>
                  <AppText style={{ fontWeight: '700' }} numberOfLines={2}>
                    {course.title}
                  </AppText>
                  <AppText variant="small" muted numberOfLines={1}>
                    {[course.category, course.instructorFullName || course.instructorName, course.durationHours ? `${course.durationHours}h` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </AppText>
                </View>
                <Badge label={course.isFree ? 'Free' : `₹${course.price ?? 'Pro'}`} tone={course.isFree ? 'success' : 'warning'} />
              </Card>
            ))}
          </View>
        )
      ) : tab === 'enrolled' ? (
        enrolledQ.isLoading ? (
          <ListSkeleton />
        ) : enrolledQ.isError ? (
          <ErrorView message={enrolledQ.error.message} onRetry={() => enrolledQ.refetch()} />
        ) : (enrolledQ.data ?? []).length === 0 ? (
          <EmptyView title="Nothing here yet" message="Open any free course and tap Enroll to add it here." />
        ) : (
          <View style={{ gap: space.sm, marginTop: space.md }}>
            {(enrolledQ.data ?? []).map((course: CourseItem) => {
              const pct = Number(course.progressPct ?? 0);
              return (
                <Card
                  key={course.id}
                  onPress={() => router.push({ pathname: '/courses/[id]', params: { id: String(course.id) } })}
                  style={{ gap: space.sm }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                    <AppText style={{ fontWeight: '700', flex: 1 }} numberOfLines={2}>
                      {course.title}
                    </AppText>
                    <Text style={{ color: c.primary, fontWeight: '800' }}>{pct}%</Text>
                  </View>
                  <ProgressBar value={pct / 100} />
                </Card>
              );
            })}
          </View>
        )
      ) : materialsQ.isLoading ? (
        <ListSkeleton />
      ) : materialsQ.isError ? (
        <ErrorView message={materialsQ.error.message} onRetry={() => materialsQ.refetch()} />
      ) : (materialsQ.data?.materials ?? []).length === 0 ? (
        <EmptyView title="No study materials" message="Try clearing your search." />
      ) : (
        <View style={{ gap: space.sm, marginTop: space.md }}>
          {(materialsQ.data?.materials ?? []).map((mat: StudyMaterial) => (
            <Card
              key={mat.id}
              onPress={() => handleOpenMaterial(mat)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }}>
              <IconTile icon="document-text" color={c.danger} bg={c.dangerBg} size={44} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText style={{ fontWeight: '700' }} numberOfLines={2}>
                  {mat.title}
                </AppText>
                <AppText variant="small" muted numberOfLines={1}>
                  {[mat.category, mat.subject, mat.type?.toUpperCase(), `${mat.downloadCount} downloads`].filter(Boolean).join(' · ')}
                </AppText>
              </View>
              <Badge label={mat.isFree ? 'Open' : 'Pro'} tone={mat.isFree ? 'success' : 'warning'} />
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    height: 48,
    gap: 8,
    marginVertical: space.md,
  },
  searchInput: { flex: 1, fontSize: 15 },
});
