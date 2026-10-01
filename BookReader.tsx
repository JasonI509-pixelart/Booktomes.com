import React, { useState, useEffect, useMemo } from 'react';
import { Book, Chapter } from '../types';
import { 
  BookOpen, FileText, ChevronLeft, ChevronRight, Type, Sparkles,
  Volume2, VolumeX, Play, Pause, Square, Headphones, ExternalLink, Gauge, Loader2
} from 'lucide-react';
import { generateThematicCoverSvg } from '../utils/thematicCovers';
import { FontPickerModal } from './FontPickerModal';
import { loadGoogleFont } from '../utils/fontsData';
import { ttsEngine, VOICE_PROFILES, VoicePersona, VoiceProfile } from '../services/ttsService';

interface BookReaderProps {
  book: Book;
  onExit: () => void;
  isAdmin?: boolean;
  onUpdateBook?: (book: Book) => void;
}

interface PageData {
  pageNumber: number;
  chapterNumber: number;
  chapterTitle: string;
  isChapterOpening: boolean;
  imageUrl?: string;
  content: string;
  wordCount: number;
}

export const BookReader: React.FC<BookReaderProps> = ({
  book,
  onExit,
  isAdmin = false,
  onUpdateBook,
}) => {
  const [viewMode, setViewMode] = useState<'real' | 'words'>('real');
  
  // Spread 0 = Closed Cover
  // Spread 1 = Pages 1 & 2
  // Spread 2 = Pages 3 & 4, etc.
  const [currentSpread, setCurrentSpread] = useState<number>(0);

  // Word-only mode chapter index & font size
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(0);
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('base');

  // Font is locked to the book's assigned font. Readers cannot change it; only admins can.
  const [bookFont, setBookFont] = useState<string>(
    book.fontFamily || book.coverTheme?.fontFamily || 'Fredoka'
  );
  const [fontModalOpen, setFontModalOpen] = useState(false);

  // Synchronize font whenever book changes
  useEffect(() => {
    const f = book.fontFamily || book.coverTheme?.fontFamily || 'Fredoka';
    setBookFont(f);
    loadGoogleFont(f);
  }, [book]);

  const coverSrc = book.coverUrl && book.coverUrl.trim() !== ''
    ? book.coverUrl
    : generateThematicCoverSvg(book.title, book.blurb, book.ageGroup, book.genre);

  // Slice the book manuscript into sequential printed pages
  const bookPages: PageData[] = useMemo(() => {
    const pages: PageData[] = [];
    let pageNum = 1;
    const targetWordsPerPage = book.wordsPerPage || 140;

    book.chapters.forEach((chapter) => {
      const paragraphs = chapter.content
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean);

      let currentPageParagraphs: string[] = [];
      let currentWordTally = 0;
      let isFirstPageOfChapter = true;
      let chapterPageIndex = 1;

      paragraphs.forEach((para) => {
        const paraWords = para.split(/\s+/).filter(Boolean).length;

        // If page has enough words and at least one paragraph, push it
        if (currentWordTally > 0 && currentWordTally + paraWords > targetWordsPerPage) {
          const pageImage = chapter.pageImages?.[chapterPageIndex] || (isFirstPageOfChapter ? chapter.imageUrl : undefined);
          pages.push({
            pageNumber: pageNum++,
            chapterNumber: chapter.chapterNumber,
            chapterTitle: chapter.title,
            isChapterOpening: isFirstPageOfChapter,
            imageUrl: pageImage,
            content: currentPageParagraphs.join('\n\n'),
            wordCount: currentWordTally,
          });
          currentPageParagraphs = [];
          currentWordTally = 0;
          isFirstPageOfChapter = false;
          chapterPageIndex++;
        }

        currentPageParagraphs.push(para);
        currentWordTally += paraWords;
      });

      // Push remaining paragraphs for this chapter
      if (currentPageParagraphs.length > 0 || isFirstPageOfChapter) {
        const pageImage = chapter.pageImages?.[chapterPageIndex] || (isFirstPageOfChapter ? chapter.imageUrl : undefined);
        pages.push({
          pageNumber: pageNum++,
          chapterNumber: chapter.chapterNumber,
          chapterTitle: chapter.title,
          isChapterOpening: isFirstPageOfChapter,
          imageUrl: pageImage,
          content: currentPageParagraphs.join('\n\n'),
          wordCount: currentWordTally,
        });
      }
    });

    return pages;
  }, [book]);

  const totalSpreads = Math.ceil(bookPages.length / 2);

  // Current double-page spread pages
  const leftPage: PageData | undefined =
    currentSpread > 0 ? bookPages[(currentSpread - 1) * 2] : undefined;
  const rightPage: PageData | undefined =
    currentSpread > 0 ? bookPages[(currentSpread - 1) * 2 + 1] : undefined;

  // Keyboard navigation: ArrowRight / ArrowLeft / Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onExit();
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        if (viewMode === 'real') {
          if (currentSpread < totalSpreads) {
            setCurrentSpread((s) => s + 1);
          }
        }
      } else if (e.key === 'ArrowLeft') {
        if (viewMode === 'real') {
          if (currentSpread > 0) {
            setCurrentSpread((s) => s - 1);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSpread, totalSpreads, viewMode, onExit]);

  // Text-To-Speech (Fish Speech & Neural Audio) Engine State
  const [selectedVoice, setSelectedVoice] = useState<VoicePersona>('fish-storyteller');
  const [speechSpeed, setSpeechSpeed] = useState<number>(1.0);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isAudioLoading, setIsAudioLoading] = useState<boolean>(false);
  const [currentNarratingPageNumber, setCurrentNarratingPageNumber] = useState<number | null>(null);
  const [autoTurnPages, setAutoTurnPages] = useState<boolean>(true);

  // Stop narration on unmount or spread change
  useEffect(() => {
    return () => {
      ttsEngine.stop();
    };
  }, []);

  const handleStopNarration = () => {
    ttsEngine.stop();
    setIsSpeaking(false);
    setIsPaused(false);
    setIsAudioLoading(false);
    setCurrentNarratingPageNumber(null);
  };

  const handleToggleNarrationPause = () => {
    ttsEngine.unlockAudio();
    if (isPaused) {
      ttsEngine.resume();
      setIsPaused(false);
      setIsSpeaking(true);
    } else if (isSpeaking) {
      ttsEngine.pause();
      setIsPaused(true);
    } else {
      // Start reading current spread or page
      if (leftPage) {
        handleNarratePage(leftPage);
      } else if (currentSpread === 0) {
        handleNarrateCurrentSpread();
      }
    }
  };

  const handleNarratePage = (page: PageData) => {
    ttsEngine.unlockAudio();
    if (currentNarratingPageNumber === page.pageNumber && (isSpeaking || isPaused)) {
      handleToggleNarrationPause();
      return;
    }

    handleStopNarration();
    setCurrentNarratingPageNumber(page.pageNumber);
    setIsSpeaking(true);
    setIsPaused(false);

    // Speak title if chapter opening, then body text
    const textToRead = `${page.isChapterOpening ? `Chapter ${page.chapterNumber}. ${page.chapterTitle}. ` : ''}${page.content}`;

    ttsEngine.speak(textToRead, selectedVoice, speechSpeed, {
      onLoading: () => {
        setIsAudioLoading(true);
      },
      onStart: () => {
        setIsAudioLoading(false);
        setIsSpeaking(true);
        setIsPaused(false);
      },
      onEnd: () => {
        setIsAudioLoading(false);
        setIsSpeaking(false);
        setIsPaused(false);

        // If auto-turn is enabled and this was the left page, proceed to right page
        if (rightPage && page.pageNumber === leftPage?.pageNumber) {
          handleNarratePage(rightPage);
        } else if (autoTurnPages && currentSpread < totalSpreads) {
          // If right page ended and there's a next spread, advance spread!
          setCurrentSpread((s) => s + 1);
        } else {
          setCurrentNarratingPageNumber(null);
        }
      },
      onError: () => {
        setIsAudioLoading(false);
        setIsSpeaking(false);
        setIsPaused(false);
        setCurrentNarratingPageNumber(null);
      },
    });
  };

  // Narrate entire current spread (left page then right page)
  const handleNarrateCurrentSpread = () => {
    ttsEngine.unlockAudio();
    if (currentSpread === 0) {
      // Read cover title and blurb
      const coverText = `${book.title}. ${book.blurb}.`;
      setIsSpeaking(true);
      setCurrentNarratingPageNumber(0);
      ttsEngine.speak(coverText, selectedVoice, speechSpeed, {
        onLoading: () => setIsAudioLoading(true),
        onStart: () => {
          setIsAudioLoading(false);
          setIsSpeaking(true);
          setIsPaused(false);
        },
        onEnd: () => {
          setIsAudioLoading(false);
          setIsSpeaking(false);
          setCurrentNarratingPageNumber(null);
          if (autoTurnPages) setCurrentSpread(1);
        },
        onError: () => {
          setIsAudioLoading(false);
          setIsSpeaking(false);
          setCurrentNarratingPageNumber(null);
        },
      });
      return;
    }

    if (leftPage) {
      handleNarratePage(leftPage);
    }
  };

  // Narrate chapter in text view
  const handleNarrateChapter = (chapter: Chapter) => {
    ttsEngine.unlockAudio();
    handleStopNarration();
    const text = `Chapter ${chapter.chapterNumber}: ${chapter.title}. ${chapter.content}`;
    setIsSpeaking(true);
    setIsPaused(false);
    setCurrentNarratingPageNumber(-chapter.chapterNumber);

    ttsEngine.speak(text, selectedVoice, speechSpeed, {
      onEnd: () => {
        setIsSpeaking(false);
        setIsPaused(false);
        setCurrentNarratingPageNumber(null);
      },
    });
  };

  // Jump to a specific chapter
  const handleJumpToChapter = (chapterNum: number) => {
    const targetPageIndex = bookPages.findIndex((p) => p.chapterNumber === chapterNum);
    if (targetPageIndex !== -1) {
      const spreadIndex = Math.floor(targetPageIndex / 2) + 1;
      setCurrentSpread(spreadIndex);
      setCurrentChapterIndex(chapterNum - 1);
    }
  };

  const handlePreventCopy = (e: React.SyntheticEvent) => {
    e.preventDefault();
    return false;
  };

  if (!book.isPublished && !isAdmin) {
    return (
      <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-black font-['Fredoka'] mb-2">
          This Storybook is Currently Unlisted
        </h2>
        <p className="text-stone-400 text-sm max-w-md mb-6 leading-relaxed">
          This book has been unpublished by the author and is not available for public reading.
        </p>
        <button
          onClick={onExit}
          className="px-6 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-sm shadow-md transition-all"
        >
          Return to Library
        </button>
      </div>
    );
  }

  return (
    <div
      onCopy={handlePreventCopy}
      onCut={handlePreventCopy}
      onContextMenu={handlePreventCopy}
      onDragStart={handlePreventCopy}
      className="min-h-screen bg-[#1c1917] text-stone-100 flex flex-col select-none cursor-default"
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* Top Reader Navigation Bar */}
      <header className="bg-stone-950/90 backdrop-blur-md border-b border-stone-800 px-4 sm:px-6 py-3 sticky top-0 z-30 flex items-center justify-between gap-4">
        
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition-all border border-stone-700 shadow-sm"
            title="Exit reader and return to library"
          >
            <ChevronLeft className="w-4 h-4 text-orange-400" />
            <span>Library</span>
          </button>

          <div>
            <h1 className="font-extrabold text-sm sm:text-base text-stone-200 font-['Fredoka'] line-clamp-1">
              {book.title}
            </h1>
            <p className="text-[11px] text-stone-400">
              {book.ageGroup} • {book.genre} • Font: <strong className="text-amber-400">{bookFont}</strong>
            </p>
          </div>
        </div>

        {/* View Mode Toggle and Reading Status */}
        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="bg-stone-900 p-1 rounded-xl border border-stone-800 flex items-center gap-1">
            <button
              onClick={() => setViewMode('real')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'real'
                  ? 'bg-amber-500 text-stone-950 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Book View</span>
            </button>

            <button
              onClick={() => setViewMode('words')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'words'
                  ? 'bg-amber-500 text-stone-950 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Text View</span>
            </button>
          </div>

          {/* Jump to Chapter */}
          <select
            value={currentChapterIndex + 1}
            onChange={(e) => handleJumpToChapter(Number(e.target.value))}
            className="hidden sm:block px-3 py-1.5 text-xs font-bold bg-stone-900 border border-stone-800 rounded-xl text-amber-200 focus:outline-none"
          >
            {book.chapters.map((ch) => (
              <option key={ch.chapterNumber} value={ch.chapterNumber}>
                Ch. {ch.chapterNumber}: {ch.title}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Audio Narration Bar: Fish Speech (https://github.com/fishaudio/fish-speech) */}
      <div className="bg-stone-900 border-b border-stone-800 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs z-20">
        
        {/* Play/Pause & Stop Controls - Clean Read button */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleNarrationPause}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xs transition-all shadow-md active:scale-95 ${
              isSpeaking
                ? 'bg-amber-400 hover:bg-amber-500 text-stone-950 ring-2 ring-amber-300'
                : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white'
            }`}
            title={isSpeaking ? 'Pause' : isPaused ? 'Resume' : 'Read Aloud with Fish Speech'}
          >
            {isSpeaking ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </>
            ) : isPaused ? (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Resume</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                <span>Read</span>
              </>
            )}
          </button>

          {(isSpeaking || isPaused) && (
            <button
              onClick={handleStopNarration}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-800 hover:bg-rose-950 hover:text-rose-400 text-stone-400 border border-stone-700 font-bold transition-all"
              title="Stop Reading"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop</span>
            </button>
          )}

          {/* Animated Equalizer Wave when speaking */}
          {isSpeaking && (
            <div className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <span className="w-1 h-3.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-2.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              <span className="text-[11px] font-bold text-amber-300 ml-1">
                {currentNarratingPageNumber !== null
                  ? currentNarratingPageNumber === 0
                    ? 'Cover'
                    : `Page ${currentNarratingPageNumber}`
                  : 'Reading...'}
              </span>
            </div>
          )}

          {/* Loading synthesis indicator */}
          {isAudioLoading && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 border border-amber-400/40 rounded-xl text-amber-300 text-xs font-bold animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>Fish Speech Synthesizing...</span>
            </div>
          )}
        </div>

        {/* Fish Speech Voices Only (https://github.com/fishaudio/fish-speech) */}
        <div className="flex items-center gap-2">
          <span className="text-stone-400 font-bold text-[11px] hidden sm:inline flex items-center gap-1">
            <span>🐟</span>
            <span>Fish Speech:</span>
          </span>
          
          <select
            value={selectedVoice}
            onChange={(e) => {
              const vKey = e.target.value as VoicePersona;
              setSelectedVoice(vKey);
              if (isSpeaking && currentNarratingPageNumber !== null) {
                if (leftPage && leftPage.pageNumber === currentNarratingPageNumber) {
                  handleNarratePage(leftPage);
                } else if (rightPage && rightPage.pageNumber === currentNarratingPageNumber) {
                  handleNarratePage(rightPage);
                }
              }
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-black bg-stone-800 border border-stone-700 text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
          >
            <option value="fish-storyteller">🐟 Fish Speech - Storyteller</option>
            <option value="fish-sparky">⚡ Fish Speech - Sparky</option>
            <option value="fish-bedtime">🌙 Fish Speech - Bedtime</option>
            <option value="fish-adventure">⚔️ Fish Speech - Adventure</option>
          </select>
        </div>

        {/* Speed Controls & Auto Turn */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-stone-800 p-0.5 rounded-xl border border-stone-700">
            {[0.8, 1.0, 1.2].map((spd) => (
              <button
                key={spd}
                onClick={() => setSpeechSpeed(spd)}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold transition-all ${
                  speechSpeed === spd
                    ? 'bg-amber-500 text-stone-950 font-black'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer text-stone-400 hover:text-stone-200">
            <input
              type="checkbox"
              checked={autoTurnPages}
              onChange={(e) => setAutoTurnPages(e.target.checked)}
              className="accent-amber-500 rounded"
            />
            <span className="text-[11px] hidden sm:inline">Auto-Turn</span>
          </label>
        </div>

      </div>

      {/* Main Reading Arena */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full">
        
        {viewMode === 'real' ? (
          /* ============================================================ */
          /* REAL BOOK: Cover View (Spread 0) or Double Page Spread (1+)  */
          /* ============================================================ */
          <div className="w-full flex flex-col items-center">
            
            {/* SPREAD 0: SINGLE BOOK COVER (Closed Book) */}
            {currentSpread === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 animate-fadeIn">
                <div 
                  onClick={() => setCurrentSpread(1)}
                  className="group relative aspect-[3/4] w-72 sm:w-80 md:w-96 rounded-2xl overflow-hidden shadow-2xl border-4 border-amber-900/60 bg-stone-900 cursor-pointer transform hover:scale-[1.02] transition-all duration-300"
                  title="Click to Open Book"
                >
                  <img
                    src={coverSrc}
                    alt={book.title}
                    referrerPolicy="no-referrer"
                    draggable={false}
                    className="w-full h-full object-cover pointer-events-none"
                  />

                  {/* 3D Spine Crease on Left */}
                  <div className="absolute inset-y-0 left-0 w-5 bg-gradient-to-r from-black/60 via-black/25 to-transparent pointer-events-none" />
                  
                  {/* Subtle Book Cover Gloss */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-black/10 via-transparent to-white/10 pointer-events-none" />

                  {/* Open Book Hover Overlay */}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="px-5 py-2.5 rounded-2xl bg-amber-500 text-stone-950 font-black text-sm shadow-xl flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      <span>Open Book →</span>
                    </span>
                  </div>
                </div>

                {/* Cover Details & Open Button */}
                <div className="mt-6 text-center max-w-md">
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-black bg-orange-500 text-white font-['Fredoka'] mb-2">
                    {book.genre}
                  </span>
                  <p className="text-xs text-stone-400 italic px-4 line-clamp-2">
                    "{book.blurb}"
                  </p>

                  <button
                    onClick={() => setCurrentSpread(1)}
                    className="mt-4 px-8 py-3 rounded-2xl font-black text-base bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-stone-950 shadow-xl shadow-orange-500/20 transform active:scale-95 transition-all flex items-center gap-2 mx-auto"
                  >
                    <span>Open Book (Turn to Page 1)</span>
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <p className="text-[11px] text-stone-500 mt-2">
                    Press Space or Right Arrow to turn pages
                  </p>
                </div>
              </div>
            ) : (
              /* SPREAD 1+: DOUBLE PAGE SPREAD (Open Book: Left Page + Right Page) */
              <div className="w-full flex flex-col items-center animate-fadeIn">
                
                {/* Physical Open Book Container */}
                <div className="w-full max-w-5xl bg-[#141210] rounded-3xl p-3 sm:p-5 shadow-2xl border-4 border-amber-950/60 relative">
                  
                  {/* Two-Page Spread Layout with Center Crease Shadow */}
                  <div className="grid grid-cols-1 md:grid-cols-2 rounded-2xl overflow-hidden shadow-inner border border-amber-200/40 relative min-h-[560px] sm:min-h-[620px] bg-[#fbf8f1]">
                    
                    {/* Center Spine Crease & Shadow Gutter (Creates authentic 3D open book depth) */}
                    <div className="hidden md:block absolute inset-y-0 left-1/2 -translate-x-1/2 w-8 bg-gradient-to-r from-stone-400/20 via-stone-800/15 to-stone-400/20 pointer-events-none z-10 border-x border-stone-300/30" />

                    {/* ================= LEFT PAGE ================= */}
                    <div className={`p-6 sm:p-10 flex flex-col justify-between text-stone-900 relative transition-all ${
                      currentNarratingPageNumber === leftPage?.pageNumber
                        ? 'bg-[#fffdf8] ring-2 ring-amber-400/80 shadow-md'
                        : 'bg-[#fdfbf7]'
                    }`}>
                      <div>
                        {/* Page Top Narration Bar */}
                        <div className="flex items-center justify-between pb-3 mb-3 border-b border-stone-200/60">
                          <span className="text-[11px] font-bold text-stone-400">
                            Page {leftPage?.pageNumber}
                          </span>
                          <button
                            onClick={() => leftPage && handleNarratePage(leftPage)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black transition-all ${
                              currentNarratingPageNumber === leftPage?.pageNumber && isSpeaking
                                ? 'bg-amber-500 text-stone-950 shadow-sm animate-pulse'
                                : currentNarratingPageNumber === leftPage?.pageNumber && isPaused
                                ? 'bg-amber-200 text-amber-900 border border-amber-300'
                                : 'bg-stone-200/70 hover:bg-amber-100 text-stone-700 border border-stone-300/50'
                            }`}
                            title="Toggle audio narration for this page"
                          >
                            {currentNarratingPageNumber === leftPage?.pageNumber && isSpeaking ? (
                              <>
                                <Volume2 className="w-3 h-3 text-stone-950" />
                                <span>Narrating...</span>
                              </>
                            ) : currentNarratingPageNumber === leftPage?.pageNumber && isPaused ? (
                              <>
                                <Pause className="w-3 h-3 text-amber-900" />
                                <span>Paused</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3 h-3 text-stone-600" />
                                <span>Read Page</span>
                              </>
                            )}
                          </button>
                        </div>

                        {leftPage?.isChapterOpening && (
                          <div className="border-b-2 border-dashed border-amber-300 pb-2 mb-4">
                            <span className="text-xs font-black uppercase tracking-widest text-orange-600 font-['Fredoka']">
                              Chapter {leftPage.chapterNumber}
                            </span>
                            <h2
                              className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight mt-1"
                              style={{ fontFamily: `"${bookFont}", cursive, sans-serif` }}
                            >
                              {leftPage.chapterTitle}
                            </h2>
                          </div>
                        )}

                        {/* Story Scene Illustration on Left Page */}
                        {leftPage?.imageUrl && (
                          <div className="mb-4 rounded-2xl overflow-hidden border-2 border-amber-300 shadow-md max-w-md mx-auto bg-amber-50/50 p-1 flex items-center justify-center">
                            <img
                              src={leftPage.imageUrl}
                              alt={leftPage.chapterTitle || 'Story Scene'}
                              className="w-full h-auto max-h-60 sm:max-h-72 object-contain rounded-xl"
                              loading="lazy"
                            />
                          </div>
                        )}

                        {/* Story Content styled with the book's locked font */}
                        <div
                          className="prose prose-stone max-w-none text-stone-800 leading-relaxed text-sm sm:text-base whitespace-pre-line space-y-3 font-normal"
                          style={{ fontFamily: `"${bookFont}", cursive, sans-serif` }}
                        >
                          {leftPage?.content}
                        </div>
                      </div>

                      {/* Left Page Number in bottom-left */}
                      <div className="pt-4 border-t border-stone-200/60 flex items-center justify-between text-xs text-stone-400 font-mono mt-6">
                        <span>Page {leftPage?.pageNumber}</span>
                        <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                          {book.title}
                        </span>
                      </div>
                    </div>

                    {/* ================= RIGHT PAGE ================= */}
                    <div className={`p-6 sm:p-10 flex flex-col justify-between text-stone-900 border-t md:border-t-0 md:border-l border-stone-200/50 relative transition-all ${
                      currentNarratingPageNumber === rightPage?.pageNumber
                        ? 'bg-[#fffdf8] ring-2 ring-amber-400/80 shadow-md'
                        : 'bg-[#faf6ee]'
                    }`}>
                      {rightPage ? (
                        <>
                          <div>
                            {/* Page Top Narration Bar */}
                            <div className="flex items-center justify-between pb-3 mb-3 border-b border-stone-200/60">
                              <span className="text-[11px] font-bold text-stone-400">
                                Page {rightPage.pageNumber}
                              </span>
                              <button
                                onClick={() => handleNarratePage(rightPage)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black transition-all ${
                                  currentNarratingPageNumber === rightPage.pageNumber && isSpeaking
                                    ? 'bg-amber-500 text-stone-950 shadow-sm animate-pulse'
                                    : currentNarratingPageNumber === rightPage.pageNumber && isPaused
                                    ? 'bg-amber-200 text-amber-900 border border-amber-300'
                                    : 'bg-stone-200/70 hover:bg-amber-100 text-stone-700 border border-stone-300/50'
                                }`}
                                title="Toggle audio narration for this page"
                              >
                                {currentNarratingPageNumber === rightPage.pageNumber && isSpeaking ? (
                                  <>
                                    <Volume2 className="w-3 h-3 text-stone-950" />
                                    <span>Narrating...</span>
                                  </>
                                ) : currentNarratingPageNumber === rightPage.pageNumber && isPaused ? (
                                  <>
                                    <Pause className="w-3 h-3 text-amber-900" />
                                    <span>Paused</span>
                                  </>
                                ) : (
                                  <>
                                    <Volume2 className="w-3 h-3 text-stone-600" />
                                    <span>Read Page</span>
                                  </>
                                )}
                              </button>
                            </div>

                            {rightPage.isChapterOpening && (
                              <div className="border-b-2 border-dashed border-amber-300 pb-2 mb-4">
                                <span className="text-xs font-black uppercase tracking-widest text-orange-600 font-['Fredoka']">
                                  Chapter {rightPage.chapterNumber}
                                </span>
                                <h2
                                  className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight mt-1"
                                  style={{ fontFamily: `"${bookFont}", cursive, sans-serif` }}
                                >
                                  {rightPage.chapterTitle}
                                </h2>
                              </div>
                            )}

                            {rightPage.imageUrl && (
                              <div className="mb-4 rounded-2xl overflow-hidden border-2 border-amber-300 shadow-md max-w-md mx-auto bg-amber-50/50 p-1 flex items-center justify-center">
                                <img
                                  src={rightPage.imageUrl}
                                  alt={rightPage.chapterTitle || 'Story Scene'}
                                  className="w-full h-auto max-h-60 sm:max-h-72 object-contain rounded-xl"
                                  loading="lazy"
                                />
                              </div>
                            )}

                            {/* Story Prose */}
                            <div
                              className="prose prose-stone max-w-none text-stone-800 leading-relaxed text-sm sm:text-base whitespace-pre-line space-y-3 font-normal"
                              style={{ fontFamily: `"${bookFont}", cursive, sans-serif` }}
                            >
                              {rightPage.content}
                            </div>
                          </div>

                          {/* Right Page Number in bottom-right */}
                          <div className="pt-4 border-t border-stone-200/60 flex items-center justify-between text-xs text-stone-400 font-mono mt-6">
                            <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                              Chapter {rightPage.chapterNumber}
                            </span>
                            <span>Page {rightPage.pageNumber}</span>
                          </div>
                        </>
                      ) : (
                        /* Final Page / The End Spread */
                        <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-gradient-to-b from-amber-50/40 to-amber-100/50 rounded-xl">
                          <span className="text-4xl mb-3">🌟</span>
                          <h3
                            className="text-2xl font-black text-amber-950 mb-2"
                            style={{ fontFamily: `"${bookFont}", cursive, sans-serif` }}
                          >
                            The End!
                          </h3>
                          <p className="text-xs text-amber-900/80 max-w-xs mb-4">
                            You've finished reading <strong>{book.title}</strong>!
                          </p>
                          {book.moral && (
                            <div className="p-4 rounded-2xl bg-amber-200/70 border border-amber-300 text-amber-950 text-xs font-bold max-w-xs">
                              🌟 <strong>Lesson:</strong> {book.moral}
                            </div>
                          )}
                          <div className="mt-8 text-stone-400 text-xs font-mono">
                            Page {bookPages.length + 1} • Book Complete
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                </div>

                {/* Bottom Pagination Controls */}
                <div className="w-full max-w-5xl mt-6 flex items-center justify-between px-2">
                  <button
                    onClick={() => setCurrentSpread((s) => Math.max(0, s - 1))}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-black bg-stone-800 hover:bg-stone-700 text-amber-300 border border-stone-700 shadow-md transition-all active:scale-95"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>{currentSpread === 1 ? 'Close to Cover' : '← Turn Page Back'}</span>
                  </button>

                  <div className="flex flex-col items-center">
                    <span className="text-xs font-bold text-stone-300">
                      Pages {(currentSpread - 1) * 2 + 1} - {Math.min(bookPages.length, (currentSpread - 1) * 2 + 2)} of {bookPages.length}
                    </span>
                    <span className="text-[10px] text-stone-500 font-mono">
                      Spread {currentSpread} of {totalSpreads}
                    </span>
                  </div>

                  <button
                    disabled={currentSpread >= totalSpreads}
                    onClick={() => setCurrentSpread((s) => Math.min(totalSpreads, s + 1))}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-black bg-orange-500 hover:bg-orange-600 text-white shadow-md disabled:opacity-40 disabled:pointer-events-none transition-all active:scale-95"
                  >
                    <span>Turn Page Next →</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

              </div>
            )}

          </div>
        ) : (
          /* ============================================================ */
          /* ONLY WORD VERSION: Clean manuscript & raw prose reader       */
          /* ============================================================ */
          <div className="w-full max-w-3xl bg-stone-950/70 border border-stone-800 rounded-3xl p-6 sm:p-10 shadow-2xl">
            
            {/* Top Bar for Word Only Mode */}
            <div className="flex items-center justify-between border-b border-stone-800 pb-4 mb-6">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                  Manuscript Raw Text View
                </span>
                <h2
                  className="text-xl sm:text-2xl font-black text-stone-100"
                  style={{ fontFamily: `"${bookFont}", sans-serif` }}
                >
                  {book.title}
                </h2>
              </div>

              {/* Font Size controls */}
              <div className="flex items-center gap-1 bg-stone-900 p-1 rounded-xl border border-stone-800 text-xs">
                {(['sm', 'base', 'lg', 'xl'] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => setFontSize(size)}
                    className={`px-2.5 py-1 rounded-lg font-bold uppercase transition-all ${
                      fontSize === size
                        ? 'bg-amber-500 text-stone-950 font-black'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Chapters Navigation Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar">
              {book.chapters.map((ch, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentChapterIndex(idx)}
                  className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    currentChapterIndex === idx
                      ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm'
                      : 'bg-stone-900 hover:bg-stone-800 text-stone-400 border border-stone-800'
                  }`}
                >
                  Chapter {ch.chapterNumber}
                </button>
              ))}
            </div>

            {/* Raw Prose Text Container with Locked Font */}
            <div
              className={`text-stone-200 leading-relaxed whitespace-pre-line space-y-6 ${
                fontSize === 'sm' ? 'text-sm' :
                fontSize === 'base' ? 'text-base' :
                fontSize === 'lg' ? 'text-lg' : 'text-xl'
              }`}
              style={{ fontFamily: `"${bookFont}", cursive, sans-serif` }}
            >
              <div className="border-b border-stone-800 pb-3 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-amber-300">
                    Chapter {book.chapters[currentChapterIndex]?.chapterNumber}: {book.chapters[currentChapterIndex]?.title}
                  </h3>
                  <p className="text-xs text-stone-500 font-mono mt-1">
                    Word Count: {book.chapters[currentChapterIndex]?.wordCount || book.chapters[currentChapterIndex]?.content.split(/\s+/).length} words
                  </p>
                </div>
                {book.chapters[currentChapterIndex] && (
                  <button
                    onClick={() => handleNarrateChapter(book.chapters[currentChapterIndex])}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md self-start sm:self-auto ${
                      isSpeaking && currentNarratingPageNumber === -book.chapters[currentChapterIndex].chapterNumber
                        ? 'bg-amber-400 text-stone-950 font-black ring-2 ring-amber-300 animate-pulse'
                        : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700'
                    }`}
                  >
                    <Volume2 className="w-4 h-4 text-amber-400" />
                    <span>
                      {isSpeaking && currentNarratingPageNumber === -book.chapters[currentChapterIndex].chapterNumber
                        ? 'Reading Chapter...'
                        : 'Read Chapter'}
                    </span>
                  </button>
                )}
              </div>

              {book.chapters[currentChapterIndex]?.imageUrl && (
                <div className="mb-6 rounded-2xl overflow-hidden border border-stone-700 shadow-lg max-w-md mx-auto">
                  <img
                    src={book.chapters[currentChapterIndex]?.imageUrl}
                    alt={book.chapters[currentChapterIndex]?.title}
                    className="w-full h-auto max-h-72 object-cover"
                    loading="lazy"
                  />
                </div>
              )}

              <div className="leading-loose">
                {book.chapters[currentChapterIndex]?.content}
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="mt-12 pt-6 border-t border-stone-800 flex items-center justify-between">
              <button
                disabled={currentChapterIndex === 0}
                onClick={() => setCurrentChapterIndex((prev) => Math.max(0, prev - 1))}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous Chapter
              </button>

              <span className="text-xs text-stone-500 font-mono">
                {currentChapterIndex + 1} of {book.chapters.length} Chapters
              </span>

              <button
                disabled={currentChapterIndex >= book.chapters.length - 1}
                onClick={() => setCurrentChapterIndex((prev) => Math.min(book.chapters.length - 1, prev + 1))}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 disabled:opacity-30 disabled:pointer-events-none"
              >
                Next Chapter
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        )}

      </main>

      {/* Admin-only Font Picker Modal */}
      {isAdmin && (
        <FontPickerModal
          isOpen={fontModalOpen}
          onClose={() => setFontModalOpen(false)}
          currentFont={bookFont}
          onSelectFont={async (f) => {
            setBookFont(f);
            loadGoogleFont(f);
            try {
              const updated = {
                ...book,
                fontFamily: f,
                coverTheme: {
                  ...book.coverTheme,
                  fontFamily: f,
                },
              };
              const res = await fetch(`/api/books/${book.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated),
              });
              if (res.ok) {
                const saved = await res.json();
                onUpdateBook?.(saved);
              }
            } catch (err) {
              console.warn('Failed to persist book font update:', err);
            }
          }}
        />
      )}
    </div>
  );
};
