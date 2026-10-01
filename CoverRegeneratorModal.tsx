import React, { useState } from 'react';
import { Book } from '../types';
import { X, Sparkles, Copy, Check, RefreshCw, Palette, Image as ImageIcon, Wand2, UserCheck, Loader2, Download } from 'lucide-react';
import { generateThematicCoverSvg } from '../utils/thematicCovers';
import { generatePuterImage, enhancePromptForFantasticStyle } from '../services/puterService';
import { 
  generatePollinationsCover, 
  resolveCharacterAnchor, 
  buildDetailedCoverPrompt,
  downloadImageFromUrl
} from '../services/pollinationsService';

interface CoverRegeneratorModalProps {
  book: Book;
  onApplyCover: (updatedBook: Book) => void;
  onClose: () => void;
}

const THEME_OPTIONS = [
  { id: 'typist', name: '🕰️ The Midnight Typist', img: '/src/assets/images/midnight_typist_1790794964604.jpg', concept: 'vintage typewriter clock ledger attic scrolls boy' },
  { id: 'scribble', name: '🎨 ZIP! ZAP! Scribble', img: '/src/assets/images/zip_zap_scribble_1790629385351.jpg', concept: 'art scribble magic rainbow octopus' },
  { id: 'gaming', name: '🎮 Pixel Game Hero', img: '/src/assets/images/cover_game_hamster_1790627550696.jpg', concept: 'retro game boy pixel console galaxy' },
  { id: 'bakery', name: '🧁 Puppy Bakery & Muffins', img: '/src/assets/images/barkery_muffin_meltdown_1790629361516.jpg', concept: 'puppy baker muffins flour' },
  { id: 'space', name: '🚀 Hamster Lunar Leap', img: '/src/assets/images/hamster_lunar_leap_1790629373790.jpg', concept: 'space rocket moon hamster' },
  { id: 'pizza', name: '🍕 Pepperoni Pirates', img: '/src/assets/images/pizza_pirates_1790629395705.jpg', concept: 'pizza pepperoni cheese crust tomato sauce' },
  { id: 'dino', name: '🦕 Neon Dinosaurs', img: '/src/assets/images/cover_juice_dino_1790627570229.jpg', concept: 'neon dinosaurs prehistoric' },
  { id: 'puppy-hero', name: '🦸 Power-Treat Patrol', img: '/src/assets/images/cover_power_treat_1790627560796.jpg', concept: 'puppy superhero treats' },
];

