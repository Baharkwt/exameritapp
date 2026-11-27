import { api, toApiError } from './client';

/** ── Vocabulary Hub (/api/vocabulary) ─────────────────────────── */

export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type SituationCategory = 'interview' | 'essay' | 'business' | 'daily' | 'exam';
export type ExamCategory = 'banking' | 'ssc' | 'railway' | 'upsc' | 'state-psc' | 'defence' | 'general';
export type ContentStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected';
export type WordStatus = 'new' | 'learning' | 'learned' | 'mastered';
export type SelfAssessment = 'i_know' | 'need_revision' | null;
export type LessonPhase = 'learning' | 'flashcards' | 'spelling' | 'quiz' | 'completed';

export interface VocabCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  examTags: ExamCategory[];
  isActive: boolean;
  sortOrder?: number;
  createdAt: string;
}

export interface VocabLesson {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  difficulty: DifficultyLevel;
  estimatedMinutes: number;
  wordIds: string[];
  priority: 'high' | 'medium' | 'low';
  status: 'draft' | 'published';
  publishAt?: string;
  sortOrder?: number;
  createdAt: string;
}

export interface VocabWord {
  id: string;
  word: string;
  pronunciation?: string;
  partOfSpeech?: string;
  meaning: string;
  shortDefinition?: string;
  detailedExplanation?: string;
  example: string;
  example2?: string;
  difficulty: DifficultyLevel;
  situation: SituationCategory;
  examCategory: ExamCategory;
  synonyms?: string[];
  antonyms?: string[];
  memoryTrick?: string;
  wordFamily?: { word: string; pos: string }[];
  wordTreeRoot?: string;
  wordTree?: string;
  imageUrl?: string;
  audioUrl?: string;
  isActive: boolean;
  uploadedBy: string;
  uploadedByRole: 'super-admin' | 'employee';
  uploadedByName?: string;
  contentStatus: ContentStatus;
  rejectionReason?: string;
  createdAt: string;
}

export interface QuizQuestion {
  id: string;
  lessonId: string;
  wordId?: string;
  type:
    | 'mcq'
    | 'image'
    | 'meaning'
    | 'synonym'
    | 'antonym'
    | 'fill_blank'
    | 'audio'
    | 'spelling'
    | 'missing_letter';
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  difficulty: DifficultyLevel;
  marks: number;
  imageUrl?: string;
  audioUrl?: string;
}

export interface VocabProgress {
  id: string;
  userId: string;
  wordId: string;
  lessonId?: string;
  status: WordStatus;
  selfAssessment?: SelfAssessment;
  assignedDate: string;
  timesShown: number;
  quizAttempts: number;
  quizAccuracy: number;
  learnedDate?: string;
  masteredDate?: string;
  nextRevisionDate?: string;
  revisionLevel: number;
  revisionAttempts: number;
  isBookmarked: boolean;
  isDifficult: boolean;
}

export interface LessonProgress {
  id: string;
  userId: string;
  lessonId: string;
  phase: LessonPhase;
  startedAt: string;
  completedAt?: string;
  flashcardsScore: number;
  spellingScore: number;
  quizScore: number;
  quizTotal: number;
  timeSpentSeconds: number;
  selfAssessments: Record<string, SelfAssessment>;
}

export interface RevisionEntry {
  id: string;
  userId: string;
  wordId: string;
  level: number;
  nextRevisionDate: string;
  lastRevisedDate?: string;
  accuracy: number;
  attempts: number;
}

export interface QuizAttempt {
  id: string;
  userId: string;
  wordId: string;
  lessonId?: string;
  selectedOption: string;
  correctOption: string;
  isCorrect: boolean;
  attemptDate: string;
}

export interface VocabContent {
  categories: VocabCategory[];
  lessons: VocabLesson[];
  words: VocabWord[];
  questions: QuizQuestion[];
}

export interface VocabProgressState {
  wordProgress: VocabProgress[];
  revisions: RevisionEntry[];
  lessonProgress: LessonProgress[];
  quizAttempts: QuizAttempt[];
}

export interface VocabProgressChanges {
  wordProgress?: VocabProgress[];
  revisions?: RevisionEntry[];
  revisionsRemoved?: string[];
  lessonProgress?: LessonProgress[];
  quizAttempts?: QuizAttempt[];
}

export async function getVocabularyContent(): Promise<VocabContent> {
  try {
    const { data } = await api.get<VocabContent>('/vocabulary/content');
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getVocabularyMyProgress(): Promise<VocabProgressState> {
  try {
    const { data } = await api.get<VocabProgressState>('/vocabulary/me');
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function saveVocabularyMyProgress(
  changes: VocabProgressChanges,
): Promise<{ saved: number; skipped: number }> {
  try {
    const { data } = await api.put<{ saved: number; skipped: number }>('/vocabulary/me', changes);
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

/** ── Grammar Hub (/api/grammar) ───────────────────────────────── */

export interface GrammarVisualExample {
  emoji: string;
  label: string;
  sentence: string;
}

export interface GrammarCommonMistake {
  wrong: string;
  correct: string;
  tip: string;
}

export interface GrammarPracticeItem {
  instruction: string;
  sentence: string;
  answer: string;
}

export interface GrammarQuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface GrammarPdfResource {
  id: string;
  title: string;
  url: string;
  pages?: number;
  size?: string;
}

export interface GrammarVideoResource {
  id: string;
  title: string;
  url: string;
  duration?: string;
  instructor?: string;
}

export interface GrammarLevelItem {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
}

export interface GrammarTopicItem {
  id: string;
  levelId: string;
  moduleTitle: string;
  title: string;
  subtitle: string;
  emoji: string;
  difficulty: 1 | 2 | 3;
  timeMinutes: number;
  xpReward: number;
  definition: string;
  simpleExplanation: string;
  visualExamples: GrammarVisualExample[];
  memoryTrick: string;
  commonMistakes: GrammarCommonMistake[];
  practiceItems: GrammarPracticeItem[];
  quiz: GrammarQuizQuestion[];
  revisionPoints: string[];
  pdfs: GrammarPdfResource[];
  videos: GrammarVideoResource[];
  status: 'draft' | 'published';
  sortOrder: number;
}

export interface GrammarContentResponse {
  levels: GrammarLevelItem[];
  topics: GrammarTopicItem[];
}

export interface GrammarRecentTopic {
  topicId: string;
  topicName: string;
  categoryName: string;
  lastViewedAt: string;
}

export interface GrammarQuizResult {
  score: number;
  total: number;
  completedAt: string | null;
}

export interface GrammarProgressState {
  completedTopicIds: string[];
  recentlyViewed: GrammarRecentTopic[];
  quizResults: Record<string, GrammarQuizResult>;
}

export interface UpdateGrammarProgressPayload {
  viewed?: boolean;
  completed?: boolean;
  quizScore?: number;
  quizTotal?: number;
}

export async function getGrammarContent(): Promise<GrammarContentResponse> {
  try {
    const { data } = await api.get<GrammarContentResponse>('/grammar/content');
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function getGrammarMyProgress(): Promise<GrammarProgressState> {
  try {
    const { data } = await api.get<GrammarProgressState>('/grammar/me');
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}

export async function updateGrammarTopicProgress(
  topicId: string,
  body: UpdateGrammarProgressPayload,
): Promise<GrammarProgressState> {
  try {
    const { data } = await api.put<GrammarProgressState>(
      `/grammar/me/topics/${encodeURIComponent(topicId)}`,
      body,
    );
    return data;
  } catch (e) {
    throw toApiError(e);
  }
}
