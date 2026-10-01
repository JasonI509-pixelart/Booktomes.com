import React, { useState, useMemo, useEffect } from 'react';
import { AVAILABLE_FONTS, FontOption, loadGoogleFont, loadGoogleFonts } from '../utils/fontsData';
import { X, Search, Type, Check } from 'lucide-react';

interface FontPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFont: string;
  onSelectFont: (fontName: string) => void;
}

export const FontPickerModal: React.FC<FontPickerModalProps> = ({
  isOpen,
  onClose,
  currentFont,
  onSelectFont,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 48;

  const categories = [
    'all',
    'Comic & Playful',
    'Storybook Serif',
    'Friendly Sans',
    'Handwritten',
    'Display & Creative',
    'Monospace',
  ];

  const filteredFonts = useMemo(() => {
    return AVAILABLE_FONTS.filter((font) => {
      const matchesSearch = font.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || font.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [search, selectedCategory]);

  const totalPages = Math.ceil(filteredFonts.length / PAGE_SIZE) || 1;
  const paginatedFonts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredFonts.slice(start, start + PAGE_SIZE);
  }, [filteredFonts, page]);

  // Pre-load current batch of fonts so every card renders in its true font face immediately
  useEffect(() => {
    if (isOpen) {
      const names = paginatedFonts.map((f) => f.name);
      loadGoogleFonts(names);
    }
  }, [isOpen, paginatedFonts]);

  // Reset page when search or category changes
  useEffect(() => {
    setPage(1);
  }, [search, selectedCategory]);

  if (!isOpen) return null;

  const handlePickFont = (fontName: string) => {
    loadGoogleFont(fontName);
    onSelectFont(fontName);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border-2 border-amber-300 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 bg-amber-500 text-stone-950 flex items-center justify-between border-b border-amber-600">
          <div className="flex items-center gap-2.5">
            <Type className="w-5 h-5 text-stone-950" />
            <div>
              <h3 className="text-xl font-black font-['Fredoka']">
                500 Storybook Fonts Gallery
              </h3>
              <p className="text-xs text-amber-950 font-medium">
                Each font is rendered in its true typeface so you can see exactly how your novel will look
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-amber-600/30 text-stone-950 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Categories Bar */}
        <div className="p-4 bg-stone-50 border-b border-stone-200 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search 500 fonts (e.g. Cortez, Bubblegum, Fredoka, Sniglet, Bangers, Lora)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-stone-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex-shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-stone-950 font-black shadow-sm'
                    : 'bg-white text-stone-600 hover:bg-amber-100/60 border border-stone-200'
                }`}
              >
                {cat === 'all' ? `All (${AVAILABLE_FONTS.length} Fonts)` : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Font Cards Grid */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 flex-1">
          {paginatedFonts.map((font) => {
            const isSelected = currentFont.toLowerCase() === font.name.toLowerCase();
            return (
              <button
                key={font.name}
                onClick={() => handlePickFont(font.name)}
                className={`p-4 rounded-2xl text-left border-2 transition-all flex flex-col justify-between group ${
                  isSelected
                    ? 'bg-amber-100/80 border-amber-500 ring-2 ring-amber-400/40'
                    : 'bg-white border-stone-200 hover:border-amber-400 hover:bg-amber-50/50 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  {/* Font Name rendered in its own real typography */}
                  <span
                    className="text-lg font-black text-stone-900 group-hover:text-amber-800 leading-tight truncate pr-2"
                    style={{ fontFamily: `"${font.name}", cursive, sans-serif` }}
                  >
                    {font.name}
                  </span>
                  {isSelected && <Check className="w-4 h-4 text-amber-600 flex-shrink-0" />}
                </div>

                {/* Sample phrase rendered in the actual font */}
                <div 
                  className="text-sm text-stone-600 line-clamp-1 truncate w-full my-1"
                  style={{ fontFamily: `"${font.name}", cursive, sans-serif` }}
                >
                  The quick brown fox jumps over the lazy dog
                </div>

                <div className="flex items-center justify-between w-full mt-2 pt-2 border-t border-stone-100">
                  <span className="text-[10px] uppercase font-bold text-stone-400">
                    {font.category}
                  </span>
                  <span className="text-[10px] font-bold text-amber-700 opacity-0 group-hover:opacity-100 transition-opacity">
                    Select Font →
                  </span>
                </div>
              </button>
            );
          })}

          {filteredFonts.length === 0 && (
            <div className="col-span-full py-12 text-center text-stone-500 text-xs font-bold">
              No fonts match "{search}".
            </div>
          )}
        </div>

        {/* Footer with Pagination */}
        <div className="px-6 py-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs text-stone-600">
          <div>
            Active Font:{' '}
            <strong
              className="text-amber-900 ml-1 text-sm"
              style={{ fontFamily: `"${currentFont}", cursive, sans-serif` }}
            >
              {currentFont}
            </strong>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 disabled:opacity-40 font-bold"
              >
                ← Prev
              </button>
              <span className="font-mono text-stone-500">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 disabled:opacity-40 font-bold"
              >
                Next →
              </button>
            </div>
          )}

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