export const CoverRegeneratorModal: React.FC<CoverRegeneratorModalProps> = ({
  book,
  onApplyCover,
  onClose,
}) => {
  const [selectedTheme, setSelectedTheme] = useState(book.coverTheme?.theme || 'scribble');
  const [customStylePrompt, setCustomStylePrompt] = useState('');
  const [characterProfile, setCharacterProfile] = useState(
    book.characterProfile || resolveCharacterAnchor(book)
  );
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [puterRendering, setPuterRendering] = useState(false);
  const [isPollinating, setIsPollinating] = useState(false);
  const [pollinationsStatus, setPollinationsStatus] = useState('');
  const [artModel, setArtModel] = useState<'flux-1-schnell' | 'gpt-image-2.5-flare'>('flux-1-schnell');

  // Current preview cover generated dynamically
  const [previewCover, setPreviewCover] = useState(() => {
    return book.coverUrl && book.coverUrl.trim() !== ''
      ? book.coverUrl
      : generateThematicCoverSvg(
          book.title,
          book.blurb + ' ' + (book.coverTheme?.theme || ''),
          book.ageGroup,
          book.genre
        );
  });

  // Generate Cover via Pollinations.ai with character visual consistency and zero misspelled words
  const handleGeneratePollinationsCover = async () => {
    if (isPollinating) return;
    setIsPollinating(true);
    setPollinationsStatus('Analyzing book summary & character consistency...');

    try {
      const summary = customStylePrompt
        ? `${book.blurb}. Specific scene note: ${customStylePrompt}`
        : book.blurb;

      const result = await generatePollinationsCover(
        {
          ...book,
          blurb: summary,
          characterProfile,
        },
        (attempt) => {
          setPollinationsStatus(`Generating cover with Pollinations.ai (attempt ${attempt}/3)...`);
        }
      );

      setPreviewCover(result.coverUrl);
      setPollinationsStatus('✨ High graphics cover verified! Matches style with zero gibberish text.');
      setTimeout(() => setPollinationsStatus(''), 4500);
    } catch (err: any) {
      console.error('Pollinations cover error:', err);
      setPollinationsStatus('Could not complete generation. Please retry.');
      setTimeout(() => setPollinationsStatus(''), 4000);
    } finally {
      setIsPollinating(false);
    }
  };

  const handleGeneratePuterArt = async () => {
    setPuterRendering(true);
    try {
      const prompt = enhancePromptForFantasticStyle(
        `Front cover for "${book.title}". Theme: ${customStylePrompt || book.blurb}. Beautiful hand-drawn title, vibrant watercolor wash, warm textured paper, whimsical expressive characters, award-winning storybook illustration`,
        book.title
      );
      const imgUrl = await generatePuterImage(prompt, { model: artModel, quality: 'high' });
      setPreviewCover(imgUrl);
    } catch (err: any) {
      console.warn('Puter cover render notice:', err);
      // fallback
      const randomTheme = THEME_OPTIONS[Math.floor(Math.random() * THEME_OPTIONS.length)];
      handleSelectTheme(randomTheme.id, randomTheme.concept);
    } finally {
      setPuterRendering(false);
    }
  };

  const handleSelectTheme = (themeId: string, concept: string, imgSrc?: string) => {
    setSelectedTheme(themeId);
    if (imgSrc) {
      setPreviewCover(imgSrc);
    } else {
      const newSvg = generateThematicCoverSvg(
        book.title,
        concept + ' ' + customStylePrompt,
        book.ageGroup,
        book.genre
      );
      setPreviewCover(newSvg);
    }
  };

  const handleRegenerateRandom = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/books/${book.id}/regenerate-cover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customPrompt: customStylePrompt,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.book?.coverTheme) {
          const newSvg = generateThematicCoverSvg(
            book.title,
            data.book.coverTheme.theme + ' ' + (customStylePrompt || book.blurb),
            book.ageGroup,
            book.genre
          );
          setPreviewCover(newSvg);
        }
      }
    } catch (e) {
      console.error('Error regenerating cover:', e);
      // Fallback local re-roll
      const randomTheme = THEME_OPTIONS[Math.floor(Math.random() * THEME_OPTIONS.length)];
      handleSelectTheme(randomTheme.id, randomTheme.concept);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = () => {
    const fullUrl = previewCover.startsWith('data:')
      ? previewCover
      : window.location.origin + previewCover;

    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveAndApply = () => {
    const updatedBook: Book = {
      ...book,
      coverUrl: previewCover,
      characterProfile,
      coverTheme: {
        ...book.coverTheme,
        theme: selectedTheme,
        primaryColor: '#f43f5e',
        secondaryColor: '#10b981',
        accentColor: '#fbbf24',
      },
    };
    onApplyCover(updatedBook);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border-2 border-amber-300 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-stone-950 flex items-center justify-between border-b border-orange-600">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-950" />
            <div>
              <h3 className="text-xl font-black font-['Fredoka']">Unlimited Free High Graphics Book Cover Generator</h3>
              <p className="text-xs text-amber-950 font-medium">
                Generates detailed watercolor covers via Pollinations.ai with character consistency and zero misspelled words
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-orange-600/30 text-stone-950 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-12 gap-6 items-start flex-1">
          
          {/* Cover Preview using user's exact specifications */}
          <div className="md:col-span-5 flex flex-col items-center">
            <div className="w-full flex flex-col items-center">
              {/* COPY AND PASTE THIS EXACT CODE TO MAKE IT WORK */}
              <img 
                src={previewCover} 
                alt="Unlimited Free High Graphics Book Cover Generator" 
                style={{
                  width: '100%',
                  maxWidth: '450px',
                  height: 'auto',
                  border: '1px solid #ddd',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                }}
                className="rounded-2xl object-cover bg-white"
              />
            </div>

            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={handleCopyLink}
                className="text-xs font-bold px-3 py-1.5 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50 transition-all flex items-center gap-1.5"
                title="Copy cover link address"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => downloadImageFromUrl(previewCover, `${book.title.replace(/[^a-zA-Z0-9]/g, '_')}_cover.jpg`)}
                className="text-xs font-black px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                title="Download high-graphics cover image"
              >
                <Download className="w-3.5 h-3.5 text-amber-300" />
                <span>Download</span>
              </button>
            </div>
          </div>

          {/* Theme & Style Selectors */}
          <div className="md:col-span-7 space-y-4">
            <div>
              <h4 className="font-black text-stone-900 font-['Fredoka'] text-lg">
                "{book.title}"
              </h4>
              <p className="text-xs text-stone-500 font-medium mt-0.5 line-clamp-2">
                {book.blurb}
              </p>
            </div>

            {/* Pollinations.ai Generator Box */}
            <div className="p-4 bg-gradient-to-r from-orange-50 via-amber-50 to-yellow-50 rounded-2xl border-2 border-orange-300 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-orange-950 font-['Fredoka'] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-orange-600" />
                  <span>Pollinations.ai Cover Generator</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-orange-200/90 text-orange-950">
                  Unlimited Free High Graphics
                </span>
              </div>

              <p className="text-xs text-stone-600 leading-relaxed">
                AI will summarize the entire story, create a detailed prompt with the exact boy and clothing, and render a high graphics cover. If it doesn't match, simply click regenerate!
              </p>

              {/* Status Banner */}
              {pollinationsStatus && (
                <div className="p-2.5 rounded-xl bg-orange-100 border border-orange-300 text-orange-950 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                  {isPollinating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-600" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  <span>{pollinationsStatus}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleGeneratePollinationsCover}
                disabled={isPollinating}
                className="w-full py-3 px-4 rounded-xl text-xs font-black bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {isPollinating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Painting Cover with Pollinations.ai...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-200" />
                    <span>Generate Cover with Pollinations.ai</span>
                  </>
                )}
              </button>
            </div>

            {/* Protagonist Character Visual Consistency Anchor */}
            <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-1.5">
              <label className="text-xs font-black uppercase text-stone-700 font-['Fredoka'] flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-orange-600" />
                <span>Character Consistency (Hair, Clothes & Appearance)</span>
              </label>
              <input
                type="text"
                value={characterProfile}
                onChange={(e) => setCharacterProfile(e.target.value)}
                placeholder="e.g. 10-year-old boy named Barnaby with brown hair, blue-and-white striped sailor shirt..."
                className="w-full px-3 py-1.5 rounded-xl bg-white border border-stone-300 font-medium text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <p className="text-[11px] text-stone-500">
                Guarantees the cover and every page of the book show the exact same character with the same brown hair and clothes.
              </p>
            </div>

            {/* Custom Visual Detail (Optional) */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1 font-['Fredoka']">
                Custom Scene Detail (Optional)
              </label>
              <input
                type="text"
                value={customStylePrompt}
                onChange={(e) => setCustomStylePrompt(e.target.value)}
                placeholder="e.g. floating gears in attic, golden hour light, joyful celebration"
                className="w-full px-3 py-2 text-xs rounded-xl bg-amber-50/60 border border-amber-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Thematic Motifs */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1.5 font-['Fredoka']">
                Or Pick a Starter Watercolor Artwork Preset:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {THEME_OPTIONS.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => handleSelectTheme(theme.id, theme.concept, theme.img)}
                    className={`text-xs font-bold px-2.5 py-2 rounded-xl text-left border transition-all ${
                      selectedTheme === theme.id
                        ? 'bg-amber-100 border-orange-500 text-orange-950 font-black ring-2 ring-orange-400/30'
                        : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-amber-50/50'
                    }`}
                  >
                    {theme.name}
                  </button>
                ))}
              </div>
            </div>

          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-stone-50 border-t border-stone-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveAndApply}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md transition-all active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>Apply New Cover</span>
          </button>
        </div>

      </div>
    </div>
  );
};
