import React, { useState } from 'react';
import { Book } from '../types';
import { BookOpen, Sparkles, Copy, Check, Eye, Trash2, Edit3, Download } from 'lucide-react';
import { generateThematicCoverSvg } from '../utils/thematicCovers';

interface BookCardProps {
  book: Book;
  onRead: (book: Book) => void;
  isAdmin?: boolean;
  onEdit?: (book: Book) => void;
  onDelete?: (bookId: string) => void;
  onTogglePublish?: (bookId: string) => void;
  onRegenerateCover?: (book: Book) => void;
}

export const BookCard: React.FC<BookCardProps> = ({
  book,
  onRead,
  isAdmin = false,
  onEdit,
  onDelete,
  onTogglePublish,
  onRegenerateCover,
}) => {
  const [copied, setCopied] = useState(false);

  // Fallback to thematic SVG cover if no image path exists
  const coverSrc = book.coverUrl && book.coverUrl.trim() !== ''
    ? book.coverUrl
    : generateThematicCoverSvg(book.title, book.blurb, book.ageGroup, book.genre);

  const handleCopyCoverAddress = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Copy the absolute URL of the cover
    const fullUrl = coverSrc.startsWith('data:') 
      ? coverSrc 
      : window.location.origin + coverSrc;

    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = (e: React.MouseEvent) => {
    e.stopPropagation();
    const chaptersText = book.chapters
      .map(
        (ch) =>
          `CHAPTER ${ch.chapterNumber}: ${ch.title.toUpperCase()}\n\n${ch.content}\n\n`
      )
      .join('--------------------------------------------------\n\n');

    const fullContent = `${book.title.toUpperCase()}\nAge Group: ${book.ageGroup}\nGenre: ${book.genre}\nWord Count: ${book.actualWordCount || book.targetWordCount}\n\nBLURB:\n${book.blurb}\n\nMORAL:\n${book.moral}\n\n==================================================\n\n${chaptersText}`;

    const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${book.title.replace(/[^a-zA-Z0-9]/g, '_')}_Novel.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-3xl border-2 border-amber-200/90 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden group hover:-translate-y-1">
      {/* Book Cover Area */}
      <div 
        onClick={() => onRead(book)}
        className="relative aspect-[3/4] bg-stone-100 overflow-hidden cursor-pointer select-none"
      >
        <img
          src={coverSrc}
          alt={book.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 pointer-events-none"
        />

        {/* Glossy Spine effect overlay */}
        <div className="absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-black/30 via-black/10 to-transparent pointer-events-none" />

        {/* Protection Shield overlay to prevent drag & drop / right click on reader preview */}
        <div className="absolute inset-0 bg-transparent" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
          <span className="px-2.5 py-1 text-xs font-black tracking-wide bg-amber-400 text-stone-900 rounded-full shadow-md font-['Fredoka']">
            {book.ageGroup}
          </span>
          {!book.isPublished && (
            <span className="px-2.5 py-1 text-xs font-bold bg-rose-500 text-white rounded-full shadow-md">
              Draft / Unlisted
            </span>
          )}
        </div>

        <div className="absolute bottom-3 right-3 z-10">
          <span className="px-2.5 py-1 text-xs font-bold bg-stone-900/80 backdrop-blur-md text-white rounded-full shadow-md">
            {(book.actualWordCount || book.targetWordCount).toLocaleString()} words
          </span>
        </div>

        {/* Hover Read Overlay */}
        <div className="absolute inset-0 bg-stone-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <span className="px-5 py-2.5 rounded-full bg-orange-500 text-white font-extrabold text-sm shadow-lg flex items-center gap-2 transform translate-y-2 group-hover:translate-y-0 transition-transform">
            <BookOpen className="w-4 h-4" />
            Read
          </span>
        </div>
      </div>

      {/* Book Metadata & Blurb */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 
              onClick={() => onRead(book)}
              className="font-black text-xl text-stone-900 leading-snug font-['Fredoka'] line-clamp-2 cursor-pointer hover:text-orange-600 transition-colors"
            >
              {book.title}
            </h3>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-stone-100 text-stone-700">
              {book.genre || 'Adventure'}
            </span>
            <span className="text-xs text-stone-500 font-medium">
              {book.chapters?.length || 1} Chapters
            </span>
          </div>

          <p className="text-sm text-stone-600 line-clamp-3 leading-relaxed mb-4">
            {book.blurb}
          </p>

          {book.moral && (
            <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 mb-4">
              <span className="font-bold">✨ Moral:</span> {book.moral}
            </div>
          )}
        </div>

        {/* Action Button: ONLY the Read button */}
        <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
          <button
            onClick={() => onRead(book)}
            className="w-full py-2.5 px-4 rounded-xl font-black text-sm bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-sm flex items-center justify-center gap-2 transition-all transform active:scale-98"
          >
            <BookOpen className="w-4 h-4" />
            <span>Read</span>
          </button>
        </div>
      </div>
    </div>
  );
};
