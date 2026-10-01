import React, { useState, useMemo } from 'react';
import { Book, Chapter } from '../types';
import { 
  X, Save, Plus, Trash2, Sparkles, Image as ImageIcon, 
  Loader2, Check, FileText, Layers, RefreshCw, UserCheck, Download
} from 'lucide-react';
import { generatePageArtwork } from '../services/puterService';
import { 
  generatePollinationsPageImage, 
  resolveCharacterAnchor,
  downloadImageFromUrl
} from '../services/pollinationsService';

interface EditBookModalProps {
  book: Book;
  onSave: (updatedBook: Book) => void;
  onClose: () => void;
}

export const EditBookModal: React.FC<EditBookModalProps> = ({
  book,
  onSave,
  onClose,
}) => {
  const [title, setTitle] = useState(book.title);
  const [blurb, setBlurb] = useState(book.blurb);
  const [firstSentence, setFirstSentence] = useState(book.firstSentence || '');
  const [ageGroup, setAgeGroup] = useState(book.ageGroup);
  const [genre, setGenre] = useState(book.genre);
  const [moral, setMoral] = useState(book.moral);
  const [fontFamily, setFontFamily] = useState(book.fontFamily || book.coverTheme?.fontFamily || 'Fredoka');
  const [characterProfile, setCharacterProfile] = useState(
    book.characterProfile || resolveCharacterAnchor(book)
  );
  const [isPublished, setIsPublished] = useState(book.isPublished !== false);
  const [chapters, setChapters] = useState<Chapter[]>(book.chapters || []);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);

  // Sub-view for the active chapter: 'pages' (each page with image generation) or 'prose' (full text)
  const [chapterViewTab, setChapterViewTab] = useState<'pages' | 'prose'>('pages');
  const [selectedPageNum, setSelectedPageNum] = useState<number>(1);
  const [isGeneratingPageImage, setIsGeneratingPageImage] = useState<boolean>(false);
  const [pageGenStatus, setPageGenStatus] = useState<string>('');

  const currentCh = chapters[activeChapterIndex] || {
    chapterNumber: 1,
    title: '',
    content: '',
    wordCount: 0,
    pageImages: {},
  };

  // Slice the current chapter into its individual printed reader pages
  const chapterPages = useMemo(() => {
    if (!currentCh || !currentCh.content) return [];
    const paragraphs = currentCh.content.split('\n').map((p) => p.trim()).filter(Boolean);
    const pages: { pageNum: number; text: string; wordCount: number; imageUrl?: string }[] = [];
    let currentParas: string[] = [];
    let words = 0;
    let pageIdx = 1;
    const wordsPerPage = book.wordsPerPage || 140;

    paragraphs.forEach((para) => {
      const pw = para.split(/\s+/).filter(Boolean).length;
      if (words > 0 && words + pw > wordsPerPage) {
        const img = currentCh.pageImages?.[pageIdx] || (pageIdx === 1 ? currentCh.imageUrl : undefined);
        pages.push({
          pageNum: pageIdx,
          text: currentParas.join('\n\n'),
          wordCount: words,
          imageUrl: img,
        });
        currentParas = [];
        words = 0;
        pageIdx++;
      }
      currentParas.push(para);
      words += pw;
    });

    if (currentParas.length > 0 || pageIdx === 1) {
      const img = currentCh.pageImages?.[pageIdx] || (pageIdx === 1 ? currentCh.imageUrl : undefined);
      pages.push({
        pageNum: pageIdx,
        text: currentParas.join('\n\n'),
        wordCount: words,
        imageUrl: img,
      });
    }

    return pages;
  }, [currentCh, book.wordsPerPage]);

  const activePageData = chapterPages.find((p) => p.pageNum === selectedPageNum) || chapterPages[0] || {
    pageNum: 1,
    text: currentCh.content,
    wordCount: currentCh.wordCount,
    imageUrl: currentCh.imageUrl,
  };

  const handleUpdateChapter = (field: 'title' | 'content' | 'imageUrl', value: string) => {
    const updated = [...chapters];
    updated[activeChapterIndex] = {
      ...updated[activeChapterIndex],
      [field]: value,
      wordCount: field === 'content' ? value.trim().split(/\s+/).filter(Boolean).length : updated[activeChapterIndex].wordCount,
    };
    setChapters(updated);
  };

  const handleAddChapter = () => {
    const newChNum = chapters.length + 1;
    const newCh: Chapter = {
      chapterNumber: newChNum,
      title: `Chapter ${newChNum}: The Next Surprise`,
      content: 'Write the chapter content here...',
      wordCount: 5,
      pageImages: {},
    };
    setChapters([...chapters, newCh]);
    setActiveChapterIndex(chapters.length);
    setSelectedPageNum(1);
  };

  const handleDeleteChapter = (indexToDelete: number) => {
    if (chapters.length <= 1) return;
    const filtered = chapters.filter((_, idx) => idx !== indexToDelete).map((ch, idx) => ({
      ...ch,
      chapterNumber: idx + 1,
    }));
    setChapters(filtered);
    setActiveChapterIndex(Math.max(0, activeChapterIndex - 1));
    setSelectedPageNum(1);
  };

  // Generate Image for a specific page of the current chapter using Pollinations.ai & Character Consistency
  const handleGenerateImageForPage = async (pageNumber: number, pageText: string) => {
    if (isGeneratingPageImage) return;

    setIsGeneratingPageImage(true);
    setPageGenStatus(`AI is analyzing Page ${pageNumber} scene and painting watercolor artwork via Pollinations.ai...`);

    try {
      const result = await generatePollinationsPageImage({
        book: { title, blurb, firstSentence, ageGroup, genre, characterProfile },
        chapterTitle: currentCh.title,
        pageText: pageText || currentCh.title,
        pageNumber,
        onAttempt: (att) => {
          setPageGenStatus(`Rendering Page ${pageNumber} with Pollinations.ai (attempt ${att}/3)...`);
        },
      });

      const updated = [...chapters];
      const ch = { ...updated[activeChapterIndex] };
      const pageImages = { ...(ch.pageImages || {}) };
      pageImages[pageNumber] = result.imageUrl;
      ch.pageImages = pageImages;

      // If page 1, sync chapter.imageUrl for backwards compatibility
      if (pageNumber === 1) {
        ch.imageUrl = result.imageUrl;
      }

      updated[activeChapterIndex] = ch;
      setChapters(updated);
      setPageGenStatus('✨ Pollinations image verified and fitted to page!');
      setTimeout(() => setPageGenStatus(''), 4000);
    } catch (err: any) {
      console.error('Error generating image for page:', err);
      // Fallback to local gallery if network is unavailable
      try {
        const fallback = await generatePageArtwork({
          bookTitle: title,
          chapterTitle: currentCh.title,
          pageText: pageText || currentCh.title,
          ageGroup,
          genre,
        });
        const updated = [...chapters];
        const ch = { ...updated[activeChapterIndex] };
        const pageImages = { ...(ch.pageImages || {}) };
        pageImages[pageNumber] = fallback.imageUrl;
        ch.pageImages = pageImages;
        if (pageNumber === 1) ch.imageUrl = fallback.imageUrl;
        updated[activeChapterIndex] = ch;
        setChapters(updated);
        setPageGenStatus('✨ Image added and fitted to page!');
        setTimeout(() => setPageGenStatus(''), 4000);
      } catch {
        setPageGenStatus('Could not generate image automatically. You can paste an image URL directly.');
        setTimeout(() => setPageGenStatus(''), 5000);
      }
    } finally {
      setIsGeneratingPageImage(false);
    }
  };

  const handleSetPageImageUrl = (pageNumber: number, url: string) => {
    const updated = [...chapters];
    const ch = { ...updated[activeChapterIndex] };
    const pageImages = { ...(ch.pageImages || {}) };
    if (url.trim() === '') {
      delete pageImages[pageNumber];
      if (pageNumber === 1) ch.imageUrl = '';
    } else {
      pageImages[pageNumber] = url.trim();
      if (pageNumber === 1) ch.imageUrl = url.trim();
    }
    ch.pageImages = pageImages;
    updated[activeChapterIndex] = ch;
    setChapters(updated);
  };

  const handleSave = () => {
    let totalWords = 0;
    chapters.forEach((c) => {
      totalWords += c.content.trim().split(/\s+/).filter(Boolean).length;
    });

    const updatedBook: Book = {
      ...book,
      title,
      blurb,
      firstSentence,
      ageGroup,
      genre,
      moral,
      fontFamily,
      characterProfile,
      isPublished,
      coverTheme: {
        ...(book.coverTheme || {
          theme: 'comic',
          primaryColor: '#f43f5e',
          secondaryColor: '#10b981',
          accentColor: '#fbbf24',
        }),
        fontFamily,
      },
      chapters,
      actualWordCount: totalWords,
    };

    onSave(updatedBook);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border-2 border-amber-300 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 bg-amber-500 text-stone-950 flex items-center justify-between border-b border-amber-600">
          <div>
            <h3 className="text-xl font-black font-['Fredoka']">Edit Book, Chapters & Page Illustrations</h3>
            <p className="text-xs text-amber-950 font-medium">
              Navigate to any chapter and generate fitted images for each page with zero gibberish spelling
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-amber-600/30 text-stone-950 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-stone-800">
          
          {/* Metadata Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1 font-['Fredoka']">
                Book Title (Spelled Correctly)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-amber-50/60 border border-amber-300 font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1 font-['Fredoka']">
                Age Group
              </label>
              <input
                type="text"
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-amber-50/60 border border-amber-300 font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1 font-['Fredoka']">
                Book Typography Font
              </label>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-amber-50/60 border border-amber-300 font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="Fredoka">Fredoka (Playful Comic)</option>
                <option value="Comic Neue">Comic Neue (Clean Cartoon)</option>
                <option value="Quicksand">Quicksand (Friendly Sans)</option>
                <option value="Bubblegum Sans">Bubblegum Sans (Sweet & Rounded)</option>
                <option value="Schoolbell">Schoolbell (Classroom Pencil)</option>
                <option value="Lora">Lora (Classic Storybook Serif)</option>
                <option value="Nunito">Nunito (Modern Warm Sans)</option>
                <option value="Merriweather">Merriweather (Literary Editorial)</option>
                <option value="OpenDyslexic">OpenDyslexic (Dyslexia Friendly)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1 font-['Fredoka']">
                Library Visibility Status
              </label>
              <button
                type="button"
                onClick={() => setIsPublished(!isPublished)}
                className={`w-full px-4 py-2 rounded-xl font-bold text-xs flex items-center justify-between border transition-all ${
                  isPublished
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-amber-100/90 border-amber-400 text-amber-900'
                }`}
              >
                <span>{isPublished ? '🟢 Public in Library' : '🔒 Unlisted (Admin Only)'}</span>
                <span className="text-[10px] underline font-extrabold">
                  {isPublished ? 'Click to Unlist' : 'Click to Publish'}
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1 font-['Fredoka']">
                Genre
              </label>
              <input
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-amber-50/60 border border-amber-300 font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1 font-['Fredoka']">
                Moral of the Story
              </label>
              <input
                type="text"
                value={moral}
                onChange={(e) => setMoral(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-amber-50/60 border border-amber-300 font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1 font-['Fredoka']">
              Back Cover Blurb
            </label>
            <textarea
              rows={2}
              value={blurb}
              onChange={(e) => setBlurb(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-amber-50/60 border border-amber-300 text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Protagonist Character Visual Consistency Anchor */}
          <div className="bg-amber-100/50 p-4 rounded-2xl border-2 border-amber-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-stone-900 font-['Fredoka'] flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-orange-600" />
                <span>Protagonist Character Consistency (Hair, Clothes & Appearance)</span>
              </label>
              <span className="text-[10px] text-amber-950 font-bold bg-amber-200/90 px-2 py-0.5 rounded-full self-start sm:self-auto">
                Guarantees Same Boy & Same Clothes Across All Pages
              </span>
            </div>
            <input
              type="text"
              value={characterProfile}
              onChange={(e) => setCharacterProfile(e.target.value)}
              placeholder="e.g. 10-year-old boy named Barnaby with messy brown hair, blue-and-white striped shirt, brown shorts, red sneakers"
              className="w-full px-3 py-2 rounded-xl bg-white border border-amber-300 font-medium text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p className="text-[11px] text-stone-500 mt-1">
              Every cover and interior chapter page will illustrate this exact boy with identical hair, facial features, and clothes unless the story explicitly specifies a change.
            </p>
          </div>

          {/* ======================================================== */}
          {/* CHAPTERS & EACH PAGE IMAGE GENERATION (CORE REQUIREMENT) */}
          {/* ======================================================== */}
          <div className="pt-4 border-t-2 border-amber-200">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <span className="text-sm font-black uppercase tracking-wider text-stone-900 font-['Fredoka'] flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-orange-600" />
                  <span>Chapters & Page Art Studio</span>
                </span>
                <p className="text-xs text-stone-500">
                  Select a chapter, then choose any page to generate or fit a scene illustration
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddChapter}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Chapter</span>
              </button>
            </div>

            {/* Chapter Selection Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4">
              {chapters.map((ch, idx) => {
                const imgCount = Object.keys(ch.pageImages || {}).length + (ch.imageUrl ? 1 : 0);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setActiveChapterIndex(idx);
                      setSelectedPageNum(1);
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex-shrink-0 flex items-center gap-1.5 ${
                      activeChapterIndex === idx
                        ? 'bg-orange-500 text-white shadow-md'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200'
                    }`}
                  >
                    <span>Ch. {ch.chapterNumber}</span>
                    {imgCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-mono">
                        🎨 {imgCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active Chapter Container */}
            {currentCh && (
              <div className="bg-amber-50/50 p-5 rounded-3xl border border-amber-200 space-y-4">
                
                {/* Chapter Title & Tab Switcher */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200">
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                      Chapter {currentCh.chapterNumber} Title
                    </label>
                    <input
                      type="text"
                      value={currentCh.title}
                      onChange={(e) => handleUpdateChapter('title', e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-white border border-amber-300 font-bold text-sm text-stone-900"
                    />
                  </div>

                  {/* Mode switcher: Pages View vs Raw Prose */}
                  <div className="flex items-center gap-1 self-start sm:self-end bg-amber-100/70 p-1 rounded-xl border border-amber-300">
                    <button
                      type="button"
                      onClick={() => setChapterViewTab('pages')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        chapterViewTab === 'pages'
                          ? 'bg-amber-500 text-stone-950 shadow-sm'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Pages & Art ({chapterPages.length} Pages)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setChapterViewTab('prose')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        chapterViewTab === 'prose'
                          ? 'bg-amber-500 text-stone-950 shadow-sm'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Full Text</span>
                    </button>
                  </div>

                  {chapters.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteChapter(activeChapterIndex)}
                      className="p-2 text-rose-600 hover:bg-rose-100 rounded-xl transition-all self-end"
                      title="Delete this chapter"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Status banner during image generation */}
                {pageGenStatus && (
                  <div className="p-3 rounded-2xl bg-amber-100 border border-amber-300 text-amber-950 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                    {isGeneratingPageImage ? (
                      <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
                    ) : (
                      <Check className="w-4 h-4 text-emerald-600" />
                    )}
                    <span>{pageGenStatus}</span>
                  </div>
                )}

                {/* VIEW TAB 1: PAGES & PER-PAGE IMAGE GENERATOR */}
                {chapterViewTab === 'pages' ? (
                  <div className="space-y-4">
                    
                    {/* Page selector pills within this chapter */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-black uppercase text-stone-600 font-['Fredoka']">
                          Select Page to Edit Art:
                        </label>
                        <span className="text-[11px] text-stone-400">
                          {chapterPages.length} reader pages in Chapter {currentCh.chapterNumber}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {chapterPages.map((pg) => {
                          const hasImg = Boolean(pg.imageUrl);
                          const isSel = pg.pageNum === activePageData.pageNum;
                          return (
                            <button
                              key={pg.pageNum}
                              type="button"
                              onClick={() => setSelectedPageNum(pg.pageNum)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 ${
                                isSel
                                  ? 'bg-amber-500 text-stone-950 font-black shadow-md ring-2 ring-amber-400'
                                  : hasImg
                                  ? 'bg-white text-stone-800 border border-amber-300 hover:bg-amber-100'
                                  : 'bg-stone-100 text-stone-600 border border-stone-200 hover:bg-stone-200'
                              }`}
                            >
                              <span>Page {pg.pageNum}</span>
                              {hasImg && <span title="Has Illustration">🎨</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Active Selected Page Card */}
                    <div className="bg-white rounded-2xl p-4 sm:p-5 border-2 border-amber-200/80 shadow-sm space-y-4">
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-black text-stone-900 font-['Fredoka'] text-base flex items-center gap-2">
                            <span>Chapter {currentCh.chapterNumber} • Page {activePageData.pageNum}</span>
                            {activePageData.imageUrl && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                                Illustrated
                              </span>
                            )}
                          </h4>
                          <p className="text-[11px] text-stone-400">
                            {activePageData.wordCount} words • Fits into storybook reader
                          </p>
                        </div>

                        {/* Generate Image Button for this specific page */}
                        <button
                          type="button"
                          disabled={isGeneratingPageImage}
                          onClick={() => handleGenerateImageForPage(activePageData.pageNum, activePageData.text)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md active:scale-95 transition-all disabled:opacity-50"
                        >
                          {isGeneratingPageImage ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Generating...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                              <span>
                                {activePageData.imageUrl ? 'Regenerate Page Image' : 'Generate Image for Page'}
                              </span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Illustration Display or Placeholder */}
                      {activePageData.imageUrl ? (
                        <div className="bg-amber-50/60 rounded-2xl p-4 border border-amber-200 flex flex-col items-center gap-3">
                          <img
                            src={activePageData.imageUrl}
                            alt="Unlimited Free High Graphics Book Cover Generator"
                            style={{
                              width: '100%',
                              maxWidth: '450px',
                              height: 'auto',
                              border: '1px solid #ddd',
                              boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                            }}
                            className="rounded-xl object-contain bg-white"
                          />

                          <div className="w-full flex items-center justify-between pt-2 border-t border-amber-200">
                            <div>
                              <span className="text-xs font-bold text-stone-800">
                                Fitted Storybook Illustration (Page {activePageData.pageNum})
                              </span>
                              <p className="text-[11px] text-stone-500">
                                Generated with character visual consistency (same boy, same hair, same clothes) via Pollinations.ai.
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => downloadImageFromUrl(activePageData.imageUrl!, `${title.replace(/[^a-zA-Z0-9]/g, '_')}_ch${currentCh.chapterNumber}_page${activePageData.pageNum}.jpg`)}
                                className="px-3 py-1 rounded-lg text-xs font-black bg-stone-900 hover:bg-stone-800 text-white flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                                title="Download page illustration"
                              >
                                <Download className="w-3.5 h-3.5 text-amber-300" />
                                <span>Download</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleSetPageImageUrl(activePageData.pageNum, '')}
                                className="px-3 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors"
                              >
                                Remove Image
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-amber-300 rounded-2xl p-6 text-center bg-amber-50/30">
                          <ImageIcon className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                          <p className="text-xs font-bold text-stone-700">
                            No illustration set for Page {activePageData.pageNum}
                          </p>
                          <p className="text-[11px] text-stone-400 max-w-sm mx-auto mt-1 mb-3">
                            Click "Generate Image for Page" above. AI will analyze the scene on this page and paint a soft watercolor illustration with zero misspelled text.
                          </p>
                        </div>
                      )}

                      {/* Manual Image URL input option */}
                      <div>
                        <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                          Or Paste Custom Page Image URL
                        </label>
                        <input
                          type="text"
                          value={activePageData.imageUrl || ''}
                          onChange={(e) => handleSetPageImageUrl(activePageData.pageNum, e.target.value)}
                          placeholder="https://... or /src/assets/images/..."
                          className="w-full px-3 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-800"
                        />
                      </div>

                      {/* Page Text Snippet */}
                      <div>
                        <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                          Story Text for Page {activePageData.pageNum}
                        </label>
                        <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs font-['Lora',serif] text-stone-700 whitespace-pre-line leading-relaxed max-h-36 overflow-y-auto">
                          {activePageData.text}
                        </div>
                      </div>

                    </div>

                  </div>
                ) : (
                  /* VIEW TAB 2: FULL RAW PROSE EDITING */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-stone-500 uppercase">
                        Raw Manuscript Prose
                      </label>
                      <span className="text-[11px] font-mono text-stone-400">
                        {currentCh.wordCount || currentCh.content.split(/\s+/).length} words
                      </span>
                    </div>
                    <textarea
                      rows={8}
                      value={currentCh.content}
                      onChange={(e) => handleUpdateChapter('content', e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-white border border-amber-300 text-sm font-['Lora',serif] leading-relaxed text-stone-900"
                      placeholder="Write the full chapter prose here..."
                    />
                  </div>
                )}

              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-3">
          <span className="text-xs text-stone-500">
            {chapters.length} chapters • Changes persist permanently
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black bg-orange-500 hover:bg-orange-600 text-white shadow-md transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
