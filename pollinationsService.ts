// Pollinations.ai Unlimited Free High Graphics Image Generator & Character Consistency Engine
// Generates storybook covers and interior page illustrations using Pollinations.ai (https://pollinations.ai)
// Enforces character visual consistency (same hair, same clothes, same colors across cover and all pages)

import { Book, Chapter } from '../types';

export const EXACT_ART_DIRECTION = "Children's book cover illustration art, vintage storybook style, detailed watercolor wash, intricate colored pencil shading and cross-hatching, fine ink outlines, textured cream paper background, whimsical and highly detailed, vibrant yet nostalgic color palette, high graphics, masterpieces graphics";

export interface PollinationsImageOptions {
  width?: number;
  height?: number;
  seed?: number;
  model?: string;
  enhance?: boolean;
  nologo?: boolean;
}

// Generate a direct Pollinations.ai image URL with 3:4 canvas (768x1024) and Flux high graphics model
export const getPollinationsImageUrl = (
  prompt: string,
  options: PollinationsImageOptions = {}
): string => {
  const width = options.width || 768;
  const height = options.height || 1024;
  const seed = options.seed !== undefined ? options.seed : Math.floor(Math.random() * 10000000);
  const nologo = options.nologo !== false;
  const model = options.model || 'flux';
  const enhance = options.enhance !== false;

  // Clean prompt: remove extra newlines, compress spaces
  const cleanPrompt = prompt.replace(/\s+/g, ' ').trim();
  const encodedPrompt = encodeURIComponent(cleanPrompt);

  return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=${encodeURIComponent(model)}&enhance=${enhance}&seed=${seed}&nologo=${nologo}`;
};

// Generates a cover URL with the exact visual style enhancement dynamically appended
export const generateAdminCoverUrl = (
  userConceptOrTitle: string,
  seed?: number
): string => {
  const base = userConceptOrTitle.trim();
  const combined = `${base}. ${EXACT_ART_DIRECTION}`;
  return getPollinationsImageUrl(combined, {
    width: 768,
    height: 1024,
    model: 'flux',
    enhance: true,
    seed,
  });
};

// Build exact whimsical storybook watercolor prompt matching user's Google GenAI specification
export const buildWhimsicalStorybookPrompt = (params: {
  prompt: string;
  title?: string;
  isCover: boolean;
}): string => {
  const scene = (params.prompt || params.title || 'A whimsical magical storybook adventure').trim();
  if (params.isCover) {
    const titleInstruction = params.title && params.title.trim()
      ? ` The book title "${params.title.trim()}" is featured at the top in beautiful hand-lettered storybook calligraphy.`
      : ' NO text.';
    return `A whimsical children's book cover illustration, delightful cartoon style. The medium is transparent watercolor paint wash blended with soft colored pencil sketching and gentle cross-hatching textures. Every element features fine, thin line ink outlines. The background is a warm, nostalgic textured cream paper. The scene depicts: ${scene}.${titleInstruction} Bright, cheerful, and charming atmosphere, highly detailed storybook aesthetic.`;
  } else {
    // Interior page image (NOT a cover): strictly NO text or title
    return `A whimsical children's book illustration, delightful cartoon style. The medium is transparent watercolor paint wash blended with soft colored pencil sketching and gentle cross-hatching textures. Every element features fine, thin line ink outlines. The background is a warm, nostalgic textured cream paper. The scene depicts: ${scene}. Bright, cheerful, and charming atmosphere, highly detailed storybook aesthetic, NO text.`;
  }
};

// Unified Multi-Engine Image Making (Google GenAI gemini-3.1-flash-image + Watercolor Storybook Pipeline)
// Supports title input only if it's a cover, and automatically applies watercolor wash, colored pencil, ink outlines
export const generateUnifiedImage = async (params: {
  prompt: string;
  title?: string;
  isCover: boolean;
  aspectRatio?: string;
}): Promise<{ imageUrl: string; source: string; prompt: string }> => {
  const fullPrompt = buildWhimsicalStorybookPrompt({
    prompt: params.prompt,
    title: params.isCover ? params.title : undefined, // Title only if cover!
    isCover: params.isCover,
  });

  try {
    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: params.prompt,
        title: params.isCover ? params.title : undefined,
        isCover: params.isCover,
        aspectRatio: params.aspectRatio,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.imageUrl) {
        return data;
      }
    }
  } catch (err) {
    console.warn('API /api/generate-image call fallback:', err);
  }

  // Pure client fallback if network offline or server unreachable
  const seed = Math.floor(Math.random() * 90000000) + 10000000;
  const targetWidth = params.isCover ? 768 : 800;
  const targetHeight = params.isCover ? 1024 : 600;

  const encoded = encodeURIComponent(fullPrompt);
  const fallbackUrl = `https://image.pollinations.ai/prompt/${encoded}?width=${targetWidth}&height=${targetHeight}&model=flux&enhance=true&seed=${seed}&nologo=true`;

  return { imageUrl: fallbackUrl, source: 'pollinations-flux', prompt: fullPrompt };
};

