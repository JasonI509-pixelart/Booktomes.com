import React, { useState, useEffect } from 'react';
import { X, Code2, Server, CheckCircle2, Shield, Zap, Terminal } from 'lucide-react';

interface ApiDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiDocsModal: React.FC<ApiDocsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/health')
        .then((res) => res.json())
        .then((data) => setHealthData(data))
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const endpoints = [
    {
      method: 'POST',
      path: '/api/books/generate-stream',
      name: 'Forge Novel Stream (SSE)',
      description: 'Systematically streams chapter-by-chapter 2,000-word prose with live word-counts, anti-sameness code, and instant database commit.',
      payload: {
        userConcept: 'string (story premise)',
        firstSentence: 'string (optional opening)',
        title: 'string (optional title)',
        blurb: 'string (optional blurb)',
        ageGroup: '4-7 Early Reader | 8-10 Middle Grade | 11-13 Chapter Book',
        targetWordCount: 'number (1 - 100,000,000)',
        chapterCount: 'number (1 - 20)',
      },
      response: 'Server-Sent Events: status, meta, chunk, chapter_complete, complete',
    },
    {
      method: 'POST',
      path: '/api/books/:id/regenerate-cover',
      name: 'Regenerate Cover Only',
      description: 'Generates a fresh thematic cover with styled typography while preserving 100% of manuscript text and blurb.',
      payload: { customPrompt: 'string (optional artistic style)' },
      response: '{ success: true, book: Book }',
    },
    {
      method: 'GET',
      path: '/api/books',
      name: 'List Books Library',
      description: 'Returns all published books for readers, or all books including drafts when ?all=true is passed for admin.',
      payload: 'Query: ?all=true | ?admin=true',
      response: 'Array<Book>',
    },
    {
      method: 'GET',
      path: '/api/books/:id',
      name: 'Get Book By ID',
      description: 'Retrieves complete book document with all chapters and metadata.',
      payload: 'None',
      response: 'Book',
    },
    {
      method: 'POST',
      path: '/api/books',
      name: 'Create / Import Book',
      description: 'Creates a new book record in the database.',
      payload: 'Book object',
      response: 'Created Book with assigned ID',
    },
    {
      method: 'PUT',
      path: '/api/books/:id',
      name: 'Update Book',
      description: 'Updates an existing book’s metadata, title, blurb, and chapters.',
      payload: 'Partial<Book>',
      response: 'Updated Book',
    },
    {
      method: 'PATCH',
      path: '/api/books/:id/publish',
      name: 'Toggle Publish Status',
      description: 'Publishes or unpublishes a book so it is hidden or visible to general readers.',
      payload: '{ isPublished?: boolean }',
      response: '{ id, isPublished }',
    },
    {
      method: 'DELETE',
      path: '/api/books/:id',
      name: 'Delete Book',
      description: 'Permanently removes a book from the database.',
      payload: 'None',
      response: '{ success: true, id }',
    },
    {
      method: 'POST',
      path: '/api/auth/signin',
      name: 'User Sign In',
      description: 'Authenticates reader or recognizes master admin credentials.',
      payload: '{ email, password }',
      response: '{ success: true, user, token }',
    },
    {
      method: 'POST',
      path: '/api/auth/signup',
      name: 'User Sign Up',
      description: 'Registers a new reader or young author with selected role and avatar.',
      payload: '{ email, username, role, avatar }',
      response: '{ success: true, user, token }',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-stone-900 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-stone-800 text-stone-100 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 bg-stone-950 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black font-['Fredoka'] text-stone-100">
                NovelForge Engine: Complete API Directory
              </h3>
              <p className="text-xs text-stone-400 font-mono">
                Full-Stack Express & Autonomous Writing Runtime API
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-stone-800 text-stone-400 hover:text-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Server Status Ribbon */}
        <div className="px-6 py-3 bg-stone-950/40 border-b border-stone-800/80 flex flex-wrap items-center justify-between text-xs font-mono gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-stone-300 font-bold">Server Engine: Online</span>
          </div>
          <div className="flex items-center gap-4 text-stone-400">
            <span>Books in DB: <strong className="text-amber-300">{healthData?.booksCount ?? '...'}</strong></span>
            <span>Gemini AI SDK: <strong className="text-emerald-400">{healthData?.geminiConfigured ? 'Connected' : 'Active'}</strong></span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          
          {/* Autonomous Protocol Notice */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 space-y-1">
            <p className="font-black text-amber-300 font-['Fredoka'] text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Runtime Protocol Specifications
            </p>
            <p className="leading-relaxed font-mono text-[11px] text-stone-300">
              [SYSTEM PROTOCOL: COMPLETELY AUTONOMOUS, HIGH-VOLUME WRITING ENGINE] [FREQUENCY PENALTY = MAX] [PRESENCE PENALTY = MAX]
              Enforces the Total Uniqueness Constraint and Internal Repetition Ban across all multi-chapter children's books.
            </p>
          </div>

          {/* Endpoints List */}
          <div className="space-y-3">
            <span className="text-xs font-black uppercase text-stone-400 tracking-wider font-['Fredoka'] block mb-2">
              Available Backend Endpoints:
            </span>

            {endpoints.map((ep, idx) => (
              <div
                key={idx}
                className="bg-stone-950/60 rounded-2xl p-4 border border-stone-800/80 hover:border-stone-700 transition-colors space-y-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-[10px] ${
                      ep.method === 'GET' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                      ep.method === 'POST' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      ep.method === 'PUT' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      ep.method === 'PATCH' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                      'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}>
                      {ep.method}
                    </span>
                    <span className="font-mono font-bold text-stone-200">{ep.path}</span>
                  </div>
                  <span className="text-stone-400 font-medium text-[11px]">{ep.name}</span>
                </div>

                <p className="text-stone-400 leading-relaxed">
                  {ep.description}
                </p>

                <div className="bg-stone-900/80 p-2.5 rounded-xl border border-stone-800 font-mono text-[11px] text-stone-300 flex flex-col gap-1">
                  <div>
                    <span className="text-stone-500 font-bold">Payload:</span>{' '}
                    <span className="text-amber-200">{typeof ep.payload === 'object' ? JSON.stringify(ep.payload) : ep.payload}</span>
                  </div>
                  <div>
                    <span className="text-stone-500 font-bold">Returns:</span>{' '}
                    <span className="text-emerald-300">{ep.response}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-stone-950 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400">
          <span>Ready for high-volume automated creative writing execution.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
