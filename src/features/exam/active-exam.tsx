import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getStudentTargets, StudentTargetExam } from '@/api/student';
import { useAuth } from '@/features/auth/auth-provider';

const KEY = 'active-exam-id';

interface ActiveExamState {
  targets: StudentTargetExam[];
  /** The exam the student is currently focused on (falls back to the main target). */
  exam: StudentTargetExam | null;
  examId: string | null;
  setExamId: (id: string) => void;
}

const Ctx = createContext<ActiveExamState | null>(null);

export function useActiveExam(): ActiveExamState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useActiveExam must be used inside <ActiveExamProvider>');
  return v;
}

/** One shared "which exam am I preparing for right now" selection, persisted on device. */
export function ActiveExamProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [stored, setStored] = useState<string | null>(null);
  const targetsQ = useQuery({
    queryKey: ['student-targets'],
    queryFn: getStudentTargets,
    enabled: !!user,
  });

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => setStored(v))
      .catch(() => {});
  }, []);

  const targets = useMemo(() => targetsQ.data ?? [], [targetsQ.data]);
  const exam = useMemo(
    () => targets.find((t) => t.id === stored) ?? targets[0] ?? null,
    [targets, stored],
  );

  const setExamId = useCallback((id: string) => {
    setStored(id);
    AsyncStorage.setItem(KEY, id).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ targets, exam, examId: exam?.id ?? null, setExamId }),
    [targets, exam, setExamId],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
