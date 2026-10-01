import React, { useState } from 'react';
import { User } from '../types';
import { X, LogIn, UserPlus, Sparkles } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

const AVATARS = ['👑', '🚀', '🦄', '🐱', '🐶', '🍕', '🦕', '🎮', '🍉', '🦸'];

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🚀');
  const [selectedRole, setSelectedRole] = useState<'reader' | 'author' | 'admin'>('reader');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'signin' ? '/api/auth/signin' : '/api/auth/signup';
      const body = mode === 'signin'
        ? { email, password }
        : { email, username: username || email.split('@')[0], role: selectedRole, avatar: selectedAvatar };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      onSuccess(data.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border-2 border-amber-300 overflow-hidden">
        
        {/* Modal Top Tabs */}
        <div className="bg-amber-100/60 p-2 border-b border-amber-200 flex items-center justify-between">
          <div className="flex gap-1">
            <button
              onClick={() => { setMode('signin'); setError(''); }}
              className={`px-4 py-2 rounded-2xl text-xs font-black transition-all ${
                mode === 'signin'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); setError(''); }}
              className={`px-4 py-2 rounded-2xl text-xs font-black transition-all ${
                mode === 'signup'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Sign Up
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-amber-200 text-stone-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          <div className="text-center pb-2">
            <h3 className="text-2xl font-black text-stone-900 font-['Fredoka']">
              {mode === 'signin' ? 'Welcome Back, Reader!' : 'Join NovelForge Kids!'}
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              {mode === 'signin'
                ? 'Sign in to access your saved novels and preferences.'
                : 'Create an account to start reading and writing kid-books.'}
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1 font-['Fredoka']">
              Email Address *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="reader@novelforge.com"
              className="w-full px-3.5 py-2.5 rounded-xl bg-amber-50/50 border border-amber-200 text-sm font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1 font-['Fredoka']">
                Username / Author Handle *
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. CaptainStory"
                className="w-full px-3.5 py-2.5 rounded-xl bg-amber-50/50 border border-amber-200 text-sm font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1 font-['Fredoka']">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl bg-amber-50/50 border border-amber-200 text-sm font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {mode === 'signup' && (
            <>
              {/* Role Selection */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1.5 font-['Fredoka']">
                  I am joining as:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('reader')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      selectedRole === 'reader'
                        ? 'bg-amber-100 border-orange-500 text-orange-950 font-black'
                        : 'bg-stone-50 border-stone-200 text-stone-600'
                    }`}
                  >
                    📖 Kid / Reader
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRole('author')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      selectedRole === 'author'
                        ? 'bg-amber-100 border-orange-500 text-orange-950 font-black'
                        : 'bg-stone-50 border-stone-200 text-stone-600'
                    }`}
                  >
                    ✍️ Young Author
                  </button>
                </div>
              </div>

              {/* Avatar Picker */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1.5 font-['Fredoka']">
                  Choose Avatar Emoji:
                </label>
                <div className="flex flex-wrap gap-2 justify-center bg-amber-50/50 p-2.5 rounded-2xl border border-amber-200">
                  {AVATARS.map((av) => (
                    <button
                      key={av}
                      type="button"
                      onClick={() => setSelectedAvatar(av)}
                      className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-transform ${
                        selectedAvatar === av
                          ? 'bg-orange-500 text-white scale-110 shadow-sm'
                          : 'hover:bg-amber-100'
                      }`}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-2xl font-black text-sm bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 transition-all"
            >
              {mode === 'signin' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              <span>{mode === 'signin' ? 'Sign In Now' : 'Create Account'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
