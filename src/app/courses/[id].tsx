import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { toApiError } from '@/api/client';
import {
  CourseChapter,
  enrollInCourse,
  getCourseDetail,
  getEnrolledCourses,
} from '@/api/learning';
import { AppText, Button, EmptyView, ErrorBanner, ErrorView, LoadingView, Screen } from '@/components/ui/kit';
import { radius, space, useColors } from '@/theme';

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
      <View style={styles.headerRow}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/learn'))} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="title" style={{ fontSize: 21 }}>
            {course.title}
          </AppText>
          <AppText variant="small" muted>
            {[
              course.category,
              course.instructorFullName || course.instructorName,
              course.durationHours ? `${course.durationHours} hrs` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
        </View>
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      {course.description ? (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <AppText variant="small">{course.description}</AppText>
        </View>
      ) : null}

      {/* Enrollment CTA */}
      <View style={{ marginBottom: space.lg }}>
        {isEnrolled ? (
          <View style={[styles.enrolledBanner, { backgroundColor: c.successBg, borderColor: c.success }]}>
            <Ionicons name="checkmark-circle" size={20} color={c.successFg} />
            <AppText variant="small" style={{ color: c.successFg, fontWeight: '700' }}>
              You are enrolled in this course
            </AppText>
          </View>
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
      <AppText variant="heading" style={{ marginBottom: space.sm }}>
        Course Curriculum ({course.subjects.length} subjects)
      </AppText>

      {course.subjects.length === 0 ? (
        <EmptyView title="Curriculum coming soon" message="Chapters are being uploaded by the instructor." />
      ) : (
        <View style={{ gap: space.md }}>
          {course.subjects.map((subj) => (
            <View
              key={subj.id}
              style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              <AppText style={{ fontWeight: '700', marginBottom: space.xs }}>{subj.title}</AppText>
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
                      idx > 0 ? { borderTopWidth: 1, borderTopColor: c.border } : null,
                    ]}>
                    <Ionicons
                      name={ch.videoUrl ? 'play-circle' : 'lock-closed-outline'}
                      size={20}
                      color={ch.videoUrl ? c.primary : c.textMuted}
                    />
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
                  </Pressable>
                ))
              )}
            </View>
          ))}
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
  card: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: space.sm,
  },
  enrolledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
  },
});

