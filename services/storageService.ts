import { addDoc, collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { GeneratedArchitecture, SavedArchitecture } from '../types';

const col = collection(db, 'architectures');

export const storageService = {
  async saveArchitecture(userId: string, data: GeneratedArchitecture, prompt: string): Promise<SavedArchitecture> {
    const explanation = Array.isArray(data.explanation) ? (data.explanation as any[]).join('\n') : data.explanation;
    const timestamp = Date.now();
    // Firestore rejects undefined values, so round-trip through JSON.
    const body = JSON.parse(JSON.stringify({ userId, title: data.title, prompt, nodes: data.nodes, edges: data.edges, explanation, timestamp }));
    const ref = await addDoc(col, body);
    return { id: ref.id, ...body };
  },

  async getUserArchitectures(userId: string): Promise<SavedArchitecture[]> {
    const snap = await getDocs(query(col, where('userId', '==', userId)));
    // Sorted client-side to avoid needing a composite index.
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as SavedArchitecture)
      .sort((a, b) => b.timestamp - a.timestamp);
  },

  async deleteArchitecture(id: string): Promise<void> {
    await deleteDoc(doc(db, 'architectures', id));
  },
};
