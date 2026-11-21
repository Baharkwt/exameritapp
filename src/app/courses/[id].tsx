import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { toApiError } from '@/api/client';
import {
  CourseChapter,
  enrollInCourse,
  getCourseDetail,
  getEnrolledCourses,
} from '@/api/learning';
import {
  AppText,
  Badge,
  Button,
  Card,
  EmptyView,
  ErrorBanner,
  ErrorView,
  IconTile,
  LoadingView,
  Screen,
  ScreenHeader,
  SectionHeader,
} from '@/components/ui/kit';
import { space, useColors } from '@/theme';

export default function CourseDetailScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const detailQ = useQuery({
    queryKey: ['course-detail', id],
    queryFn: () => getCourseDetail(id),
    enabled: !!id,
  });

  const enrolledQ = useQuery({
    queryKey: ['courses-enrolled'],
    queryFn: getEnrolledCourses,
  });

  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (detailQ.isLoading) return <LoadingView />;
  if (detailQ.isError) {
    return <ErrorView message={detailQ.error.message} onRetry={() => detailQ.refetch()} />;
  }

  const course = detailQ.data!;
  const isEnrolled = (enrolledQ.data ?? []).some((e) => String(e.id) === String(course.id));

  async function handleEnroll() {
    setEnrolling(true);
    setError(null);
    try {
      await enrollInCourse(course.id);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['courses-enrolled'] }),
        qc.invalidateQueries({ queryKey: ['course-detail', id] }),
      ]);
    } catch (e) {
      setError(toApiError(e).message);
    } finally {
      setEnrolling(false);
    }
  }

  function handleOpenChapter(ch: CourseChapter) {
    if (!ch.videoUrl) {
      Alert.alert(
        'Chapter Locked',
        course.isFree
          ? 'Enroll in this free course first to unlock all chapters.'
          : 'This chapter requires a paid enrollment.',
      );
      return;
    }
    Linking.openURL(ch.videoUrl).catch(() =>
      Alert.alert('Video Link', ch.videoUrl ?? 'Unable to open video URL'),
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title={course.title}
        subtitle={[course.category, course.instructorFullName || course.instructorName, course.durationHours ? `${course.durationHours} hrs` : null].filter(Boolean).join(' · ')}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/learn'))}
      />

      {error ? <ErrorBanner message={error} /> : null}

      {course.description ? (
        <Card style={{ marginBottom: space.md }}>
          <AppText variant="small">{course.description}</AppText>
        </Card>
      ) : null}

      {/* Enrollment CTA */}
      <View style={{ marginBottom: space.lg }}>
        {isEnrolled ? (
          <Card style={{ backgroundColor: c.successBg, flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md }}>
            <Ionicons name="checkmark-circle" size={22} color={c.successFg} />
            <AppText variant="small" style={{ color: c.successFg, fontWeight: '800' }}>
              You’re enrolled in this course
            </AppText>
          </Card>
        ) : course.isFree ? (
          <Button title="Enroll for Free" loading={enrolling} onPress={handleEnroll} />
        ) : (
          <Button
            title={`Requires Pro Plan (₹${course.price ?? ''})`}
            variant="outline"
            onPress={() => handleEnroll()}
          />
        )}
      </View>

      {/* Subjects & Chapters Tree */}
      <SectionHeader title={`Curriculum · ${course.subjects.length} subjects`} />

      {course.subjects.length === 0 ? (
        <EmptyView title="Curriculum coming soon" message="Chapters are being uploaded by the instructor." />
      ) : (
        <View style={{ gap: space.md }}>
          {course.subjects.map((subj) => (
            <Card key={subj.id} style={{ paddingVertical: space.md }}>
              <Text style={{ color: c.text, fontWeight: '800', fontSize: 16, marginBottom: space.xs }}>{subj.title}</Text>
              {subj.chapters.length === 0 ? (
                <AppText variant="small" muted>
                  No chapters yet
                </AppText>
              ) : (
                subj.chapters.map((ch, idx) => (
                  <Pressable
                    key={ch.id}
                    onPress={() => handleOpenChapter(ch)}
                    style={[
                      styles.chapterRow,
                      idx > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border } : null,
                    ]}>
                    <IconTile icon={ch.videoUrl ? 'play' : 'lock-closed'} color={ch.videoUrl ? c.primary : c.textMuted} bg={ch.videoUrl ? c.primarySoft : c.skeleton} size={34} />
                    <View style={{ flex: 1 }}>
                      <AppText variant="small" style={{ fontWeight: '600' }}>
                        {ch.title}
                      </AppText>
                      {ch.durationMinutes ? (
                        <AppText variant="small" muted>
                          {ch.durationMinutes} mins {ch.isFreePreview ? '· Free Preview' : ''}
                        </AppText>
                      ) : null}
                    </View>
                    {ch.isFreePreview ? <Badge label="Preview" tone="success" /> : null}
                  </Pressable>
                ))
              )}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
  },
});
