import React, { useState } from 'react';
import { BookOpen, Sparkles, User as UserIcon, Code2, Search, LogOut } from 'lucide-react';
import { User } from '../types';

interface NavbarProps {
  currentView: 'library' | 'generator' | 'admin' | 'reader';
  onNavigate: (view: 'library' | 'generator' | 'admin') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  currentUser: User | null;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onOpenApiDocs: () => void;
  isAdmin: boolean;
}

const ADMIN_PASSWORDS = [
  '123Jasonsgame!15412907iweriebja959@outlook.com',
  '1541',
  'admin123',
  'admin',
];

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  searchQuery,
  onSearchChange,
  currentUser,
  onOpenAuth,
  onSignOut,
  onOpenApiDocs,
  isAdmin,
}) => {
  const [searchFocused, setSearchFocused] = useState(false);

  // Check if string matches secret admin password
  const checkAndTriggerAdmin = (value: string) => {
    const trimmed = value.trim();
    if (ADMIN_PASSWORDS.some((pass) => pass.toLowerCase() === trimmed.toLowerCase())) {
      onNavigate('admin');
      onSearchChange('');
      return true;
    }
    return false;
  };

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // If exact long admin email/password is entered, trigger instantly
    if (val.trim() === '123Jasonsgame!15412907iweriebja959@outlook.com') {
      checkAndTriggerAdmin(val);
      return;
    }
    onSearchChange(val);
  };

  // Typing the admin password in the search bar and hitting Enter enters the secret admin studio
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (checkAndTriggerAdmin(searchQuery)) {
        e.preventDefault();
      }
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b-2 border-amber-200/80 shadow-sm transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">
          
          {/* Logo */}
          <div 
            onClick={() => onNavigate('library')}
            className="flex items-center gap-3 cursor-pointer group select-none flex-shrink-0"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
              <BookOpen className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-2xl tracking-tight text-stone-900 font-['Fredoka']">
                  book<span className="text-orange-600">tomes</span>
                </span>
              </div>
              <p className="text-xs text-stone-500 font-semibold tracking-wide">
                Children's Storybook Library
              </p>
            </div>
          </div>

          {/* Book Search Bar with Secret Admin Trigger */}
          <div className="flex-1 max-w-md mx-2 relative">
            <div className={`relative flex items-center transition-all ${
              searchFocused ? 'ring-2 ring-orange-500 rounded-2xl' : ''
            }`}>
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchInput}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search stories, titles, genres..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-amber-50/60 border border-amber-200/80 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-3 text-xs text-stone-400 hover:text-stone-600 font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Navigation Links & Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <button
              onClick={() => onNavigate('library')}
              className={`px-3.5 py-2 rounded-xl text-sm font-bold transition-all ${
                currentView === 'library'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-sm'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              Library
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={() => onNavigate('admin')}
                  className={`px-3.5 py-2 rounded-xl text-sm font-bold transition-all ${
                    currentView === 'admin'
                      ? 'bg-purple-100 text-purple-900 border border-purple-300 shadow-sm'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  Admin Studio
                </button>
                <button
                  onClick={() => onNavigate('generator')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold transition-all ${
                    currentView === 'generator'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-orange-600" />
                  <span>Create Book (PDF)</span>
                </button>
              </>
            )}

            {currentUser ? (
              <div className="flex items-center gap-2 pl-1 border-l border-stone-200">
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-stone-100 border border-stone-200">
                  <span className="text-lg leading-none" role="img" aria-label="avatar">
                    {currentUser.avatar || '👤'}
                  </span>
                  <div className="hidden md:block text-left">
                    <p className="text-xs font-bold text-stone-800 leading-tight">
                      {currentUser.username}
                    </p>
                    <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.2 rounded bg-amber-200 text-amber-900">
                      {currentUser.role}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onSignOut}
                  title="Sign out"
                  className="p-2 text-stone-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-stone-900 text-white hover:bg-stone-800 shadow-sm transition-all"
              >
                <UserIcon className="w-4 h-4" />
                <span>Sign In</span>
              </button>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};
