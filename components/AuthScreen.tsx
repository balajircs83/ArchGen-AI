import React, { useState } from 'react';
import { Layout, ArrowRight, Loader2, Sparkles, Sun, Moon } from 'lucide-react';
import { useTheme } from '../utils/theme';
import { authService } from '../services/authService';
import { User } from '../types';

interface AuthScreenProps {
  onLogin: (user: User) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [theme, toggleTheme] = useTheme();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      let user;
      if (isLogin) {
        user = await authService.login(email, password);
      } else {
        if (!name.trim()) throw new Error('Name is required');
        user = await authService.register(email, name, password);
      }
      onLogin(user);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-app text-fg relative overflow-hidden">
      <button onClick={toggleTheme} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg border border-line bg-surface text-muted hover:text-fg" title="Toggle theme">
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>
      <div className="w-full max-w-sm p-4">
        <div className="bg-surface border border-line rounded-2xl shadow-xl p-7">
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 bg-accent text-accent-fg rounded-xl flex items-center justify-center mb-3"><Layout className="w-6 h-6" /></div>
            <h1 className="text-2xl font-bold">ArchGen AI</h1>
            <p className="text-muted text-sm text-center mt-1">
              {isLogin ? 'Welcome back! Sign in to access your architectures.' : 'Join to start generating professional system designs.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm text-center">{error}</div>
            )}

            {!isLogin && (
              <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted">FULL NAME</label>
              <input type="text" required={!isLogin} value={name} onChange={(e) => setName(e.target.value)}
                className="w-full bg-surface2 border border-line rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-accent outline-none transition-all" placeholder="John Doe" />
            </div>
            )}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted">EMAIL ADDRESS</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface2 border border-line rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-accent outline-none transition-all" placeholder="name@company.com" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted">PASSWORD</label>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface2 border border-line rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-accent outline-none transition-all" placeholder="At least 6 characters" />
            </div>

            <button type="submit" disabled={isLoading}
              className="w-full bg-fg text-app font-semibold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 group mt-2 disabled:opacity-60">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-line text-center">
            <button onClick={() => { setIsLogin(!isLogin); setError(null); }} className="text-muted hover:text-fg text-sm font-medium transition-colors">
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-center gap-6 text-muted text-sm">
          <div className="flex items-center gap-2"><Sparkles className="w-4 h-4" /><span>AI Powered</span></div>
          <div className="flex items-center gap-2"><Layout className="w-4 h-4" /><span>Instant Diagrams</span></div>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
