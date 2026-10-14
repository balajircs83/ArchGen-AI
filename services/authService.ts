import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
  User as FbUser,
} from 'firebase/auth';
import { auth } from './firebase';
import { User } from '../types';

export const toUser = (u: FbUser, name?: string): User => ({
  id: u.uid,
  email: u.email || '',
  name: name || u.displayName || 'User',
});

export const authService = {
  async login(email: string, password: string): Promise<User> {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    return toUser(user);
  },

  async register(email: string, name: string, password: string): Promise<User> {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(user, { displayName: name });
    return toUser(user, name);
  },

  logout: () => signOut(auth),

  onChange: (cb: (u: User | null) => void) =>
    onAuthStateChanged(auth, (u) => cb(u ? toUser(u) : null)),
};
