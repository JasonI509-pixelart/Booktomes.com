import React, { useState } from 'react';
import { Book } from '../types';
import { 
  X, Sparkles, Download, Copy, Check, Loader2, RefreshCw, 
  BookOpen, Wand2, Type, ImageIcon, Layers, HelpCircle
} from 'lucide-react';
import { 
  buildWhimsicalStorybookPrompt, 
  generateUnifiedImage, 
  downloadImageFromUrl 
} from '../services/pollinationsService';

interface AdminCoverStudioModalProps {
  books: Book[];
  onApplyCoverToBook?: (bookId: string, coverUrl: string) => void;
  onClose: () => void;
}

export const AdminCoverStudioModal: React.FC<AdminCoverStudioModalProps> = ({
  books,
  onApplyCoverToBook,
  onClose,
}) => {
  // Mode: 'cover' (with title option) or 'image' (interior illustration without title)
  const [imageType, setImageType] = useState<'cover' | 'image'>('cover');

  // Title controls (only for cover!)
  const [showTitleInput, setShowTitleInput] = useState<boolean>(true);
  const [coverTitle, setCoverTitle] = useState<string>("The Flying Propeller Pup");

  // Scene prompt
  const [conceptPrompt, setConceptPrompt] = useState<string>(
    "a fluffy golden puppy wearing a tiny propeller hat flying over a busy pet shop with streams of colorful magic flowing around him"
  );

  const [selectedBookId, setSelectedBookId] = useState<string>(books[0]?.id || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [generationSource, setGenerationSource] = useState<string>('gemini-3.1-flash-image');
  
  // Initial generated cover preview
  const [currentImageUrl, setCurrentImageUrl] = useState<string>(() => {
    const seed = 8847291;
    const initialPrompt = buildWhimsicalStorybookPrompt({
      prompt: "a fluffy golden puppy wearing a tiny propeller hat flying over a busy pet shop with streams of colorful magic flowing around him",
      title: "The Flying Propeller Pup",
      isCover: true,
    });
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(initialPrompt)}?width=768&height=1024&model=flux&enhance=true&seed=${seed}&nologo=true`;
  });

  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const isCover = imageType === 'cover';

  // Live computed prompt preview
  const computedPrompt = buildWhimsicalStorybookPrompt({
    prompt: conceptPrompt,
    title: (isCover && showTitleInput) ? coverTitle : undefined,
    isCover,
  });

  const handleGenerate = async () => {
    if (!conceptPrompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setStatusMessage(`Requesting image from Google GenAI (gemini-3.1-flash-image)...`);
    setApplied(false);

    try {
      const result = await generateUnifiedImage({
        prompt: conceptPrompt,
        title: (isCover && showTitleInput) ? coverTitle : undefined,
        isCover,
        aspectRatio: isCover ? '3:4' : '4:3',
      });

      setCurrentImageUrl(result.imageUrl);
      setGenerationSource(result.source);
      setStatusMessage(
        result.source === 'gemini-3.1-flash-image'
          ? '✨ Generated directly via Google GenAI (gemini-3.1-flash-image)!'
          : '✨ Generated high-graphics watercolor image via Flux storybook engine!'
      );
      setTimeout(() => setStatusMessage(''), 4500);
    } catch (err: any) {
      console.error('Image generation error:', err);
      setStatusMessage('Encountered an issue generating image. Please try again.');
      setTimeout(() => setStatusMessage(''), 4000);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!currentImageUrl || isDownloading) return;
    setIsDownloading(true);
    const cleanName = (isCover ? (coverTitle || conceptPrompt) : conceptPrompt)
      .slice(0, 30)
      .replace(/[^a-zA-Z0-9]/g, '_') || 'childrens_storybook_art';
    await downloadImageFromUrl(currentImageUrl, `${cleanName}_${isCover ? 'cover' : 'scene'}.png`);
    setIsDownloading(false);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentImageUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyToSelectedBook = () => {
    if (!selectedBookId || !onApplyCoverToBook) return;
    onApplyCoverToBook(selectedBookId, currentImageUrl);
    setApplied(true);
    setTimeout(() => setApplied(false), 3000);
  };

  const presetSamples = [
    {
      label: "Flying Puppy",
      title: "The Flying Propeller Pup",
      prompt: "a fluffy golden puppy wearing a tiny propeller hat flying over a busy pet shop with streams of colorful magic flowing around him",
    },
    {
      label: "Barnaby's Clocktower",
      title: "Barnaby & The Clocktower",
      prompt: "a brave boy named Barnaby with brown hair and his golden puppy exploring a magical glowing clocktower with floating brass gears",
    },
    {
      label: "Oak Tree Bakery",
      title: "The Oak Tree Bakery",
      prompt: "a cozy mouse baker in a strawberry apron serving warm cinnamon buns inside a hollow oak tree bakery with golden glowing lamps",
    },
    {
      label: "Toothpaste Dragon",
      title: "Sir Chewy & The Dragon",
      prompt: "a gentle green dragon blowing shiny minty bubbles and colorful sparkling foam over a castle garden of sugar candy flowers",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#fdfbf7] rounded-3xl max-w-5xl w-full max-h-[94vh] flex flex-col shadow-2xl border-2 border-amber-300 overflow-hidden text-stone-900">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-stone-950 flex items-center justify-between border-b border-orange-600 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-stone-950/10 backdrop-blur-sm">
              <Sparkles className="w-5 h-5 text-stone-950" />
            </div>
            <div>
              <h2 className="text-xl font-black font-['Fredoka'] tracking-tight">
                Children's Storybook Art & Cover Studio
              </h2>
              <p className="text-xs font-semibold text-amber-950">
                Official Google GenAI (gemini-3.1-flash-image) • Whimsical Watercolor Engine
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
        <div className="p-6 sm:p-8 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start flex-1 bg-[#fdfbf7]">
          
          {/* Left / Input Controls Column */}
          <div className="lg:col-span-7 space-y-5">
            
            {/* 1. Selector: Cover vs Interior Image */}
            <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black uppercase tracking-wider text-stone-700 font-['Fredoka'] flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-orange-600" />
                  <span>Image Making Purpose:</span>
                </label>
                <span className="text-[11px] font-bold text-amber-900">
                  {isCover ? "3:4 Vertical Cover Ratio" : "4:3 Story Illustration Ratio"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 p-1 bg-amber-50 rounded-xl border border-amber-200">
                <button
                  type="button"
                  onClick={() => setImageType('cover')}
                  className={`py-2 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 ${
                    isCover
                      ? 'bg-amber-500 text-stone-950 shadow-sm font-black'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Book Cover (Allows Title)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImageType('image')}
                  className={`py-2 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 ${
                    !isCover
                      ? 'bg-amber-500 text-stone-950 shadow-sm font-black'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Interior Image (NO Title)</span>
                </button>
              </div>
            </div>

            {/* 2. Cover Title Input Button / Field (ONLY if it's a cover!) */}
            {isCover ? (
              <div className="bg-amber-100/60 p-4 rounded-2xl border-2 border-amber-300 shadow-sm space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Type className="w-4 h-4 text-orange-600" />
                    <span className="text-xs font-black uppercase tracking-wider text-stone-900 font-['Fredoka']">
                      Cover Title Calligraphy:
                    </span>
                  </div>
                  
                  {/* Button to type/toggle title for the cover */}
                  <button
                    type="button"
                    onClick={() => setShowTitleInput(!showTitleInput)}
                    className={`px-3 py-1 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                      showTitleInput
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'bg-white text-stone-700 border border-amber-300 hover:bg-amber-100'
                    }`}
                  >
                    <span>{showTitleInput ? '✓ Title Active on Cover' : '+ Type Title for Cover'}</span>
                  </button>
                </div>

                {showTitleInput ? (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={coverTitle}
                      onChange={(e) => setCoverTitle(e.target.value)}
                      placeholder="Type the title to hand-letter onto the cover..."
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-white border border-amber-300 font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-inner"
                    />
                    <p className="text-[11px] text-stone-600">
                      The title will be hand-lettered at the top of the cover in vintage storybook calligraphy.
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-stone-500 italic">
                    Title is currently omitted. Click "Type Title for Cover" above to include one.
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-stone-100 p-3 rounded-2xl border border-stone-200 text-stone-500 text-xs flex items-center gap-2 animate-fadeIn">
                <HelpCircle className="w-4 h-4 text-stone-400 flex-shrink-0" />
                <span>
                  <strong>Title button disabled:</strong> You are creating an interior page image, not a cover. Pure artwork with strictly NO text or lettering is enforced.
                </span>
              </div>
            )}

            {/* 3. Prompt Input */}
            <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black uppercase tracking-wider text-stone-700 font-['Fredoka']">
                  Scene Description / Story Prompt:
                </label>
                <span className="text-[11px] text-stone-400">
                  AI will auto-inject watercolor & pen textures
                </span>
              </div>
              <textarea
                rows={3}
                value={conceptPrompt}
                onChange={(e) => setConceptPrompt(e.target.value)}
                placeholder="e.g. a fluffy golden puppy wearing a tiny propeller hat flying over a busy pet shop with streams of colorful magic flowing around him..."
                className="w-full p-3.5 text-xs sm:text-sm rounded-xl bg-amber-50/40 border border-amber-300 font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 leading-relaxed shadow-inner"
              />

              {/* Sample idea chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] font-bold text-stone-400 uppercase mr-1">Quick Ideas:</span>
                {presetSamples.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setConceptPrompt(sample.prompt);
                      if (isCover) setCoverTitle(sample.title);
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-stone-700 border border-amber-200 transition-colors"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Live AI Prompt Construction Inspector */}
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-300/80 space-y-2">
              <div className="flex items-center gap-1.5 font-black text-amber-950 font-['Fredoka'] text-xs uppercase">
                <Wand2 className="w-3.5 h-3.5 text-orange-600" />
                <span>AI Automated Storybook Prompt Construction:</span>
              </div>
              <p className="text-[11px] font-serif italic text-stone-700 leading-relaxed bg-white p-2.5 rounded-xl border border-amber-200">
                "{computedPrompt}"
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] text-stone-600 font-mono">
                <span className="bg-amber-200/60 px-2 py-0.5 rounded font-bold text-amber-950">
                  Model: gemini-3.1-flash-image
                </span>
                <span>•</span>
                <span>Transparent watercolor wash</span>
                <span>•</span>
                <span>Cross-hatching pencil</span>
                <span>•</span>
                <span>Thin ink outlines</span>
              </div>
            </div>

            {/* 5. Execution Button */}
            <button
              type="button"
              disabled={isGenerating || !conceptPrompt.trim()}
              onClick={handleGenerate}
              className="w-full py-4 px-6 rounded-2xl text-sm font-black bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-xl shadow-orange-500/25 flex items-center justify-center gap-2.5 transform active:scale-95 transition-all disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                  <span>Synthesizing Storybook Art (Google GenAI)...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-amber-200" />
                  <span>
                    {isCover ? "Generate Children's Book Cover" : "Generate Storybook Illustration"}
                  </span>
                </>
              )}
            </button>

            {/* Status Notification */}
            {statusMessage && (
              <div className="p-3 rounded-xl bg-orange-100/90 border border-orange-300 text-orange-950 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
                ) : (
                  <Check className="w-4 h-4 text-emerald-600" />
                )}
                <span>{statusMessage}</span>
              </div>
            )}

            {/* Attach to Existing Book in Library */}
            {books.length > 0 && onApplyCoverToBook && isCover && (
              <div className="pt-3 border-t border-amber-200 space-y-2">
                <label className="block text-xs font-black uppercase tracking-wider text-stone-700 font-['Fredoka']">
                  Apply Cover to an Existing Library Book:
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedBookId}
                    onChange={(e) => setSelectedBookId(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-xl bg-white border border-amber-300 font-semibold text-stone-800"
                  >
                    {books.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleApplyToSelectedBook}
                    className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 transition-all"
                  >
                    {applied ? <Check className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
                    <span>{applied ? 'Applied!' : 'Apply Cover'}</span>
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Right / Generated Art Display Card Frame */}
          <div className="lg:col-span-5 flex flex-col items-center">
            
            {/* Display Card Frame */}
            <div className="w-full max-w-[380px] flex flex-col items-center bg-white p-3 sm:p-4 rounded-3xl border-2 border-amber-300 shadow-xl relative group">
              
              <div 
                className={`w-full ${isCover ? 'aspect-[3/4]' : 'aspect-[4/3]'} rounded-2xl overflow-hidden shadow-inner relative bg-stone-100 flex items-center justify-center border border-amber-100`}
              >
                {currentImageUrl ? (
                  <img
                    src={currentImageUrl}
                    alt="Unlimited Free High Graphics Book Cover Generator"
                    referrerPolicy="no-referrer"
                    style={{
                      width: '100%',
                      maxWidth: '450px',
                      height: 'auto',
                      border: '1px solid #ddd',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                    }}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <div className="p-6 text-center text-stone-400">
                    <Sparkles className="w-8 h-8 text-amber-300 mx-auto mb-2" />
                    <p className="text-xs font-bold">No image generated yet</p>
                  </div>
                )}

                {/* Engine Source Badge */}
                <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-stone-900/80 backdrop-blur-md text-amber-300 border border-amber-400/30 flex items-center gap-1 shadow-md">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>
                    {generationSource === 'gemini-3.1-flash-image'
                      ? 'Google GenAI Flash Image'
                      : 'Pollinations Flux (Keyless)'}
                  </span>
                </div>
              </div>

              {/* Action Buttons Below Cover */}
              <div className="w-full mt-4 space-y-2">
                
                {/* Download Action Link */}
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={isDownloading || !currentImageUrl}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-black bg-stone-900 hover:bg-stone-800 text-white shadow-md flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-50"
                >
                  {isDownloading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                  ) : (
                    <Download className="w-4 h-4 text-amber-400" />
                  )}
                  <span>Download Graphics Locally</span>
                </button>

                {/* Secondary Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="py-2 px-3 rounded-xl text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-stone-800 border border-amber-200 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-500" />}
                    <span>{copied ? 'Copied URL!' : 'Copy Link'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="py-2 px-3 rounded-xl text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-stone-800 border border-amber-200 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-orange-600 ${isGenerating ? 'animate-spin' : ''}`} />
                    <span>Regenerate</span>
                  </button>
                </div>

              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
