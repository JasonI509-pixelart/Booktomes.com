import React, { useState } from 'react';
import { Book } from '../types';
import { 
  Shield, Plus, Edit3, Trash2, Download, Sparkles, Copy, 
  Check, Eye, EyeOff, Search, FileText, CheckCircle2, X, Wand2, Image as ImageIcon 
} from 'lucide-react';
import { generateThematicCoverSvg } from '../utils/thematicCovers';
import { AdminCoverStudioModal } from './AdminCoverStudioModal';

interface AdminPanelProps {
  books: Book[];
  onOpenBook: (book: Book) => void;
  onEditBook: (book: Book) => void;
  onDeleteBook: (bookId: string) => void;
  onTogglePublish: (bookId: string) => void;
  onRegenerateCover: (book: Book) => void;
  onCreateNew: () => void;
  onOpenApiDocs?: () => void;
  onApplyCoverToBook?: (bookId: string, coverUrl: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  books,
  onOpenBook,
  onEditBook,
  onDeleteBook,
  onTogglePublish,
  onRegenerateCover,
  onCreateNew,
  onOpenApiDocs,
  onApplyCoverToBook,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAge, setFilterAge] = useState('all');
  const [filterPublish, setFilterPublish] = useState<'all' | 'published' | 'draft'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCoverStudio, setShowCoverStudio] = useState(false);

  // Filter books
  const filteredBooks = books.filter((b) => {
    const matchesSearch =
      b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.blurb.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.genre.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAge = filterAge === 'all' || b.ageGroup.includes(filterAge);
    const matchesPublish =
      filterPublish === 'all' ||
      (filterPublish === 'published' && b.isPublished) ||
      (filterPublish === 'draft' && !b.isPublished);

    return matchesSearch && matchesAge && matchesPublish;
  });

  const handleCopyCoverUrl = (book: Book) => {
    const coverSrc = book.coverUrl && book.coverUrl.trim() !== ''
      ? book.coverUrl
      : generateThematicCoverSvg(book.title, book.blurb, book.ageGroup, book.genre);

    const fullUrl = coverSrc.startsWith('data:')
      ? coverSrc
      : window.location.origin + coverSrc;

    navigator.clipboard.writeText(fullUrl);
    setCopiedId(book.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDownloadNovel = (book: Book, format: 'txt' | 'md' | 'json') => {
    let content = '';
    let mimeType = 'text/plain;charset=utf-8';
    let ext = 'txt';

    if (format === 'json') {
      content = JSON.stringify(book, null, 2);
      mimeType = 'application/json';
      ext = 'json';
    } else if (format === 'md') {
      content = `# ${book.title}\n\n**Age Group:** ${book.ageGroup}  \n**Genre:** ${book.genre}  \n**Word Count:** ${book.actualWordCount || book.targetWordCount} words  \n\n> *${book.blurb}*\n\n**Moral of the Story:** ${book.moral}\n\n---\n\n`;
      content += book.chapters
        .map((ch) => `## Chapter ${ch.chapterNumber}: ${ch.title}\n\n${ch.content}\n\n`)
        .join('\n---\n\n');
      ext = 'md';
    } else {
      content = `${book.title.toUpperCase()}\nAge Group: ${book.ageGroup}\nGenre: ${book.genre}\nWord Count: ${book.actualWordCount || book.targetWordCount}\n\nBLURB:\n${book.blurb}\n\nMORAL:\n${book.moral}\n\n` +
        '='.repeat(50) + '\n\n' +
        book.chapters
          .map((ch) => `CHAPTER ${ch.chapterNumber}: ${ch.title.toUpperCase()}\n\n${ch.content}\n\n`)
          .join('-'.repeat(50) + '\n\n');
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${book.title.replace(/[^a-zA-Z0-9]/g, '_')}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Top Admin Banner */}
      <div className="bg-stone-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border border-stone-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-black mb-3">
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span>Master Admin Studio</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black font-['Fredoka'] tracking-tight">
            Book Engine Management Studio
          </h1>
          <p className="text-stone-400 text-sm mt-1 max-w-xl">
            Create, edit, publish, unpublish, download manuscripts, generate fresh covers, copy image URLs, and manage all books in the database.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onOpenApiDocs && (
            <button
              onClick={onOpenApiDocs}
              className="px-4 py-3 rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs border border-stone-700 transition-all"
            >
              API Architecture
            </button>
          )}

          <button
            onClick={() => setShowCoverStudio(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-sm shadow-lg shadow-purple-600/25 transition-all transform active:scale-95"
            title="Instant High-Graphics Book Cover Studio (Pollinations Flux)"
          >
            <Sparkles className="w-5 h-5 text-amber-300" />
            <span>Instant Cover Studio</span>
          </button>

          <button
            onClick={onCreateNew}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-sm shadow-lg shadow-orange-500/25 transition-all transform active:scale-95"
          >
            <Plus className="w-5 h-5 text-white" />
            <span>Forge / Create Book</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter books by title or keyword..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-amber-50/50 border border-amber-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Age Filter */}
          <select
            value={filterAge}
            onChange={(e) => setFilterAge(e.target.value)}
            className="px-3 py-2 rounded-xl bg-amber-50/50 border border-amber-200 text-xs font-bold text-stone-700 focus:outline-none"
          >
            <option value="all">All Age Groups</option>
            <option value="4-7">4-7 Early Reader</option>
            <option value="8-10">8-10 Middle Grade</option>
            <option value="11-13">11-13 Chapter Book</option>
          </select>

          {/* Publish Status Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-amber-100/70 rounded-xl border border-amber-200">
            <button
              onClick={() => setFilterPublish('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterPublish === 'all'
                  ? 'bg-amber-500 text-stone-950 shadow-sm'
                  : 'text-stone-700 hover:bg-amber-200/60'
              }`}
            >
              All Books ({books.length})
            </button>
            <button
              onClick={() => setFilterPublish('published')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterPublish === 'published'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-stone-700 hover:bg-amber-200/60'
              }`}
            >
              Published ({books.filter((b) => b.isPublished).length})
            </button>
            <button
              onClick={() => setFilterPublish('draft')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterPublish === 'draft'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-stone-700 hover:bg-amber-200/60'
              }`}
            >
              Only Unlisted Books ({books.filter((b) => !b.isPublished).length})
            </button>
          </div>
        </div>
      </div>

      {/* Books Table / Grid List */}
      <div className="bg-white rounded-3xl border border-amber-200 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-stone-700">
            <thead className="bg-amber-100/60 text-stone-800 text-xs uppercase font-['Fredoka'] tracking-wider border-b border-amber-200">
              <tr>
                <th className="py-4 px-6 font-black">Cover & Title</th>
                <th className="py-4 px-4 font-black">Age & Genre</th>
                <th className="py-4 px-4 font-black">Word Count</th>
                <th className="py-4 px-4 font-black">Status</th>
                <th className="py-4 px-6 font-black text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredBooks.map((book) => {
                const coverSrc = book.coverUrl && book.coverUrl.trim() !== ''
                  ? book.coverUrl
                  : generateThematicCoverSvg(book.title, book.blurb, book.ageGroup, book.genre);

                return (
                  <tr key={book.id} className="hover:bg-amber-50/40 transition-colors">
                    
                    {/* Cover & Title */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div 
                          onClick={() => onOpenBook(book)}
                          className="w-14 h-18 rounded-lg overflow-hidden flex-shrink-0 bg-stone-100 border border-amber-200 shadow-sm cursor-pointer hover:opacity-90"
                        >
                          <img
                            src={coverSrc}
                            alt={book.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover pointer-events-none"
                          />
                        </div>
                        <div>
                          <h4 
                            onClick={() => onOpenBook(book)}
                            className="font-extrabold text-stone-900 font-['Fredoka'] text-base hover:text-orange-600 cursor-pointer"
                          >
                            {book.title}
                          </h4>
                          <p className="text-xs text-stone-500 line-clamp-1 max-w-md mt-0.5">
                            {book.blurb}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Age & Genre */}
                    <td className="py-4 px-4">
                      <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 mb-1">
                        {book.ageGroup}
                      </span>
                      <p className="text-xs text-stone-500 font-medium">
                        {book.genre}
                      </p>
                    </td>

                    {/* Word Count */}
                    <td className="py-4 px-4">
                      <span className="font-mono text-xs font-bold text-stone-800">
                        {(book.actualWordCount || book.targetWordCount).toLocaleString()}
                      </span>
                      <p className="text-[11px] text-stone-400">
                        {book.chapters.length} chapters
                      </p>
                    </td>

                    {/* Status Toggle */}
                    <td className="py-4 px-4">
                      <button
                        onClick={() => onTogglePublish(book.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                          book.isPublished
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                        }`}
                      >
                        {book.isPublished ? (
                          <>
                            <Eye className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Published</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3.5 h-3.5 text-stone-500" />
                            <span>Unlisted</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* Action Buttons */}
                    <td className="py-4 px-6 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        
                        {/* Generate New Cover Button */}
                        <button
                          onClick={() => onRegenerateCover(book)}
                          title="Generate new cover (keeps story text & blurb)"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 transition-all border border-amber-300"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                          <span>New Cover</span>
                        </button>

                        {/* Copy Link Address for Cover */}
                        <button
                          onClick={() => handleCopyCoverUrl(book)}
                          title="Copy cover image link address"
                          className="p-2 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-all border border-stone-200"
                        >
                          {copiedId === book.id ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>

                        {/* Download Menu (TXT, MD, JSON) */}
                        <button
                          onClick={() => handleDownloadNovel(book, 'txt')}
                          title="Download Novel TXT"
                          className="p-2 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-all border border-stone-200"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        {/* Edit Book */}
                        <button
                          onClick={() => onEditBook(book)}
                          title="Edit book details & chapters"
                          className="p-2 rounded-xl text-blue-600 hover:bg-blue-50 transition-all border border-blue-200"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {/* Delete Book */}
                        <button
                          onClick={() => onDeleteBook(book.id)}
                          title="Delete book from database"
                          className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-all border border-rose-200"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                      </div>
                    </td>

                  </tr>
                );
              })}

              {filteredBooks.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-stone-500">
                    <p className="font-bold text-base mb-1">No books match your search or filter</p>
                    <p className="text-xs">Try adjusting your search query or create a brand-new book!</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Instant Cover Studio Modal */}
      {showCoverStudio && (
        <AdminCoverStudioModal
          books={books}
          onApplyCoverToBook={(bookId, coverUrl) => {
            if (onApplyCoverToBook) {
              onApplyCoverToBook(bookId, coverUrl);
            } else {
              const target = books.find((b) => b.id === bookId);
              if (target) {
                onEditBook({ ...target, coverUrl });
              }
            }
          }}
          onClose={() => setShowCoverStudio(false)}
        />
      )}

    </div>
  );
};
