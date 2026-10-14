import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import { ExamConfig, ExamFeedback, ExamQuestion } from '../types';

export interface SavedExam {
  id: string;
  userId: string;
  config: ExamConfig;
  questions: ExamQuestion[];
  answers: (number | null)[];
  current: number;
  elapsed: number;
  status: 'in_progress' | 'completed';
  score?: number;
  feedback?: ExamFeedback | null;
  createdAt: number;
  updatedAt: number;
}

const col = collection(db, 'exams');
// Firestore rejects undefined values, so round-trip through JSON.
const plain = (o: object) => JSON.parse(JSON.stringify(o));

export const examStore = {
  async create(userId: string, data: Omit<SavedExam, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = Date.now();
    return (await addDoc(col, plain({ ...data, userId, createdAt: now, updatedAt: now }))).id;
  },

  update: (id: string, patch: Partial<SavedExam>) => updateDoc(doc(db, 'exams', id), plain({ ...patch, updatedAt: Date.now() })),

  async list(userId: string): Promise<SavedExam[]> {
    const snap = await getDocs(query(col, where('userId', '==', userId)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SavedExam).sort((a, b) => b.updatedAt - a.updatedAt);
  },

  remove: (id: string) => deleteDoc(doc(db, 'exams', id)),
};
