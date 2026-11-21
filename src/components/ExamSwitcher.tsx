import { ScrollView } from 'react-native';

import { Chip } from '@/components/ui/kit';
import { useActiveExam } from '@/features/exam/active-exam';
import { haptic } from '@/lib/haptics';

/** Horizontal chip row bound to the shared active exam. Renders nothing with <2 targets. */
export function ExamSwitcher() {
  const { targets, examId, setExamId } = useActiveExam();
  if (targets.length < 2) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -16 }}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 6 }}>
      {targets.map((t) => (
        <Chip
          key={t.id}
          label={t.name}
          icon="ribbon"
          selected={t.id === examId}
          onPress={() => {
            haptic.select();
            setExamId(t.id);
          }}
        />
      ))}
    </ScrollView>
  );
}
