import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Web config is public by design; access is enforced by firestore.rules.
const app = initializeApp({
  apiKey: 'AIzaSyBZ3YpapA-N0bbUyGY4YU6I6GkB4nlF72A',
  authDomain: 'archgen-ai-203496135.firebaseapp.com',
  projectId: 'archgen-ai-203496135',
  appId: '1:811534896114:web:34bdde241f84d7f260b96b',
});

export const auth = getAuth(app);
export const db = getFirestore(app);
