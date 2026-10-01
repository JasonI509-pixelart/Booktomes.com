// Puter.js Cloud AI Service for 100% Free Novel & Image Generation
// Provides unlimited text generation and Flux-1 Schnell / GPT Image 2.5 Flare visual rendering

declare global {
  interface Window {
    puter?: any;
  }
}

export interface PuterGenerationProgress {
  phase: 'init' | 'outline' | 'writing' | 'illustrations' | 'cover' | 'complete' | 'error';
  currentChapter: number;
  totalChapters: number;
  chapterTitle?: string;
  message: string;
  totalWordsGenerated: number;
  currentChunk?: string;
  coverUrl?: string;
}

export const isPuterAvailable = (): boolean => {
  return typeof window !== 'undefined' && !!(window as any).puter?.ai;
};

export const initPuterConnection = async (): Promise<{ username?: string; connected: boolean }> => {
  if (typeof window === 'undefined' || !window.puter) {
    return { connected: false };
  }

  try {
    if (window.puter.auth && typeof window.puter.auth.isSignedIn === 'function') {
      if (!window.puter.auth.isSignedIn()) {
        try {
          await window.puter.auth.signIn();
        } catch {
          // Guest mode fallback
        }
      }

      if (window.puter.auth.isSignedIn()) {
        const user = await window.puter.auth.getUser();
        return { username: user?.username || 'Puter Guest', connected: true };
      }
    }
    return { username: 'Puter User', connected: true };
  } catch (err) {
    console.warn('Puter init notice:', err);
    return { connected: true };
  }
};

export const generatePuterText = async (prompt: string, model?: string): Promise<string> => {
  if (!window.puter?.ai?.chat) {
    throw new Error('Puter AI engine is not available. Ensure puter.js script is loaded.');
  }

  const response = await window.puter.ai.chat(prompt, model ? { model } : undefined);
  
  if (typeof response === 'string') {
    return response.trim();
  }
  if (response?.message?.content) {
    return String(response.message.content).trim();
  }
  if (response?.text) {
    return String(response.text).trim();
  }
  return String(response).trim();
};

export interface PuterImageOptions {
  model?: 'flux-1-schnell' | 'gpt-image-2.5-flare' | string;
  testMode?: boolean;
  quality?: string;
  [key: string]: any;
}

// Enhances raw prompts to produce the hand-painted watercolor & colored pencil aesthetic of the Fantastic 6
// Strictly forbids gibberish/misspelled text inside images
export const enhancePromptForFantasticStyle = (rawPrompt: string, title?: string): string => {
  return `Children's storybook front cover illustration for "${title || 'Adventure'}".
• Visual Style: Hand-drawn illustrations utilizing a soft, warm watercolor and colored pencil aesthetic with fine ink line work on cream textured paper.
• Scene: ${rawPrompt}. Hand-painted charming characters, vibrant warm lighting, cozy nostalgic storybook atmosphere, organic paper texture, detailed traditional picture book art.
• CRITICAL QUALITY RULE: Absolutely NO misspelled words, NO gibberish lettering, NO floating text fragments, NO distorted letters, NO speech bubbles. Pure clean picture book illustration.`;
};

export const enhanceChapterIllustrationPrompt = (sceneDetail: string, bookTitle?: string, chapterTitle?: string): string => {
  return `Children's storybook interior page illustration for "${bookTitle || 'Story'}": ${chapterTitle || ''}.
• Visual Style: Hand-drawn illustrations utilizing a soft, warm watercolor and colored pencil aesthetic with fine ink line work on warm cream paper.
• Scene: ${sceneDetail}. Expressive, whimsical characters, soft watercolor wash, delicate colored pencil texture, fine ink outlines, cozy storybook charm.
• CRITICAL QUALITY RULE: Absolutely NO written text, NO words, NO letters, NO signs with writing, NO speech bubbles, NO garbled text. Pure visual narrative illustration.`;
};