// Download generated image locally
export const downloadImageFromUrl = async (imageUrl: string, filename = 'storybook_cover.jpg'): Promise<void> => {
  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.warn('Direct blob download failed, falling back to direct link:', err);
    const a = document.createElement('a');
    a.href = imageUrl;
    a.target = '_blank';
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
};

// Verifies that a generated Pollinations image loads properly in the browser.
// If it fails or times out, it retries with a new random seed up to maxRetries times.
export const loadAndVerifyPollinationsImage = async (
  basePrompt: string,
  options: PollinationsImageOptions = {},
  maxRetries: number = 3,
  onAttempt?: (attempt: number) => void
): Promise<string> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    onAttempt?.(attempt);
    const seed = Math.floor(Math.random() * 90000000) + 10000000;
    const url = getPollinationsImageUrl(basePrompt, { ...options, seed });

    const isLoaded = await new Promise<boolean>((resolve) => {
      const img = new Image();
      let finished = false;

      const timer = setTimeout(() => {
        if (!finished) {
          finished = true;
          img.onload = null;
          img.onerror = null;
          resolve(false);
        }
      }, 16000); // 16s timeout

      img.onload = () => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          resolve(true);
        }
      };

      img.onerror = () => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          resolve(false);
        }
      };

      img.src = url;
    });

    if (isLoaded) {
      return url;
    }
  }

  // Fallback to initial seed URL if network verification times out
  return getPollinationsImageUrl(basePrompt, options);
};

// Character Visual Consistency Engine
// Ensures the same boy/girl/creature has the exact same hair, facial features, clothes, and colors across all pages
export const resolveCharacterAnchor = (book: Partial<Book>): string => {
  if (book.characterProfile && book.characterProfile.trim() !== '') {
    return book.characterProfile.trim();
  }

  const textContext = `${book.title || ''} ${book.blurb || ''} ${book.firstSentence || ''}`.toLowerCase();

  // Smart heuristic character detection based on book theme
  if (textContext.includes('typist') || textContext.includes('barnaby') || textContext.includes('ledger')) {
    return '10-year-old boy named Barnaby with messy chestnut-brown hair, expressive wide eyes, wearing a grey knit school sweater vest, white collared shirt with blue necktie, brown knee-length shorts, and dark scuffed leather shoes.';
  }
  if (textContext.includes('pizza') || textContext.includes('pirate')) {
    return '10-year-old boy pirate named Barnaby with tousled brown hair, blue-and-white striped mariner sailor shirt, brown rolled trousers, bare feet, and his sister Mozzie with auburn pigtails, black pirate tricorn hat, and blue skirt.';
  }
  if (textContext.includes('hamster') && (textContext.includes('game') || textContext.includes('pixel') || textContext.includes('leo'))) {
    return '10-year-old boy named Leo with neat dark brown hair, striped rugby sweater, blue denim jeans, and his plump golden-furred Syrian hamster Pippin wearing a tiny transparent bubble astronaut helmet and small red cape.';
  }
  if (textContext.includes('juice') || textContext.includes('dino') || textContext.includes('neon')) {
    return 'Two young adventurers: Toby, an 8-year-old boy with messy wavy brown hair, yellow t-shirt, green cargo shorts, and oversized brass goggles pushed up on his forehead, and his friend Mia with a purple hoodie and pink sneakers.';
  }
  if (textContext.includes('scribble') || textContext.includes('toby') || textContext.includes('octopus')) {
    return '8-year-old boy named Toby with tousled brown hair, blue-and-white horizontal striped short-sleeve t-shirt, orange shorts, blue high-top sneakers with white laces, accompanied by a friendly rainbow-scribbled cartoon octopus wearing colorful sneakers.';
  }
  if (textContext.includes('puppy') || textContext.includes('power-treat')) {
    return 'A cheerful golden retriever puppy named Barnaby with fluffy honey-gold fur, large floppy ears, a playful blue cape, and a tiny multi-colored propeller beanie hat atop his head.';
  }
  if (textContext.includes('hamster') || textContext.includes('lunar') || textContext.includes('fluffington')) {
    return 'A brave little golden hamster named Sir Fluffington with soft orange-and-white fur, twitching whiskers, wearing vintage round aviator goggles and a shiny silver tinfoil rocket flight suit.';
  }

  // Default universal kid character anchor
  return 'A cheerful 9-year-old boy with messy brown hair, friendly hazel eyes, wearing a navy-blue sweater, red collared shirt, denim trousers, and white sneakers.';
};

