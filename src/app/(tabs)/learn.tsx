import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { toApiError } from '@/api/client';
import {
  CourseItem,
  downloadMaterial,
  getCourses,
  getEnrolledCourses,
  getMaterials,
  StudyMaterial,
} from '@/api/learning';
import { AppText, EmptyView, ErrorView, LoadingView, Screen } from '@/components/ui/kit';
import { radius, space, useColors } from '@/theme';

export default function LearnHubScreen() {
  const c = useColors();
  const qc = useQueryClient();

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

  return (
    <Screen>
      <View style={styles.headerRow}>
        <AppText variant="title">Learning Hub</AppText>
      </View>

      {/* Compact Horizontal Feature Pills */}
      <View style={styles.shortcutRow}>
        <Pressable
          onPress={() => router.push('/syllabus')}
          style={[styles.shortcutPill, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Ionicons name="map" size={16} color={c.primary} />
          <AppText variant="small" style={{ fontWeight: '700' }}>
            Syllabus
          </AppText>
        </Pressable>

        <Pressable
          onPress={() => router.push('/current-affairs')}
          style={[styles.shortcutPill, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Ionicons name="newspaper" size={16} color={c.info} />
          <AppText variant="small" style={{ fontWeight: '700' }}>
            Daily News
          </AppText>
        </Pressable>

        <Pressable
          onPress={() => router.push('/vocabulary')}
          style={[styles.shortcutPill, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Ionicons name="language" size={16} color={c.success} />
          <AppText variant="small" style={{ fontWeight: '700' }}>
            Vocab Hub
          </AppText>
        </Pressable>
      </View>

      {/* Compact Search Bar */}
      <View style={[styles.searchBox, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Ionicons name="search-outline" size={16} color={c.textMuted} />
        <TextInput
          placeholder="Search courses or PDF materials..."
          placeholderTextColor={c.textMuted}
          value={search}
          onChangeText={setSearch}
          style={[styles.searchInput, { color: c.text }]}
        />
        {search ? (
          <Pressable onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={c.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {/* Segmented Switcher */}
      <View style={[styles.segmented, { backgroundColor: c.surface, borderColor: c.border }]}>
        {(
          [
            { key: 'courses', label: 'All Courses' },
            { key: 'enrolled', label: 'My Courses' },
            { key: 'materials', label: 'PDF Library' },
          ] as const
        ).map((item) => (
          <Pressable
            key={item.key}
            onPress={() => setTab(item.key)}
            style={[styles.segmentBtn, tab === item.key ? { backgroundColor: c.primary } : null]}>
            <AppText
              variant="small"
              style={{ color: tab === item.key ? c.primaryText : c.text, fontWeight: '700' }}>
              {item.label}
            </AppText>
          </Pressable>
        ))}
      </View>

      {/* Tab Content */}
      {tab === 'courses' ? (
        coursesQ.isLoading ? (
          <LoadingView />
        ) : coursesQ.isError ? (
          <ErrorView message={coursesQ.error.message} onRetry={() => coursesQ.refetch()} />
        ) : (coursesQ.data?.courses ?? []).length === 0 ? (
          <EmptyView title="No courses found" message="Check back soon for new courses." />
        ) : (
          <View style={{ gap: 6, marginTop: space.sm }}>
            {(coursesQ.data?.courses ?? []).map((course: CourseItem) => (
              <Pressable
                key={course.id}
                onPress={() =>
                  router.push({ pathname: '/courses/[id]', params: { id: String(course.id) } })
                }
                style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <AppText style={{ fontWeight: '600', flex: 1 }} numberOfLines={1}>
                      {course.title}
                    </AppText>
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: course.isFree ? c.successBg : c.warningBg },
                      ]}>
                      <AppText
                        variant="small"
                        style={{
                          fontSize: 9.5,
                          fontWeight: '700',
                          color: course.isFree ? c.successFg : c.warningFg,
                        }}>
                        {course.isFree ? 'FREE' : `₹${course.price ?? 'PRO'}`}
                      </AppText>
                    </View>
                  </View>
                  <AppText variant="small" muted numberOfLines={1}>
                    {[
                      course.category,
                      course.instructorFullName || course.instructorName,
                      course.durationHours ? `${course.durationHours}h` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
              </Pressable>
            ))}
          </View>
        )
      ) : tab === 'enrolled' ? (
        enrolledQ.isLoading ? (
          <LoadingView />
        ) : enrolledQ.isError ? (
          <ErrorView message={enrolledQ.error.message} onRetry={() => enrolledQ.refetch()} />
        ) : (enrolledQ.data ?? []).length === 0 ? (
          <EmptyView
            title="No Enrolled Courses Yet"
            message="Open any free course under All Courses and tap Enroll to add it here."
          />
        ) : (
          <View style={{ gap: 6, marginTop: space.sm }}>
            {(enrolledQ.data ?? []).map((course: CourseItem) => (
              <Pressable
                key={course.id}
                onPress={() =>
                  router.push({ pathname: '/courses/[id]', params: { id: String(course.id) } })
                }
                style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText style={{ fontWeight: '600' }} numberOfLines={1}>
                    {course.title}
                  </AppText>
                  <AppText variant="small" style={{ color: c.primary, fontWeight: '600' }}>
                    Progress: {course.progressPct ?? 0}%
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
              </Pressable>
            ))}
          </View>
        )
      ) : materialsQ.isLoading ? (
        <LoadingView />
      ) : materialsQ.isError ? (
        <ErrorView message={materialsQ.error.message} onRetry={() => materialsQ.refetch()} />
      ) : (materialsQ.data?.materials ?? []).length === 0 ? (
        <EmptyView title="No study materials found" message="Try clearing your search filter." />
      ) : (
        <View style={{ gap: 6, marginTop: space.sm }}>
          {(materialsQ.data?.materials ?? []).map((mat: StudyMaterial) => (
            <Pressable
              key={mat.id}
              onPress={() => handleOpenMaterial(mat)}
              style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Ionicons name="document-attach-outline" size={20} color={c.primary} />
              <View style={{ flex: 1, gap: 1 }}>
                <AppText style={{ fontWeight: '600' }} numberOfLines={1}>
                  {mat.title}
                </AppText>
                <AppText variant="small" muted numberOfLines={1}>
                  {[mat.category, mat.subject, mat.type?.toUpperCase(), `${mat.downloadCount} dl`]
                    .filter(Boolean)
                    .join(' · ')}
                </AppText>
              </View>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: mat.isFree ? c.successBg : c.warningBg },
                ]}>
                <AppText
                  variant="small"
                  style={{
                    fontSize: 9.5,
                    fontWeight: '700',
                    color: mat.isFree ? c.successFg : c.warningFg,
                  }}>
                  {mat.isFree ? 'OPEN' : 'PRO'}
                </AppText>
              </View>
            </Pressable>
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
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  shortcutRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: space.sm,
  },
  shortcutPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    minHeight: 38,
    gap: 6,
    marginBottom: space.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    paddingVertical: 4,
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: space.sm,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
});