// Generates an illustration tailored to a specific story page's action and prose
export const generatePageArtwork = async (params: {
  bookTitle: string;
  chapterTitle: string;
  pageText: string;
  ageGroup?: string;
  genre?: string;
}): Promise<{ imageUrl: string; sceneDescription: string }> => {
  // 1. Ask backend AI to describe the visual scene and craft a text-free prompt
  let sceneDescription = 'A charming storybook moment with whimsical characters.';
  let artPrompt = enhanceChapterIllustrationPrompt(params.pageText.slice(0, 300), params.bookTitle, params.chapterTitle);
  let fallbackImage = '/src/assets/images/midnight_typist_1790794964604.jpg';

  try {
    const res = await fetch('/api/books/generate-page-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const data = await res.json();
      sceneDescription = data.sceneDescription || sceneDescription;
      artPrompt = data.artPrompt || artPrompt;
      fallbackImage = data.fallbackImage || fallbackImage;
    }
  } catch (err) {
    console.warn('Failed to call /api/books/generate-page-image, using local prompt:', err);
  }

  // 2. If Puter image generation is available in browser, generate fresh high-res image
  if (isPuterAvailable()) {
    try {
      const generated = await generatePuterImage(artPrompt);
      if (generated) {
        return { imageUrl: generated, sceneDescription };
      }
    } catch (puterErr) {
      console.warn('Puter txt2img failed, falling back to gallery asset:', puterErr);
    }
  }

  // Fallback to high-res thematic watercolor illustration
  return { imageUrl: fallbackImage, sceneDescription };
};

export const generatePuterImage = async (
  prompt: string,
  optionsOrModel?: 'flux-1-schnell' | 'gpt-image-2.5-flare' | string | PuterImageOptions,
  testMode: boolean = false
): Promise<string> => {
  if (!window.puter?.ai?.txt2img) {
    throw new Error('Puter AI Image engine is not available. Ensure puter.js script is loaded.');
  }

  // Normalize options
  const options: PuterImageOptions =
    typeof optionsOrModel === 'string'
      ? { model: optionsOrModel, testMode }
      : { model: 'flux-1-schnell', testMode, ...(optionsOrModel || {}) };

  let imgResult: any;

  // Supports:
  // 1. puter.ai.txt2img({ prompt, ...options })
  // 2. puter.ai.txt2img(prompt, options = {})
  // 3. puter.ai.txt2img(prompt, testMode = false)
  try {
    imgResult = await window.puter.ai.txt2img({
      prompt,
      ...options,
    });
  } catch (err1) {
    try {
      imgResult = await window.puter.ai.txt2img(prompt, options);
    } catch (err2) {
      imgResult = await window.puter.ai.txt2img(prompt, options.testMode ?? false);
    }
  }

  if (imgResult instanceof HTMLImageElement) {
    return imgResult.src;
  }
  if (imgResult && typeof imgResult.src === 'string') {
    return imgResult.src;
  }
  if (typeof imgResult === 'string') {
    return imgResult;
  }

  throw new Error('Puter image output could not be parsed.');
};

export interface GeneratePuterBookOptions {
  userConcept: string;
  title?: string;
  firstSentence?: string;
  blurb?: string;
  ageGroup: string;
  targetWordCount: number;
  chapterCount: number;
  pageCount?: number;
  wordsPerPage?: number;
  fontFamily?: string;
  artModel?: 'flux-1-schnell' | 'gpt-image-2.5-flare';
  onProgress?: (progress: PuterGenerationProgress) => void;
}