// Generates a comprehensive, highly-detailed Pollinations cover prompt by summarizing the book
export const buildDetailedCoverPrompt = (book: Book): string => {
  const character = resolveCharacterAnchor(book);
  const summary = book.blurb || `${book.title} - a magical children's adventure full of humor, mystery, and heart.`;

  return `Children's picture book front cover illustration for "${book.title}".
• Art Direction: ${EXACT_ART_DIRECTION}
• Main Protagonist Visual Consistency: ${character}
• Story Summary & Cover Scene: ${summary}. The scene captures the whimsical moment of the story with vibrant warm storybook lighting, magical floating particles, and cozy nostalgic warmth.
• Composition: Dynamic 3:4 vertical book cover canvas with ample balanced framing.
• CRITICAL QUALITY RULE: Absolutely NO misspelled words, NO gibberish text, NO floating letters, NO signs with words, NO speech bubbles, NO typos. Pure clean picture book illustration.`;
};

// Generates an interior page prompt strictly adhering to the character's hair, clothes, and visual consistency
export const buildConsistentPagePrompt = (params: {
  book: Partial<Book>;
  chapterTitle?: string;
  pageText: string;
  pageNumber?: number;
}): string => {
  const character = resolveCharacterAnchor(params.book);
  const actionText = params.pageText.slice(0, 320).replace(/\n+/g, ' ').trim();

  return `Children's storybook interior page illustration for "${params.book.title || 'Story'}": ${params.chapterTitle || 'Chapter Scene'}.
• Art Direction: ${EXACT_ART_DIRECTION}
• Character Consistency Anchor: The character MUST appear identical throughout the book with the exact same hair, face, and clothing: ${character}.
• Current Page Scene Action: ${actionText}.
• Setting & Mood: Expressive, whimsical storybook charm, soft watercolor wash, delicate colored pencil shading, cozy warm lighting.
• CRITICAL QUALITY RULE: Absolutely NO text, NO letters, NO words, NO signs with writing, NO speech bubbles, NO garbled letters. Pure visual story illustration.`;
};

// Generate and verify a complete Pollinations cover image
export const generatePollinationsCover = async (
  book: Book,
  onAttempt?: (attempt: number) => void
): Promise<{ coverUrl: string; prompt: string; characterProfile: string }> => {
  const characterProfile = resolveCharacterAnchor(book);
  const prompt = buildDetailedCoverPrompt({ ...book, characterProfile });
  const coverUrl = await loadAndVerifyPollinationsImage(prompt, { width: 768, height: 1024, model: 'flux', enhance: true }, 3, onAttempt);
  return { coverUrl, prompt, characterProfile };
};

// Generate and verify an interior page illustration with character consistency
export const generatePollinationsPageImage = async (params: {
  book: Partial<Book>;
  chapterTitle?: string;
  pageText: string;
  pageNumber?: number;
  onAttempt?: (attempt: number) => void;
}): Promise<{ imageUrl: string; prompt: string; characterProfile: string }> => {
  const characterProfile = resolveCharacterAnchor(params.book);
  const prompt = buildConsistentPagePrompt({ ...params, book: { ...params.book, characterProfile } });
  const imageUrl = await loadAndVerifyPollinationsImage(prompt, { width: 768, height: 1024, model: 'flux', enhance: true }, 3, params.onAttempt);
  return { imageUrl, prompt, characterProfile };
};
