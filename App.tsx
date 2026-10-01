/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Book, User } from './types';
import { Navbar } from './components/Navbar';
import { BookCard } from './components/BookCard';
import { BookReader } from './components/BookReader';
import { BookGenerator } from './components/BookGenerator';
import { AdminPanel } from './components/AdminPanel';
import { EditBookModal } from './components/EditBookModal';
import { CoverRegeneratorModal } from './components/CoverRegeneratorModal';
import { AuthModal } from './components/AuthModal';
import { ApiDocsModal } from './components/ApiDocsModal';
import { Sparkles, BookOpen, Layers, Smile } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<'library' | 'generator' | 'admin' | 'reader'>('library');
  const [books, setBooks] = useState<Book[]>([]);
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [ageFilter, setAgeFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Modals
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [regeneratingCoverBook, setRegeneratingCoverBook] = useState<Book | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [apiDocsOpen, setApiDocsOpen] = useState(false);

  // User session
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('novelforge_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [secretAdminUnlocked, setSecretAdminUnlocked] = useState(false);
  const isAdmin = secretAdminUnlocked || currentUser?.role === 'admin' || currentUser?.email === '123Jasonsgame!15412907iweriebja959@outlook.com';

  // Load books from backend
  const fetchBooks = async () => {
    try {
      setLoading(true);
      // If admin, fetch all books including unlisted drafts
      const url = isAdmin ? '/api/books?all=true' : '/api/books';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setBooks(data);
      }
    } catch (err) {
      console.error('Failed to load books:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, [isAdmin]);

  // Auth Handlers
  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('novelforge_user', JSON.stringify(user));
    } catch (e) {
      console.error(e);
    }
    if (user.role === 'admin' || user.email === '123Jasonsgame!15412907iweriebja959@outlook.com') {
      setCurrentView('admin');
    }
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    setSecretAdminUnlocked(false);
    try {
      localStorage.removeItem('novelforge_user');
    } catch (e) {
      console.error(e);
    }
    if (currentView === 'admin') {
      setCurrentView('library');
    }
  };

  // Book Handlers
  const handleOpenBook = (book: Book) => {
    setActiveBook(book);
    setCurrentView('reader');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExitReader = () => {
    setActiveBook(null);
    setCurrentView(isAdmin ? 'admin' : 'library');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBookCreated = async (newBook: Book) => {
    try {
      // Check if it already exists or create/update on backend
      const res = await fetch(`/api/books/${newBook.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBook),
      });
      if (!res.ok) {
        await fetch('/api/books', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newBook),
        });
      }
    } catch (err) {
      console.warn('Failed to persist book to backend:', err);
    }
    setBooks((prev) => [newBook, ...prev.filter((b) => b.id !== newBook.id)]);
  };

  const handleSaveEditedBook = async (updatedBook: Book) => {
    try {
      let res = await fetch(`/api/books/${updatedBook.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedBook),
      });
      if (!res.ok) {
        res = await fetch('/api/books', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedBook),
        });
      }
      if (res.ok) {
        const saved = await res.json();
        setBooks((prev) => prev.map((b) => (b.id === saved.id ? saved : b)));
        if (activeBook?.id === saved.id) setActiveBook(saved);
        setEditingBook(null);
      } else {
        // Fallback: update local state even if network fails
        setBooks((prev) => prev.map((b) => (b.id === updatedBook.id ? updatedBook : b)));
        if (activeBook?.id === updatedBook.id) setActiveBook(updatedBook);
        setEditingBook(null);
      }
    } catch (e) {
      console.error('Failed to update book:', e);
      setBooks((prev) => prev.map((b) => (b.id === updatedBook.id ? updatedBook : b)));
      if (activeBook?.id === updatedBook.id) setActiveBook(updatedBook);
      setEditingBook(null);
    }
  };

  const handleTogglePublish = async (bookId: string) => {
    try {
      const res = await fetch(`/api/books/${bookId}/publish`, {
        method: 'PATCH',
      });
      if (res.ok) {
        const data = await res.json();
        setBooks((prev) =>
          prev.map((b) => (b.id === bookId ? { ...b, isPublished: data.isPublished } : b))
        );
      }
    } catch (e) {
      console.error('Failed to toggle publish status:', e);
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    if (!window.confirm('Are you sure you want to delete this novel from the database?')) {
      return;
    }
    try {
      const res = await fetch(`/api/books/${bookId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setBooks((prev) => prev.filter((b) => b.id !== bookId));
      }
    } catch (e) {
      console.error('Failed to delete book:', e);
    }
  };

  const handleApplyNewCover = async (updatedBook: Book) => {
    try {
      const res = await fetch(`/api/books/${updatedBook.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedBook),
      });
      if (res.ok) {
        const saved = await res.json();
        setBooks((prev) => prev.map((b) => (b.id === saved.id ? saved : b)));
        setRegeneratingCoverBook(null);
      }
    } catch (e) {
      console.error('Failed to save regenerated cover:', e);
    }
  };

  // Filter books on library page (Strictly hide unlisted/unpublished books from regular readers)
  const filteredBooks = books.filter((b) => {
    if (!isAdmin && b.isPublished === false) {
      return false;
    }

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      b.title.toLowerCase().includes(q) ||
      b.blurb.toLowerCase().includes(q) ||
      b.genre.toLowerCase().includes(q) ||
      b.firstSentence?.toLowerCase().includes(q);

    const matchesAge =
      ageFilter === 'all' ||
      b.ageGroup.toLowerCase().includes(ageFilter.toLowerCase());

    return matchesSearch && matchesAge;
  });

  return (
    <div className="min-h-screen bg-amber-50/40 text-stone-800 flex flex-col font-['Nunito',sans-serif]">
      
      {/* Navbar (Hidden in Reader View for pure locked view-only experience) */}
      {currentView !== 'reader' && (
        <Navbar
          currentView={currentView}
          onNavigate={(view) => {
            if (view === 'admin') {
              setSecretAdminUnlocked(true);
            }
            setCurrentView(view);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          currentUser={currentUser}
          onOpenAuth={() => setAuthModalOpen(true)}
          onSignOut={handleSignOut}
          onOpenApiDocs={() => setApiDocsOpen(true)}
          isAdmin={isAdmin}
        />
      )}

      {/* Main View Router */}
      <div className="flex-1">
        
        {/* READER VIEW (Locked, view-only, hidden secret exit) */}
        {currentView === 'reader' && activeBook && (
          <BookReader
            book={activeBook}
            onExit={handleExitReader}
            isAdmin={isAdmin}
            onUpdateBook={(updated) => {
              setActiveBook(updated);
              setBooks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
            }}
          />
        )}

        {/* FORGE A NOVEL (Autonomous Creative Writing Engine) */}
        {currentView === 'generator' && (
          <BookGenerator
            onBookCreated={handleBookCreated}
            onOpenBook={handleOpenBook}
          />
        )}

        {/* ADMIN STUDIO (Full management) */}
        {currentView === 'admin' && (
          <AdminPanel
            books={books}
            onOpenBook={handleOpenBook}
            onEditBook={(book) => setEditingBook(book)}
            onDeleteBook={handleDeleteBook}
            onTogglePublish={handleTogglePublish}
            onRegenerateCover={(book) => setRegeneratingCoverBook(book)}
            onCreateNew={() => setCurrentView('generator')}
            onOpenApiDocs={() => setApiDocsOpen(true)}
          />
        )}

        {/* LIBRARY / HOME VIEW */}
        {currentView === 'library' && (
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            
            {/* Playful Hero Banner */}
            <div className="bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 rounded-3xl p-6 sm:p-10 text-stone-900 shadow-xl mb-10 relative overflow-hidden border-2 border-amber-300">
              <div className="relative z-10 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/30 backdrop-blur-md text-stone-900 text-xs font-black mb-3">
                  <Smile className="w-3.5 h-3.5" />
                  <span>Welcome to booktomes</span>
                </div>
                <h1 className="text-3xl sm:text-5xl font-black font-['Fredoka'] tracking-tight mb-3 text-stone-950">
                  Read Amazing Kids' Storybooks!
                </h1>
                <p className="text-stone-800 text-sm sm:text-base font-bold leading-relaxed mb-4">
                  Explore hilarious chapter books, silly superhero adventures, and tasty tales!
                  Read every book in 3D Real Book mode or clean manuscript mode.
                </p>
                <p className="text-xs text-stone-700 font-semibold">
                  Pick any story below to begin reading right away!
                </p>
              </div>

              {/* Decorative floating emojis */}
              <div className="absolute top-6 right-8 text-7xl select-none opacity-40 hidden sm:block">
                🍕
              </div>
              <div className="absolute bottom-4 right-28 text-6xl select-none opacity-30 hidden sm:block">
                🦖
              </div>
            </div>

            {/* Age Filter Badges & Search Counter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {[
                  { id: 'all', label: 'All Age Groups' },
                  { id: '4-7', label: '👶 4-7 Early Readers' },
                  { id: '8-10', label: '🦸 8-10 Middle Grade' },
                  { id: '11-13', label: '🚀 11-13 Chapter Books' },
                ].map((pill) => (
                  <button
                    key={pill.id}
                    onClick={() => setAgeFilter(pill.id)}
                    className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex-shrink-0 ${
                      ageFilter === pill.id
                        ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                        : 'bg-white hover:bg-amber-100 text-stone-700 border border-amber-200'
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              <div className="text-xs font-bold text-stone-500">
                Showing <span className="text-orange-600 font-black">{filteredBooks.length}</span> {filteredBooks.length === 1 ? 'novel' : 'novels'}
              </div>

            </div>

            {/* Books Grid */}
            {loading ? (
              <div className="py-20 text-center">
                <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="font-bold text-stone-600 text-sm">Loading storybook collection...</p>
              </div>
            ) : filteredBooks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
                {filteredBooks.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    onRead={handleOpenBook}
                    isAdmin={isAdmin}
                    onEdit={(b) => setEditingBook(b)}
                    onDelete={handleDeleteBook}
                    onTogglePublish={handleTogglePublish}
                    onRegenerateCover={(b) => setRegeneratingCoverBook(b)}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-amber-200 max-w-lg mx-auto">
                <BookOpen className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                <h3 className="font-black text-xl text-stone-800 font-['Fredoka'] mb-1">
                  No Books Found
                </h3>
                <p className="text-xs text-stone-500 mb-5">
                  {searchQuery
                    ? `No stories matched "${searchQuery}". Try a different search term!`
                    : 'No books found in this category. Check back soon for new stories!'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-100 text-amber-900 hover:bg-amber-200"
                  >
                    Clear Search Filter
                  </button>
                )}
              </div>
            )}

          </main>
        )}

      </div>

      {/* Footer */}
      {currentView !== 'reader' && (
        <footer className="mt-auto border-t border-amber-200 bg-white/70 py-6 text-center text-xs text-stone-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="font-bold">
              booktomes • Children's Storybook Library
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setAuthModalOpen(true)}
                className="hover:text-stone-900 font-semibold"
              >
                Reader Account
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* Modals */}
      {editingBook && (
        <EditBookModal
          book={editingBook}
          onSave={handleSaveEditedBook}
          onClose={() => setEditingBook(null)}
        />
      )}

      {regeneratingCoverBook && (
        <CoverRegeneratorModal
          book={regeneratingCoverBook}
          onApplyCover={handleApplyNewCover}
          onClose={() => setRegeneratingCoverBook(null)}
        />
      )}

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      <ApiDocsModal
        isOpen={apiDocsOpen}
        onClose={() => setApiDocsOpen(false)}
      />

    </div>
  );
}