export const generateNovelWithPuter = async (options: GeneratePuterBookOptions) => {
  const {
    userConcept,
    title: specifiedTitle,
    firstSentence: specifiedFirstSentence,
    blurb: specifiedBlurb,
    ageGroup,
    targetWordCount,
    chapterCount,
    fontFamily = 'Fredoka',
    artModel = 'flux-1-schnell',
    onProgress,
  } = options;

  onProgress?.({
    phase: 'init',
    currentChapter: 0,
    totalChapters: chapterCount,
    message: 'Connecting to free Puter Cloud AI Network...',
    totalWordsGenerated: 0,
  });

  await initPuterConnection();

  const isEarly = ageGroup.includes('4-7') || ageGroup.includes('Early Reader') || ageGroup.includes('Preschool');
  const targetPerChapter = Math.max(250, Math.floor(targetWordCount / chapterCount));

  // 1. Outline Generation
  onProgress?.({
    phase: 'outline',
    currentChapter: 0,
    totalChapters: chapterCount,
    message: 'Autonomous Engine: Outlining novel chapters with Anti-Sameness Code...',
    totalWordsGenerated: 0,
  });

  const outlinePrompt = `You are a high-volume children's book author. Write an outline for a fun, multi-chapter kid novel.
Concept: "${userConcept}"
${specifiedTitle ? `Required Title: "${specifiedTitle}"` : ''}
${specifiedFirstSentence ? `Required Opening Sentence: "${specifiedFirstSentence}"` : ''}
${specifiedBlurb ? `Required Blurb: "${specifiedBlurb}"` : ''}
Target Chapters: ${chapterCount}
Target Age Group: ${ageGroup}
${isEarly ? 'STRICT: For Early Readers (ages 4-7). Simple story, funny animals, joyful sounds!' : 'Humorous slapstick, witty dialogue, funny action!'}

Reply ONLY with valid JSON with this exact format, with NO backticks or markdown wrap:
{
  "title": "Fun Kid Novel Title",
  "blurb": "Catchy 2-3 sentence book summary",
  "firstSentence": "Gripping first line",
  "genre": "Silly Adventure / Comedy",
  "moral": "Wholesome positive lesson",
  "chapters": [
    {
      "chapterNumber": 1,
      "title": "Catchy Chapter 1 Title",
      "summary": "Brief summary of chapter events"
    }
  ]
}`;

  let bookMeta: any = {
    title: specifiedTitle || 'The Great Watermelon Catastrophe',
    blurb: specifiedBlurb || 'A giant fruit rolls into town and chaos erupts!',
    firstSentence: specifiedFirstSentence || 'Never throw watermelon seeds at an angry pelican.',
    genre: 'Silly Adventure',
    moral: 'Teamwork solves sticky problems.',
    chapters: Array.from({ length: chapterCount }).map((_, i) => ({
      chapterNumber: i + 1,
      title: `Chapter ${i + 1}: The Adventure Begins`,
      summary: `Plot development for chapter ${i + 1}`,
    })),
  };

  try {
    const rawOutline = await generatePuterText(outlinePrompt);
    const cleaned = rawOutline.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    bookMeta = { ...bookMeta, ...parsed };
    if (specifiedTitle) bookMeta.title = specifiedTitle;
    if (specifiedFirstSentence) bookMeta.firstSentence = specifiedFirstSentence;
    if (specifiedBlurb) bookMeta.blurb = specifiedBlurb;
  } catch (outlineErr) {
    console.warn('Puter outline JSON parse fallback:', outlineErr);
  }

  // 2. Chapter Writing
  const generatedChapters: any[] = [];
  let cumulativeWords = 0;

  for (let i = 0; i < (bookMeta.chapters || []).length; i++) {
    const ch = bookMeta.chapters[i];
    onProgress?.({
      phase: 'writing',
      currentChapter: i + 1,
      totalChapters: bookMeta.chapters.length,
      chapterTitle: ch.title,
      message: `Writing Chapter ${i + 1} of ${bookMeta.chapters.length}: "${ch.title}"...`,
      totalWordsGenerated: cumulativeWords,
    });

    const chapterPrompt = `You are writing Chapter ${i + 1} of the children's book: "${bookMeta.title}".
Age Group: ${ageGroup}
${isEarly ? 'STRICT RULES: Use ONLY simple 1-2 syllable words, common sight words, and short sentences (max 8 words each). Include fun sound effects in CAPS (e.g. ZOOM!, SPLASH!, POP!). NO BIG WORDS.' : 'Style: High energy, funny, slapstick, exciting dialogue like Captain Underpants or Dog Man.'}
Chapter Title: "${ch.title}"
${i === 0 && bookMeta.firstSentence ? `MANDATORY OPENING SENTENCE: Start chapter 1 with this exact sentence: "${bookMeta.firstSentence}"` : ''}
Target Length: Approximately ${targetPerChapter} words.

IMPORTANT: Write ONLY the story prose text. Do not include chapter number headers, page dividers, notes, or introductions. Begin writing now:`;

    let chapterText = '';
    try {
      chapterText = await generatePuterText(chapterPrompt);
    } catch (txtErr) {
      console.warn(`Puter text generation error on chapter ${i + 1}:`, txtErr);
      chapterText = `${i === 0 && bookMeta.firstSentence ? bookMeta.firstSentence + ' ' : ''}The morning was warm and full of surprises. Suddenly, a loud sound echoed through the neighborhood! Everyone looked up in astonishment. Together, the brave friends knew what they had to do. They took a deep breath, grinned, and raced toward the adventure.`;
    }

    // Stream text visual preview
    onProgress?.({
      phase: 'writing',
      currentChapter: i + 1,
      totalChapters: bookMeta.chapters.length,
      chapterTitle: ch.title,
      message: `Finished Chapter ${i + 1}: "${ch.title}"`,
      totalWordsGenerated: cumulativeWords,
      currentChunk: chapterText,
    });

    const chapterWords = chapterText.trim().split(/\s+/).filter(Boolean).length;
    cumulativeWords += chapterWords;

    // 3. Chapter Scene Illustration
    let chapterImageUrl: string | undefined = undefined;
    const shouldIllustrate = i === 0 || bookMeta.chapters.length <= 4 || isEarly;
    if (shouldIllustrate) {
      onProgress?.({
        phase: 'illustrations',
        currentChapter: i + 1,
        totalChapters: bookMeta.chapters.length,
        chapterTitle: ch.title,
        message: `Rendering watercolor & colored pencil illustration for Chapter ${i + 1}...`,
        totalWordsGenerated: cumulativeWords,
      });

      try {
        const illPrompt = enhanceChapterIllustrationPrompt(
          `Scene from Chapter ${i + 1} (${ch.title}): ${ch.summary || ch.title}. Whimsical character moment`,
          bookMeta.title,
          ch.title
        );
        chapterImageUrl = await generatePuterImage(illPrompt, artModel);
      } catch (illErr) {
        console.warn('Puter chapter image generation fallback:', illErr);
      }
    }

    generatedChapters.push({
      chapterNumber: i + 1,
      title: ch.title,
      content: chapterText.trim(),
      wordCount: chapterWords,
      imageUrl: chapterImageUrl,
    });
  }

  // 4. Book Cover Illustration Rendering in Fantastic Hand-Painted Watercolor Style
  onProgress?.({
    phase: 'cover',
    currentChapter: bookMeta.chapters.length,
    totalChapters: bookMeta.chapters.length,
    message: `Rendering hand-drawn watercolor book cover with Puter ${artModel}...`,
    totalWordsGenerated: cumulativeWords,
  });

  let coverUrl = '';
  try {
    const coverPrompt = enhancePromptForFantasticStyle(
      `Full front cover for "${bookMeta.title}". ${userConcept || bookMeta.blurb}. Charming characters, intricate whimsical scenery`,
      bookMeta.title
    );
    coverUrl = await generatePuterImage(coverPrompt, artModel);
  } catch (covErr) {
    console.warn('Puter cover image generation error:', covErr);
  }

  // 5. Build Final Book Record
  const newBook = {
    id: 'book-' + Date.now(),
    title: bookMeta.title,
    blurb: bookMeta.blurb,
    firstSentence: bookMeta.firstSentence,
    ageGroup,
    targetWordCount,
    actualWordCount: cumulativeWords,
    pageCount: options.pageCount || Math.max(1, Math.ceil(cumulativeWords / (options.wordsPerPage || 150))),
    wordsPerPage: options.wordsPerPage || Math.max(20, Math.round(cumulativeWords / (options.pageCount || 10))),
    genre: bookMeta.genre || 'Hilarious Kid Adventure',
    moral: bookMeta.moral || 'Bravery, curiosity, and kindness win the day!',
    coverUrl: coverUrl || '',
    fontFamily: fontFamily || 'Fredoka',
    coverTheme: {
      theme: userConcept.toLowerCase().includes('watermelon') ? 'watermelon' : 'comic',
      fontFamily: fontFamily || 'Fredoka',
      primaryColor: '#f43f5e',
      secondaryColor: '#10b981',
      accentColor: '#fbbf24',
    },
    isPublished: true,
    createdAt: new Date().toISOString(),
    chapters: generatedChapters,
  };

  // 6. Save directly to backend database so it persists in Library
  try {
    await fetch('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newBook),
    });
  } catch (saveErr) {
    console.warn('Failed to persist book to backend DB:', saveErr);
  }

  onProgress?.({
    phase: 'complete',
    currentChapter: bookMeta.chapters.length,
    totalChapters: bookMeta.chapters.length,
    message: 'Novel successfully forged with Puter AI!',
    totalWordsGenerated: cumulativeWords,
    coverUrl,
  });

  return newBook;
};
