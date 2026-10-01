import React, { useState, useRef, useEffect } from 'react';
import { Book } from '../types';
import { 
  Sparkles, BookOpen, Upload, FileText, Type, Check, 
  Loader2, AlertCircle, RefreshCw, Palette, Image as ImageIcon,
  CheckCircle2, ArrowRight, Wand2
} from 'lucide-react';
import { FontPickerModal } from './FontPickerModal';
import { loadGoogleFont } from '../utils/fontsData';
import { generateUnifiedImage } from '../services/pollinationsService';
import { createSampleManuscriptPdf } from '../utils/samplePdf';

interface BookGeneratorProps {
  onBookCreated: (newBook: Book) => void;
  onOpenBook: (book: Book) => void;
}

const AGE_GROUPS = [
  '4-7 Early Reader (Simple words, high humor)',
  '8-10 Middle Grade (Captain Underpants / Dog Man style)',
  '11-13 Chapter Book (Action-packed comic adventure)',
  'All Ages Family Fun',
];

const POPULAR_FONTS = [
  { name: 'Fredoka', label: 'Fredoka (Playful Comic)' },
  { name: 'Comic Neue', label: 'Comic Neue (Clean Cartoon)' },
  { name: 'Bubblegum Sans', label: 'Bubblegum Sans (Sweet & Rounded)' },
  { name: 'Schoolbell', label: 'Schoolbell (Classroom Pencil)' },
  { name: 'Quicksand', label: 'Quicksand (Friendly Sans)' },
  { name: 'Lora', label: 'Lora (Classic Storybook Serif)' },
  { name: 'Nunito', label: 'Nunito (Modern Warm Sans)' },
  { name: 'Merriweather', label: 'Merriweather (Literary Editorial)' },
  { name: 'OpenDyslexic', label: 'OpenDyslexic (Dyslexia Friendly)' },
];

const PRESET_COVERS = [
  { label: 'Clocktower Adventure', url: '/src/assets/images/midnight_typist_1790794964604.jpg' },
  { label: 'Neon Dino', url: '/src/assets/images/cover_juice_dino_1790627570229.jpg' },
  { label: 'Power Treat Puppy', url: '/src/assets/images/cover_power_treat_1790627560796.jpg' },
  { label: 'Retro Hamster', url: '/src/assets/images/cover_game_hamster_1790627550696.jpg' },
  { label: 'Pizza Pirates', url: '/src/assets/images/pizza_pirates_1790629395705.jpg' },
  { label: 'Barkery Pup', url: '/src/assets/images/barkery_muffin_meltdown_1790629361516.jpg' },
];

