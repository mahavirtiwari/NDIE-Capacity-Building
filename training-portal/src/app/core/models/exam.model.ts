import { AuditInfo, Id, RecordStatus } from './common.model';

export type QuestionType = 'SingleChoice' | 'MultipleChoice' | 'TrueFalse' | 'Descriptive';
export const QUESTION_TYPES: QuestionType[] = [
  'SingleChoice',
  'MultipleChoice',
  'TrueFalse',
  'Descriptive',
];

export type DifficultyLevel = 'Easy' | 'Moderate' | 'Hard';
export const DIFFICULTY_LEVELS: DifficultyLevel[] = ['Easy', 'Moderate', 'Hard'];

export interface QuestionOption {
  id: Id;
  text: string;
  isCorrect: boolean;
}

export interface ExamQuestion {
  id: Id;
  displayOrder: number;
  text: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  marks: number;
  negativeMarks: number;
  moduleRef?: string;
  options: QuestionOption[];
  explanation?: string;
}

export interface ExamPaper extends AuditInfo {
  id: Id;
  programTypeId: Id;
  programTypeName?: string;
  /** Derived from the program type; returned by the API for edit forms. */
  categoryId?: Id | null;
  categoryName?: string;
  subCategoryId?: Id | null;
  subCategoryName?: string;
  code: string;
  title: string;
  instructions?: string;
  durationMinutes: number;
  passPercentage: number;
  shuffleQuestions: boolean;
  negativeMarking: boolean;
  status: RecordStatus;
  questions: ExamQuestion[];
}

/**
 * A paper as the exam-scheduling dialog needs it.
 *
 * Deliberately not an ExamPaper. The manager who schedules an exam is barred
 * from reading papers - the questions are the exam - so the picker is served
 * from its own endpoint that carries the code, the title and how many
 * questions are on it, and nothing anybody could sit the paper with.
 */
export interface ExamPaperChoice {
  id: Id;
  programTypeId: Id;
  code: string;
  title: string;
  questionCount: number;
}

export function examTotalMarks(paper: Pick<ExamPaper, 'questions'>): number {
  return paper.questions.reduce((s, q) => s + (q.marks || 0), 0);
}