export const BookGenerator: React.FC<BookGeneratorProps> = ({
  onBookCreated,
  onOpenBook,
}) => {
  // Required user inputs
  const [title, setTitle] = useState('Barnaby and the Magic Clocktower');
  const [blurb, setBlurb] = useState(
    'When a curious boy and his flying golden puppy discover an ancient brass door inside the town clocktower, an enchanting mystery takes flight!'
  );
  const [moral, setMoral] = useState(
    'With kindness, imagination, and friendship, you can lift up the whole world.'
  );
  const [coverUrl, setCoverUrl] = useState('/src/assets/images/midnight_typist_1790794964604.jpg');
  const [ageGroup, setAgeGroup] = useState('8-10 Middle Grade (Captain Underpants / Dog Man style)');
  const [selectedFont, setSelectedFont] = useState('Fredoka');

  // PDF manuscript file state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>('');
  const [pdfBase64, setPdfBase64] = useState<string>('');

  // UI helpers & state
  const [fontModalOpen, setFontModalOpen] = useState(false);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const coverImageInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize sample PDF on mount if none selected
  useEffect(() => {
    loadGoogleFont(selectedFont);
  }, [selectedFont]);

  // Load sample PDF helper
  const handleLoadSamplePdf = () => {
    const sample = createSampleManuscriptPdf(title, blurb);
    handleSelectPdfFile(sample);
  };

  // Convert File to base64
  const handleSelectPdfFile = (file: File) => {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Please select a valid PDF file (.pdf)');
      return;
    }

    setErrorMessage('');
    setPdfFile(file);
    setPdfFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPdfBase64(result);
    };
    reader.readAsDataURL(file);
  };

  // Upload local cover image helper
  const handleSelectCoverFile = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setCoverUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Generate cover with AI watercolor
  const handleGenerateAiCover = async () => {
    if (!title.trim() && !blurb.trim()) {
      setErrorMessage('Please type a Title and Blurb first to generate a cover art.');
      return;
    }

    setIsGeneratingCover(true);
    setErrorMessage('');
    try {
      const result = await generateUnifiedImage({
        prompt: `${title}. ${blurb}`,
        title: title.trim(),
        isCover: true,
        aspectRatio: '3:4',
      });
      if (result.imageUrl) {
        setCoverUrl(result.imageUrl);
      }
    } catch (err: any) {
      console.warn('Cover generation failed:', err);
    } finally {
      setIsGeneratingCover(false);
    }
  };

  // Execute PDF Ingestion & Book Creation
  const handleCreateBook = async () => {
    if (!title.trim()) {
      setErrorMessage('Please enter a Book Title.');
      return;
    }
    if (!blurb.trim()) {
      setErrorMessage('Please enter a Back Cover Blurb.');
      return;
    }
    if (!pdfBase64) {
      setErrorMessage('Please upload a PDF manuscript file (or click "Load Sample Story PDF").');
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');

    try {
      setProcessingStep('1/4: Analyzing PDF structure & skipping Page 1 (blurb and cover)...');
      await new Promise((r) => setTimeout(r, 400));

      setProcessingStep('2/4: Ingesting pages 2 through end as real book chapters & story prose...');

      const response = await fetch('/api/books/generate-from-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          blurb: blurb.trim(),
          moral: moral.trim(),
          coverUrl: coverUrl.trim(),
          ageGroup,
          fontFamily: selectedFont,
          pdfBase64,
          pdfFileName,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to process PDF book');
      }

      setProcessingStep(`3/4: Applying custom typography font "${selectedFont}" to manuscript...`);
      await new Promise((r) => setTimeout(r, 400));

      const data = await response.json();
      const createdBook: Book = data.book;

      setProcessingStep('4/4: Book ready! Opening in Storybook Reader...');
      await new Promise((r) => setTimeout(r, 500));

      // Save to library and immediately open in reader with the chosen font
      onBookCreated(createdBook);
      onOpenBook(createdBook);
    } catch (err: any) {
      console.error('Book generation from PDF error:', err);
      setErrorMessage(err.message || 'Error converting PDF into book. Please try again.');
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded-3xl p-6 sm:p-8 text-stone-950 shadow-xl mb-8 relative overflow-hidden border-2 border-amber-300">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/40 backdrop-blur-md text-stone-950 text-xs font-black mb-3">
            <Sparkles className="w-3.5 h-3.5 text-stone-950" />
            <span>PDF Storybook Generator</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black font-['Fredoka'] tracking-tight mb-2 text-stone-950">
            Create Your Book from a PDF Manuscript
          </h1>
          <p className="text-sm sm:text-base text-stone-900 font-bold leading-relaxed">
            Fill in your title, blurb, moral, cover, age group, and typography font.
            The engine reads your PDF, automatically skips Page 1 (cover & blurb),
            ingests Pages 2+ as the real book, and immediately displays it in your chosen font!
          </p>
        </div>

        {/* Decorative corner artwork */}
        <div className="absolute top-4 right-8 text-7xl select-none opacity-30 hidden sm:block">
          📖
        </div>
      </div>

      {/* Error Notification */}
      {errorMessage && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-100 border-2 border-rose-300 text-rose-900 text-xs sm:text-sm font-bold flex items-center gap-3 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Two-Column Grid: Form & Live Cover/Font Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Form Controls */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-7 border-2 border-amber-200/90 shadow-md space-y-5">
          
          {/* 1. Book Title */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1.5 font-['Fredoka']">
              Book Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Barnaby and the Magic Clocktower"
              disabled={isProcessing}
              className="w-full px-4 py-2.5 text-sm font-bold rounded-2xl bg-amber-50/50 border border-amber-200 focus:outline-none focus:ring-2 focus:ring-orange-500 text-stone-900 shadow-inner"
            />
          </div>

          {/* 2. Back Cover Blurb */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1.5 font-['Fredoka']">
              Back Cover Blurb *
            </label>
            <textarea
              rows={3}
              value={blurb}
              onChange={(e) => setBlurb(e.target.value)}
              placeholder="Short exciting summary of the story for the back cover..."
              disabled={isProcessing}
              className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-2xl bg-amber-50/50 border border-amber-200 focus:outline-none focus:ring-2 focus:ring-orange-500 text-stone-800 leading-relaxed shadow-inner"
            />
          </div>

          {/* 3. Moral of the Story */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1.5 font-['Fredoka']">
              Moral of the Story *
            </label>
            <input
              type="text"
              value={moral}
              onChange={(e) => setMoral(e.target.value)}
              placeholder="e.g. Kindness, courage, and teamwork overcome any challenge."
              disabled={isProcessing}
              className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-2xl bg-amber-50/50 border border-amber-200 focus:outline-none focus:ring-2 focus:ring-orange-500 text-stone-800 shadow-inner"
            />
          </div>

          {/* 4. Age Group */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1.5 font-['Fredoka']">
              Target Age Group *
            </label>
            <select
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value)}
              disabled={isProcessing}
              className="w-full px-4 py-2.5 text-xs font-bold rounded-2xl bg-amber-50/50 border border-amber-200 focus:outline-none focus:ring-2 focus:ring-orange-500 text-stone-800"
            >
              {AGE_GROUPS.map((grp) => (
                <option key={grp} value={grp}>
                  {grp}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Book Typography Font (The AI will put in the font wanted) */}
          <div className="bg-amber-100/50 p-4 rounded-2xl border border-amber-300 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-stone-900 font-['Fredoka'] flex items-center gap-1.5">
                <Type className="w-4 h-4 text-orange-600" />
                <span>Storybook Font *</span>
              </label>
              <button
                type="button"
                onClick={() => setFontModalOpen(true)}
                className="text-xs font-bold text-orange-700 hover:text-orange-900 underline"
              >
                Browse All 100+ Fonts
              </button>
            </div>

            <select
              value={selectedFont}
              onChange={(e) => setSelectedFont(e.target.value)}
              disabled={isProcessing}
              className="w-full px-3 py-2 text-xs font-black rounded-xl bg-white border border-amber-300 text-stone-900"
            >
              {POPULAR_FONTS.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.label}
                </option>
              ))}
            </select>

            {/* Live font preview line */}
            <div className="p-3 bg-white rounded-xl border border-amber-200 text-stone-900 shadow-inner">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                Live Font Sample ({selectedFont}):
              </span>
              <p
                style={{ fontFamily: selectedFont }}
                className="text-sm sm:text-base leading-snug text-stone-800"
              >
                "The brass clock ticked, the golden puppy hovered, and the magic began!"
              </p>
            </div>
          </div>

          {/* 6. PDF Manuscript Upload (Page 1 = Blurb/Cover, Pages 2+ = Real Book) */}
          <div className="bg-orange-50/70 p-4 rounded-2xl border-2 border-dashed border-orange-300 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-stone-900 font-['Fredoka'] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-orange-600" />
                <span>PDF Manuscript *</span>
              </label>
              <button
                type="button"
                onClick={handleLoadSamplePdf}
                className="text-xs font-bold px-2.5 py-1 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-900 border border-orange-300 transition-colors"
              >
                + Load Sample Story PDF
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleSelectPdfFile(file);
              }}
              className="hidden"
            />

            {pdfFile ? (
              <div className="p-3 bg-white rounded-xl border border-orange-300 flex items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-lg bg-red-100 text-red-700 font-black text-xs">
                    PDF
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-stone-900 truncate">
                      {pdfFileName}
                    </p>
                    <p className="text-[11px] text-stone-500">
                      {(pdfFile.size / 1024).toFixed(1)} KB • Ready for extraction
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-100 hover:bg-amber-200 text-stone-800 transition-colors"
                >
                  Change
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer py-6 px-4 bg-white/80 hover:bg-white rounded-xl border border-orange-200 text-center transition-all flex flex-col items-center justify-center gap-1.5 group"
              >
                <Upload className="w-6 h-6 text-orange-500 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-black text-stone-800">
                  Click to Choose or Drag & Drop PDF
                </span>
                <span className="text-[11px] text-stone-500">
                  Select your manuscript (.pdf) file
                </span>
              </div>
            )}

            {/* Explanatory Rule Banner */}
            <div className="p-2.5 rounded-xl bg-amber-100/80 border border-amber-300 text-[11px] text-amber-950 font-medium leading-relaxed">
              <strong>Engine Rule:</strong> Page 1 is always reserved for the blurb & cover, so it is automatically excluded. Pages 2 to the rest are ingested as the real book!
            </div>
          </div>

          {/* 7. Action Button: Generate & Open Book */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleCreateBook}
            className="w-full py-4 px-6 rounded-2xl text-base font-black bg-gradient-to-r from-orange-500 via-amber-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-stone-950 shadow-xl shadow-orange-500/25 flex items-center justify-center gap-2.5 transform active:scale-95 transition-all disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-stone-950" />
                <span>{processingStep || 'Processing PDF Manuscript...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-stone-950" />
                <span>Generate Book & Open in Reader</span>
                <ArrowRight className="w-5 h-5 text-stone-950" />
              </>
            )}
          </button>

          {processingStep && (
            <div className="p-3 rounded-xl bg-orange-100 border border-orange-300 text-orange-950 text-xs font-bold text-center animate-fadeIn">
              {processingStep}
            </div>
          )}

        </div>

        {/* Right Column: Book Cover Controls & Live 3:4 Preview */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Cover Management Card */}
          <div className="bg-white rounded-3xl p-5 border-2 border-amber-200/90 shadow-md space-y-4">
            
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-stone-900 font-['Fredoka'] flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-orange-600" />
                <span>Book Cover Art *</span>
              </label>
              <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full">
                3:4 Storybook Canvas
              </span>
            </div>

            {/* Cover Preview Frame (3:4 Ratio) */}
            <div className="w-full aspect-[3/4] max-w-[280px] mx-auto rounded-2xl overflow-hidden shadow-lg border-2 border-amber-300 relative bg-stone-100 group">
              <img
                src={coverUrl}
                alt="Book Cover"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
                onError={(e) => {
                  (e.target as any).src = '/src/assets/images/midnight_typist_1790794964604.jpg';
                }}
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-stone-950/80 via-stone-950/40 to-transparent p-3 text-white">
                <p
                  style={{ fontFamily: selectedFont }}
                  className="font-black text-sm text-center leading-tight truncate text-amber-200"
                >
                  {title || 'Book Title'}
                </p>
                <p className="text-[10px] text-center text-stone-300 mt-0.5">
                  Font: {selectedFont}
                </p>
              </div>
            </div>

            {/* AI Watercolor Cover Generator Button */}
            <button
              type="button"
              disabled={isGeneratingCover || isProcessing}
              onClick={handleGenerateAiCover}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-black bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-50"
            >
              {isGeneratingCover ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Watercolor Cover (Google GenAI)...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 text-amber-300" />
                  <span>Generate Watercolor Cover with AI</span>
                </>
              )}
            </button>

            {/* Upload or Custom URL Controls */}
            <div className="pt-2 border-t border-amber-200 space-y-2">
              <input
                ref={coverImageInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleSelectCoverFile(file);
                }}
                className="hidden"
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => coverImageInputRef.current?.click()}
                  className="py-2 px-3 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-stone-800 border border-amber-200 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 text-stone-600" />
                  <span>Upload Image</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const url = prompt('Enter Cover Image URL:', coverUrl);
                    if (url) setCoverUrl(url.trim());
                  }}
                  className="py-2 px-3 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-stone-800 border border-amber-200 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Palette className="w-3.5 h-3.5 text-stone-600" />
                  <span>Paste URL</span>
                </button>
              </div>

              {/* Preset Gallery Chips */}
              <div>
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                  Or pick a storybook cover:
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {PRESET_COVERS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCoverUrl(preset.url)}
                      className={`h-14 rounded-lg overflow-hidden border-2 transition-all relative ${
                        coverUrl === preset.url
                          ? 'border-orange-500 ring-2 ring-orange-300 scale-95'
                          : 'border-amber-200 hover:border-amber-400'
                      }`}
                    >
                      <img
                        src={preset.url}
                        alt={preset.label}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>

      {/* Font Picker Modal */}
      <FontPickerModal
        isOpen={fontModalOpen}
        onClose={() => setFontModalOpen(false)}
        currentFont={selectedFont}
        onSelectFont={(fontName) => {
          setSelectedFont(fontName);
          loadGoogleFont(fontName);
        }}
      />

    </div>
  );
};
