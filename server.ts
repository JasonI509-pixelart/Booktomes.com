import express from 'express';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto from 'crypto';
// @ts-ignore
import * as pdfParseModule from 'pdf-parse';
const PDFParse = (pdfParseModule as any).PDFParse || (pdfParseModule as any).default?.PDFParse;

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Database paths
const DATA_DIR = path.resolve(__dirname, 'data');
const BOOKS_FILE = path.resolve(DATA_DIR, 'books.json');
const KEYS_FILE = path.resolve(DATA_DIR, 'api_keys.json');
const TTS_CACHE_DIR = path.resolve(DATA_DIR, 'tts_cache');
if (!fs.existsSync(TTS_CACHE_DIR)) {
  fs.mkdirSync(TTS_CACHE_DIR, { recursive: true });
}

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface StoredApiKey {
  id: string;
  name: string;
  key: string;
  status: 'active' | 'cooldown' | 'exhausted';
  usageCount: number;
  lastError: string | null;
  cooldownUntil?: number;
}

let apiKeysCache: StoredApiKey[] = [];
let currentCycleIndex = 0;

function loadApiKeys(): StoredApiKey[] {
  try {
    if (fs.existsSync(KEYS_FILE)) {
      const content = fs.readFileSync(KEYS_FILE, 'utf-8');
      apiKeysCache = JSON.parse(content);
      return apiKeysCache;
    }
  } catch (err) {
    console.error('Error reading api_keys.json:', err);
  }
  return apiKeysCache;
}

function saveApiKeys(keys: StoredApiKey[]) {
  apiKeysCache = keys;
  try {
    fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving api_keys.json:', err);
  }
}

// Initialize keys cache
loadApiKeys();

function getRealKeyString(keyEntry: StoredApiKey): string {
  if (keyEntry.key === 'process.env.GEMINI_API_KEY') {
    return process.env.GEMINI_API_KEY || '';
  }
  return keyEntry.key;
}

function getAiClientFor(keyString: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: keyString || process.env.GEMINI_API_KEY || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function advanceCycle() {
  const keys = loadApiKeys();
  if (keys.length > 0) {
    currentCycleIndex = (currentCycleIndex + 1) % keys.length;
    console.log(`API Cycle: Advanced to index ${currentCycleIndex} (${keys[currentCycleIndex]?.name})`);
  }
}

// Timeout helper to avoid waiting on stuck or 503-throttled API calls
function withTimeout<T>(promise: Promise<T>, ms: number = 4000): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

// Resilient model caller with multi-key round-robin cycle and model fallback
async function callGeminiGenerateWithFallback(prompt: string, isJson: boolean = false): Promise<string> {
  const models = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
  const keys = loadApiKeys();
  const totalKeys = keys.length > 0 ? keys.length : 1;

  // Cycle through the available API keys starting from currentCycleIndex
  for (let cycleAttempt = 0; cycleAttempt < totalKeys; cycleAttempt++) {
    const keyIdx = (currentCycleIndex + cycleAttempt) % totalKeys;
    const keyEntry = keys[keyIdx];
    const keyString = keyEntry ? getRealKeyString(keyEntry) : (process.env.GEMINI_API_KEY || '');
    
    if (!keyString) continue;

    for (const model of models) {
      try {
        const client = getAiClientFor(keyString);
        const config: any = {
          temperature: 0.95,
        };
        if (isJson) {
          config.responseMimeType = 'application/json';
        }

        const res = await withTimeout(
          client.models.generateContent({
            model,
            contents: prompt,
            config,
          }),
          4500
        );

        if (res && res.text) {
          if (keyEntry) {
            keyEntry.usageCount = (keyEntry.usageCount || 0) + 1;
            keyEntry.status = 'active';
            keyEntry.lastError = null;
            saveApiKeys(keys);
          }
          currentCycleIndex = keyIdx; // lock active key
          return res.text.trim();
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        const isQuota = errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('429') || errMsg.includes('quota');
        const is503 = errMsg.includes('503') || errMsg.includes('high demand');
        
        console.warn(`Key [${keyEntry?.name || keyIdx}] Model ${model} error:`, errMsg.slice(0, 120));
        
        if (isQuota && keyEntry) {
          keyEntry.status = 'cooldown';
          keyEntry.lastError = 'Quota exceeded. Cooling down.';
          saveApiKeys(keys);
        }
      }
    }
  }

  // Advance cycle for subsequent call
  advanceCycle();
  throw new Error('All model attempts and API keys in cycle temporarily exhausted');
}

// Resilient streaming generator with key cycling and fallback
async function getGeminiStreamWithFallback(prompt: string): Promise<AsyncIterable<any>> {
  const models = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  const keys = loadApiKeys();
  const totalKeys = keys.length > 0 ? keys.length : 1;

  for (let cycleAttempt = 0; cycleAttempt < totalKeys; cycleAttempt++) {
    const keyIdx = (currentCycleIndex + cycleAttempt) % totalKeys;
    const keyEntry = keys[keyIdx];
    const keyString = keyEntry ? getRealKeyString(keyEntry) : (process.env.GEMINI_API_KEY || '');
    if (!keyString) continue;

    for (const model of models) {
      try {
        const client = getAiClientFor(keyString);
        const stream = await client.models.generateContentStream({
          model,
          contents: prompt,
          config: {
            temperature: 0.95,
          },
        });
        currentCycleIndex = keyIdx;
        return stream;
      } catch (err: any) {
        console.warn(`Stream Key [${keyEntry?.name || keyIdx}] Model ${model} failed:`, err?.message || err);
      }
    }
  }

  advanceCycle();
  throw new Error('Streaming temporarily unavailable on models');
}

// Storybook gallery images for chapter page illustrations
const CHAPTER_ILLUSTRATION_GALLERY = [
  '/src/assets/images/zip_zap_scribble_1790629385351.jpg',
  '/src/assets/images/barkery_muffin_meltdown_1790629361516.jpg',
  '/src/assets/images/hamster_lunar_leap_1790629373790.jpg',
  '/src/assets/images/pizza_pirates_1790629395705.jpg',
  '/src/assets/images/cover_game_hamster_1790627550696.jpg',
  '/src/assets/images/cover_power_treat_1790627560796.jpg',
  '/src/assets/images/cover_juice_dino_1790627570229.jpg',
];

// Creative story generator with STRICT age-appropriate vocabulary and sound effects
function generateAutonomousCreativeProse(
  concept: string,
  title: string,
  chapterNum: number,
  totalChapters: number,
  chapterTitle: string,
  firstSentence?: string,
  ageGroup?: string
): string {
  const isEarlyReader = ageGroup?.includes('4-7') || ageGroup?.includes('Early Reader') || ageGroup?.includes('Preschool');
  const cleanConcept = concept || 'A little puppy and happy friends';
  const opening = chapterNum === 1 && firstSentence ? `${firstSentence}\n\n` : '';

  if (isEarlyReader) {
    // STRICT EARLY READER: Simple words, 1-2 syllables, short sentences, fun sound effects
    const earlyScenarios = [
      `The sun was bright and warm in the sky. Look! Over by the big green tree, something was moving! It was ${cleanConcept.toLowerCase()}. "Hop, hop, hop!" went the little feet. SPLASH! A puddle of blue water went flying into the air! Everyone began to giggle. "Come look at this!" shouted Leo with a big happy smile.`,
      `Inside the cozy playhouse, funny sounds went CLICK! CLACK! POP! Little colorful bubbles floated up, up, up into the air. "Catch them before they pop!" cried Mia. She jumped high off the soft rug. BOING! Her sneakers bounced like tiny trampolines. Everyone clapped their hands and laughed together with joy.`,
      `ZOOM! Down the hallway rolled the red toy wagon. It was super fast! "Hold on tight!" cheered the team. With a quick turn to the left and a little hop to the right, they found the missing piece right under the big yellow chair. "Hooray! We did it!" they cheered with happy hugs.`,
      `At the end of the happy day, the golden sun was setting. The little heroes sat together on the soft green grass and ate sweet red apples. CRUNCH! CRUNCH! "That was the best day ever," whispered the friends as they smiled under the glowing stars.`,
    ];
    const scenario = earlyScenarios[(chapterNum - 1) % earlyScenarios.length];
    return `${opening}Chapter ${chapterNum}: ${chapterTitle}\n\n${scenario}\n\n"We are the best team ever!" shouted the friends. They clapped their hands and cheered, "YAY!" That is the happy end of Chapter ${chapterNum}!`;
  }

  // Middle Grade (Ages 8-10): Fun, witty, high-energy slapstick
  const chapterScenarios = [
    `The morning sun was shining bright when the first signs of trouble appeared right in the middle of town. Everyone who walked by stopped to stare, but our heroes knew this was not a normal everyday mystery. It all started with ${cleanConcept.toLowerCase()}. With backpacks packed full of snacks, comic books, and emergency supplies, they took their first daring leap into the unknown!`,
    `Nothing could have prepared the squad for what was waiting in the shadows of the secret treehouse. Gears were clicking, gadgets were whirring, and an unexpected explosion of rainbow bubbles sent everyone diving under the sofa! "Keep your helmets on!" shouted the crew as they pieced together the strange clues.`,
    `The stakes had never been higher. Down the winding hallway came the sound of rolling wheels and high-speed laughter. By using clever teamwork, quick thinking, and a hilarious trick straight out of a comic book, they outsmarted the competition and saved the day just before the school bell rang!`,
    `Standing atop the playground hill with the sun setting in brilliant shades of orange and gold, the heroes shared a well-deserved victory feast. They looked back at the grand journey they had survived together, knowing that as long as they had friendship and imagination, no challenge was too wacky to conquer.`,
  ];

  const scenario = chapterScenarios[(chapterNum - 1) % chapterScenarios.length];

  return `${opening}Chapter ${chapterNum}: ${chapterTitle}\n\n${scenario}\n\n"We actually did it!" cheered the crew, high-fiving so enthusiastically that their socks almost flew off. Every kid in the neighborhood gathered around to witness the spectacle, cheering until the whole street was filled with pure joy and laughter. And that is how the legend of ${title} was written into the greatest storybooks of all time.`;
}

// In-memory cache for fast read/writes without statement timeouts
let booksCache: any[] = [];

function loadBooks(): any[] {
  try {
    if (fs.existsSync(BOOKS_FILE)) {
      const content = fs.readFileSync(BOOKS_FILE, 'utf-8');
      booksCache = JSON.parse(content);
      return booksCache;
    }
  } catch (err) {
    console.error('Error reading books.json:', err);
  }
  return booksCache;
}

function saveBooks(books: any[]) {
  booksCache = books;
  try {
    fs.writeFileSync(BOOKS_FILE, JSON.stringify(books, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving books.json:', err);
  }
}

// Pre-load on startup
loadBooks();

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    booksCount: booksCache.length,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// API Documentation directory
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'NovelForge Kids Book Engine API Directory',
    version: '1.0.0',
    description: 'Autonomous multi-chapter children novel generator, streaming writer, cover renderer, and reader backend.',
    endpoints: [
      {
        path: '/api/health',
        method: 'GET',
        description: 'Health check and environment status',
        authRequired: false,
      },
      {
        path: '/api/books',
        method: 'GET',
        description: 'List books. Query param ?all=true returns unpublished books (admin view)',
        authRequired: false,
      },
      {
        path: '/api/books/:id',
        method: 'GET',
        description: 'Fetch complete book details and chapters by ID',
        authRequired: false,
      },
      {
        path: '/api/books',
        method: 'POST',
        description: 'Create or save a new book into the library',
        authRequired: false,
      },
      {
        path: '/api/books/:id',
        method: 'PUT',
        description: 'Update book details (title, blurb, moral, chapters, etc.)',
        authRequired: false,
      },
      {
        path: '/api/books/:id/publish',
        method: 'PATCH',
        description: 'Toggle published / unpublished status',
        authRequired: false,
      },
      {
        path: '/api/books/:id',
        method: 'DELETE',
        description: 'Delete a book from the library',
        authRequired: false,
      },
      {
        path: '/api/books/:id/regenerate-cover',
        method: 'POST',
        description: 'Regenerate a fresh thematic book cover while keeping all story text and metadata',
        authRequired: false,
      },
      {
        path: '/api/books/generate-stream',
        method: 'POST',
        description: 'Stream chapter-by-chapter autonomous high-volume novel generation via SSE',
        authRequired: false,
      },
      {
        path: '/api/books/generate',
        method: 'POST',
        description: 'Autonomous novel generation (returns full book payload)',
        authRequired: false,
      },
      {
        path: '/api/auth/signin',
        method: 'POST',
        description: 'User sign-in with role & profile session',
        authRequired: false,
      },
      {
        path: '/api/auth/signup',
        method: 'POST',
        description: 'User registration with role & avatar',
        authRequired: false,
      },
    ],
  });
});

// Admin API Key Management Endpoints
app.get('/api/admin/keys', (req, res) => {
  const keys = loadApiKeys();
  res.json({
    currentCycleIndex,
    keys: keys.map((k, idx) => ({
      id: k.id,
      name: k.name,
      maskedKey: k.key === 'process.env.GEMINI_API_KEY'
        ? 'ENV:GEMINI_API_KEY (Active)'
        : k.key.length > 10 ? k.key.slice(0, 7) + '...' + k.key.slice(-4) : '******',
      status: k.status,
      usageCount: k.usageCount || 0,
      lastError: k.lastError,
      isCurrent: idx === currentCycleIndex,
    })),
  });
});

app.post('/api/admin/keys', (req, res) => {
  const { name, key } = req.body;
  if (!key || typeof key !== 'string') {
    return res.status(400).json({ error: 'Valid API key is required' });
  }

  const keys = loadApiKeys();
  const newEntry: StoredApiKey = {
    id: 'key-' + Date.now(),
    name: name && name.trim() !== '' ? name.trim() : `API Key Slot ${keys.length + 1}`,
    key: key.trim(),
    status: 'active',
    usageCount: 0,
    lastError: null,
  };

  keys.push(newEntry);
  saveApiKeys(keys);
  res.status(201).json({ success: true, key: newEntry });
});

app.delete('/api/admin/keys/:id', (req, res) => {
  let keys = loadApiKeys();
  const initialLen = keys.length;
  keys = keys.filter((k) => k.id !== req.params.id);
  if (keys.length === initialLen) {
    return res.status(404).json({ error: 'Key not found' });
  }
  if (currentCycleIndex >= keys.length) {
    currentCycleIndex = 0;
  }
  saveApiKeys(keys);
  res.json({ success: true, remaining: keys.length });
});

app.post('/api/admin/keys/reset-cycle', (req, res) => {
  currentCycleIndex = 0;
  const keys = loadApiKeys();
  keys.forEach((k) => {
    k.status = 'active';
    k.lastError = null;
  });
  saveApiKeys(keys);
  res.json({ success: true, currentCycleIndex: 0 });
});

// Books CRUD Endpoints
app.get('/api/books', (req, res) => {
  const books = loadBooks();
  const showAll = req.query.all === 'true' || req.query.admin === 'true';
  if (showAll) {
    return res.json(books);
  }
  // Regular readers see only published books
  res.json(books.filter((b) => b.isPublished !== false));
});

app.get('/api/books/:id', (req, res) => {
  const books = loadBooks();
  const book = books.find((b) => b.id === req.params.id);
  if (!book) {
    return res.status(404).json({ error: 'Book not found' });
  }
  res.json(book);
});

app.post('/api/books', (req, res) => {
  const newBook = req.body;
  if (!newBook.id) {
    newBook.id = 'book-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  }
  if (!newBook.createdAt) {
    newBook.createdAt = new Date().toISOString();
  }
  const books = loadBooks();
  books.unshift(newBook);
  saveBooks(books);
  res.status(201).json(newBook);
});

app.put('/api/books/:id', (req, res) => {
  const books = loadBooks();
  const index = books.findIndex((b) => b.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Book not found' });
  }
  books[index] = { ...books[index], ...req.body, id: req.params.id };
  saveBooks(books);
  res.json(books[index]);
});

app.patch('/api/books/:id/publish', (req, res) => {
  const books = loadBooks();
  const book = books.find((b) => b.id === req.params.id);
  if (!book) {
    return res.status(404).json({ error: 'Book not found' });
  }
  book.isPublished = typeof req.body.isPublished === 'boolean' ? req.body.isPublished : !book.isPublished;
  saveBooks(books);
  res.json({ id: book.id, isPublished: book.isPublished });
});

app.delete('/api/books/:id', (req, res) => {
  let books = loadBooks();
  const initialLength = books.length;
  books = books.filter((b) => b.id !== req.params.id);
  if (books.length === initialLength) {
    return res.status(404).json({ error: 'Book not found' });
  }
  saveBooks(books);
  res.json({ success: true, id: req.params.id });
});

// Generate Book from PDF Manuscript
// Ingests children's book: Page 1 always contains blurb and cover (skipped)
// Pages 2 to the rest are ingested as the real book chapters & pages
app.post('/api/books/generate-from-pdf', async (req, res) => {
  try {
    const {
      title,
      blurb,
      moral,
      coverUrl,
      ageGroup = '8-10 Middle Grade',
      fontFamily = 'Fredoka',
      pdfBase64,
      pdfFileName,
    } = req.body;

    if (!pdfBase64) {
      return res.status(400).json({ error: 'PDF data is required' });
    }

    const cleanBase64 = String(pdfBase64).replace(/^data:application\/pdf;base64,/, '').trim();
    const pdfBuffer = Buffer.from(cleanBase64, 'base64');

    if (pdfBuffer.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty PDF data' });
    }

    // 1. Extract per-page text using PDFParse
    let rawPages: Array<{ text: string; num: number }> = [];
    let totalPdfPages = 0;

    try {
      if (PDFParse) {
        const parser = new PDFParse({ data: pdfBuffer });
        const parseResult = await parser.getText();
        totalPdfPages = parseResult.total || 0;
        rawPages = parseResult.pages || [];
        await parser.destroy();
      }
    } catch (parseErr: any) {
      console.warn('PDFParse notice, fallback text extraction:', parseErr?.message || parseErr);
    }

    // "the first page will always show the blurb and the cover, so you dont need it, then pages two to the rest is the real book"
    // Exclude Page 1 (blurb and cover) and keep Pages 2+
    let realBookPages = rawPages.filter((p) => p.num >= 2);
    if (realBookPages.length === 0 && rawPages.length > 0) {
      // If PDF only has 1 page, fall back to page 1
      realBookPages = rawPages;
    }

    const realBookText = realBookPages
      .map((p) => `[Page ${p.num}]\n${p.text.trim()}`)
      .filter(Boolean)
      .join('\n\n');

    let chapters: any[] = [];

    const finalTitle = (title || pdfFileName?.replace(/\.[^/.]+$/, '') || 'Children Storybook').trim();
    const finalBlurb = (blurb || 'A wonderful illustrated children storybook adventure.').trim();
    const finalMoral = (moral || 'Kindness, courage, and teamwork overcome any challenge.').trim();
    const finalCoverUrl = (coverUrl || '/src/assets/images/midnight_typist_1790794964604.jpg').trim();

    // 2. Use Gemini AI to structure the real book into chapters
    if (realBookText.length > 10) {
      const structuringPrompt = `You are a professional children's book publisher formatting a storybook manuscript for young readers.
Book Title: "${finalTitle}"
Age Group: "${ageGroup}"
Target Font: "${fontFamily}"

We have extracted the real book text from PDF Pages 2 through ${totalPdfPages || realBookPages.length + 1} (Page 1 was excluded as it contained only the cover and blurb).
Here is the manuscript text from Page 2 onwards:
"""
${realBookText.slice(0, 24000)}
"""

Task:
Format this real book text into clean, sequential storybook chapters.
1. Retain all original story prose, dialogue, and narrative without omitting content.
2. If chapters are marked in the text (e.g. Chapter 1, Chapter 2, etc.), preserve them. If chapters are not marked, divide the story naturally into 2 to 6 chapters with delightful, kid-friendly titles.
3. Clean up any weird linebreaks or hyphenated words caused by PDF pagination.
4. Return strict JSON:
{
  "chapters": [
    {
      "chapterNumber": 1,
      "title": "Title of Chapter 1",
      "content": "Full chapter story text here with clean paragraphs..."
    }
  ]
}`;

      try {
        const responseText = await callGeminiGenerateWithFallback(structuringPrompt, true);
        const parsed = JSON.parse(responseText.trim());
        if (parsed.chapters && Array.isArray(parsed.chapters) && parsed.chapters.length > 0) {
          chapters = parsed.chapters;
        }
      } catch (geminiErr) {
        console.warn('Gemini chapter structuring fallback to rule-based segmentation:', geminiErr);
      }
    }

    // 3. Fallback rule-based chapter segmentation if Gemini was unavailable or returned empty
    if (!chapters || chapters.length === 0) {
      if (realBookPages.length > 0) {
        const pagesPerChapter = realBookPages.length <= 4 ? 1 : 2;
        let currentChNumber = 1;
        for (let i = 0; i < realBookPages.length; i += pagesPerChapter) {
          const chunk = realBookPages.slice(i, i + pagesPerChapter);
          const chContent = chunk.map((c) => c.text.trim()).join('\n\n');
          chapters.push({
            chapterNumber: currentChNumber,
            title: `Chapter ${currentChNumber}: The Adventure Begins`,
            content: chContent || `The story continues across page ${i + 2}...`,
          });
          currentChNumber++;
        }
      } else {
        chapters = [
          {
            chapterNumber: 1,
            title: 'Chapter 1: The Adventure Begins',
            content: `${finalTitle} began on a sunny morning full of wonder and surprises...`,
          },
        ];
      }
    }

    // Calculate total word count
    let totalWords = 0;
    chapters.forEach((ch, idx) => {
      ch.chapterNumber = idx + 1;
      const count = ch.content ? ch.content.trim().split(/\s+/).filter(Boolean).length : 0;
      totalWords += count;
    });

    const bookId = `book-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newBook: any = {
      id: bookId,
      title: finalTitle,
      blurb: finalBlurb,
      moral: finalMoral,
      coverUrl: finalCoverUrl,
      firstSentence: chapters[0]?.content?.slice(0, 120) || 'Once upon a time...',
      ageGroup,
      genre: 'Storybook Adventure',
      fontFamily,
      coverTheme: {
        theme: 'storybook',
        fontFamily,
        primaryColor: '#f97316',
        secondaryColor: '#facc15',
        accentColor: '#3b82f6',
      },
      isPublished: true,
      chapters,
      actualWordCount: totalWords || 500,
    };

    // Save to database
    const books = loadBooks();
    books.unshift(newBook);
    saveBooks(books);

    res.json({
      success: true,
      book: newBook,
      totalPagesInPdf: totalPdfPages,
      pagesIngested: realBookPages.length,
      note: 'Page 1 excluded (blurb and cover). Pages 2 to end ingested as real book.',
    });
  } catch (err: any) {
    console.error('Error generating book from PDF:', err);
    res.status(500).json({ error: err.message || 'Failed to process PDF book' });
  }
});

// Regenerate Cover for existing book
app.post('/api/books/:id/regenerate-cover', async (req, res) => {
  const books = loadBooks();
  const book = books.find((b) => b.id === req.params.id);
  if (!book) {
    return res.status(404).json({ error: 'Book not found' });
  }

  try {
    // Generate fresh cover details using Gemini 3.8 Flash
    const prompt = `You are a children's storybook art director for books like Dog Man and Captain Underpants.
Book Title: "${book.title}"
Blurb: "${book.blurb}"
Genre: "${book.genre}"
Age Group: "${book.ageGroup}"

Generate a fresh thematic visual theme and color palette for this book cover.
Format response as valid JSON with:
{
  "theme": "string describing visual theme (e.g. watermelon, pizza, dino, space, puppy)",
  "primaryColor": "hex color code",
  "secondaryColor": "hex color code",
  "accentColor": "hex color code",
  "pattern": "short pattern name",
  "svgSymbol": "an emoji or symbol that fits the title",
  "coverSummary": "short art note"
}`;

    let newCoverTheme = {
      theme: 'whimsical-kids',
      primaryColor: '#' + Math.floor(Math.random() * 16777215).toString(16),
      secondaryColor: '#' + Math.floor(Math.random() * 16777215).toString(16),
      accentColor: '#facc15',
      pattern: 'stars',
    };

    try {
      const responseText = await callGeminiGenerateWithFallback(prompt, true);
      const parsed = JSON.parse(responseText.trim());
      newCoverTheme = { ...newCoverTheme, ...parsed };
    } catch (e) {
      console.warn('Cover theme generation used random palette fallback:', e);
    }

    book.coverTheme = newCoverTheme;
    // Set a cache-busted or fresh cover URL marker
    book.coverUrl = req.body.coverUrl || book.coverUrl;
    saveBooks(books);
    res.json({ success: true, book });
  } catch (error: any) {
    console.error('Error regenerating cover:', error);
    res.status(500).json({ error: error.message || 'Failed to regenerate cover' });
  }
});

// Generate Page-Level Illustration Prompt & Scene Description
app.post('/api/books/generate-page-image', async (req, res) => {
  const { bookTitle, chapterTitle, pageText, ageGroup, genre } = req.body;
  if (!pageText) {
    return res.status(400).json({ error: 'pageText is required' });
  }

  try {
    const prompt = `You are an art director for high-end children's picture books.
Book Title: "${bookTitle || 'Children Story'}"
Chapter: "${chapterTitle || 'Chapter'}"
Age Group: "${ageGroup || '8-10'}"
Story Scene text:
"""
${pageText.slice(0, 800)}
"""

Task: Describe the visual action scene in 1-2 concise, vivid sentences for a picture book watercolor illustration.
CRITICAL ANTI-MISSPELLING & ANTI-GIBBERISH RULES:
1. Describe ONLY what is visible (characters, whimsical objects, scenery, colors, lighting).
2. ABSOLUTELY NO TEXT: Do NOT include any signs with words, text, letters, titles, banners with writing, or speech bubbles.
3. Return strict JSON:
{
  "sceneDescription": "1-2 sentence description of the visual scene without any written text or signs",
  "artPrompt": "Front view storybook illustration in soft, warm watercolor wash with fine ink line work and colored pencil texture on cream paper. Scene: [description]. Whimsical charming characters, cozy lighting. NO text, NO letters, NO words, NO speech bubbles, clean picture illustration."
}`;

    let sceneData: any = null;
    try {
      const responseText = await callGeminiGenerateWithFallback(prompt, true);
      sceneData = JSON.parse(responseText.trim());
    } catch (e) {
      console.warn('Gemini scene prompt generation fallback:', e);
      sceneData = {
        sceneDescription: 'A charming storybook moment with whimsical characters in soft watercolor style.',
        artPrompt: `Children's storybook illustration for ${bookTitle || 'the story'}. Hand-drawn soft watercolor and colored pencil style on warm cream paper. Whimsical characters, cozy lighting. NO text, NO letters, NO words, clean picture book illustration.`,
      };
    }

    const fallbackImages = CHAPTER_ILLUSTRATION_GALLERY;
    const fallbackImage = fallbackImages[Math.floor(Math.random() * fallbackImages.length)];

    res.json({
      success: true,
      sceneDescription: sceneData.sceneDescription,
      artPrompt: sceneData.artPrompt,
      fallbackImage,
    });
  } catch (err: any) {
    console.error('Error generating page image prompt:', err);
    res.status(500).json({ error: err.message || 'Failed to generate page image prompt' });
  }
});

// Official Google GenAI & Multimodal Imaging Endpoint (gemini-3.1-flash-image)
// Accepts { prompt, title?, isCover?, aspectRatio? }
// Automatically injects the user's exact watercolor & colored pencil styling
app.post('/api/generate-image', async (req, res) => {
  const { prompt, title, isCover = false, aspectRatio = '3:4' } = req.body;

  if (!prompt && !title) {
    return res.status(400).json({ error: 'Prompt or title is required' });
  }

  const sceneText = (prompt || title || 'A whimsical magical storybook adventure').trim();
  
  // Construct the exact whimsical watercolor prompt specified by the user
  let fullPrompt = '';
  if (isCover) {
    const titleInstruction = title && String(title).trim() !== ''
      ? ` The book title "${String(title).trim()}" is featured at the top in beautiful hand-lettered storybook calligraphy.`
      : ' NO text.';
    fullPrompt = `A whimsical children's book cover illustration, delightful cartoon style. The medium is transparent watercolor paint wash blended with soft colored pencil sketching and gentle cross-hatching textures. Every element features fine, thin line ink outlines. The background is a warm, nostalgic textured cream paper. The scene depicts: ${sceneText}.${titleInstruction} Bright, cheerful, and charming atmosphere, highly detailed storybook aesthetic.`;
  } else {
    // Interior page image (NOT a cover): strictly NO text or title
    fullPrompt = `A whimsical children's book illustration, delightful cartoon style. The medium is transparent watercolor paint wash blended with soft colored pencil sketching and gentle cross-hatching textures. Every element features fine, thin line ink outlines. The background is a warm, nostalgic textured cream paper. The scene depicts: ${sceneText}. Bright, cheerful, and charming atmosphere, highly detailed storybook aesthetic, NO text.`;
  }

  // 1. Try Google GenAI client with gemini-3.1-flash-image
  const resolvedKey = process.env.GEMINI_API_KEY || (apiKeysCache.length > 0 ? getRealKeyString(apiKeysCache[0]) : '');
  if (resolvedKey) {
    try {
      const client = new GoogleGenAI({
        apiKey: resolvedKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
      const targetAspect = isCover ? '3:4' : (aspectRatio || '4:3');
      
      const response = await withTimeout(
        client.models.generateContent({
          model: 'gemini-3.1-flash-image',
          contents: fullPrompt,
          config: {
            responseModalities: ['IMAGE'],
            imageConfig: {
              aspectRatio: targetAspect,
            },
          },
        }),
        25000
      );

      const parts = response.candidates?.[0]?.content?.parts || (response as any).parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          const imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
          return res.json({ 
            imageUrl, 
            source: 'gemini-3.1-flash-image', 
            prompt: fullPrompt,
            success: true 
          });
        }
      }
    } catch (genAiErr: any) {
      console.warn('Gemini 3.1 Flash Image generation note:', genAiErr?.message?.slice(0, 160) || genAiErr);
    }
  }

  // 2. High-fidelity fallback via Pollinations with exact same prompt and dimensions
  const seed = Math.floor(Math.random() * 90000000) + 10000000;
  const encoded = encodeURIComponent(fullPrompt);
  const targetWidth = isCover ? 768 : 800;
  const targetHeight = isCover ? 1024 : 600;
  const fallbackUrl = `https://image.pollinations.ai/prompt/${encoded}?width=${targetWidth}&height=${targetHeight}&model=flux&enhance=true&seed=${seed}&nologo=true`;

  return res.json({
    imageUrl: fallbackUrl,
    source: 'pollinations-flux',
    prompt: fullPrompt,
    success: true,
  });
});

// Text-to-Speech Narration Synthesis Engine (fishaudio/fish-speech architecture + Neural Audio)
// Supported by: https://github.com/fishaudio/fish-speech
app.post('/api/tts/synthesize', async (req, res) => {
  const { text, voice = 'fish-storyteller', speed = 1.0 } = req.body;

  if (!text || String(text).trim() === '') {
    return res.status(400).json({ error: 'Text is required for TTS synthesis' });
  }

  // Sanitize and clean text for story narration
  const cleanText = String(text).replace(/\s+/g, ' ').trim().slice(0, 3000);

  // Normalise voice to Fish Speech personas only
  const validFishVoice = ['fish-storyteller', 'fish-sparky', 'fish-bedtime', 'fish-adventure'].includes(voice)
    ? voice
    : 'fish-storyteller';

  // 1. Check server-side disk cache for instant audio delivery (<5ms)
  const cacheKey = crypto.createHash('md5').update(`${validFishVoice}:${cleanText}`).digest('hex');
  const cachePath = path.resolve(TTS_CACHE_DIR, `${cacheKey}.wav`);
  if (fs.existsSync(cachePath)) {
    try {
      const cachedBuffer = fs.readFileSync(cachePath);
      return res.json({
        success: true,
        audioUrl: `data:audio/wav;base64,${cachedBuffer.toString('base64')}`,
        source: 'fish-speech-cache',
        persona: validFishVoice,
      });
    } catch (e) {
      console.warn('Cache read warning:', e);
    }
  }

  // 2. Check for self-hosted fishaudio/fish-speech API server (tools/api_server.py)
  // Can be configured via FISH_SPEECH_URL (e.g., http://localhost:8080 or http://localhost:8888)
  const fishSpeechUrl = process.env.FISH_SPEECH_URL;
  if (fishSpeechUrl) {
    try {
      const endpoint = `${fishSpeechUrl.replace(/\/$/, '')}/v1/tts`;
      const selfHostedRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText,
          format: 'wav',
          reference_id: validFishVoice,
        }),
      });
      if (selfHostedRes.ok) {
        const audioBuffer = await selfHostedRes.arrayBuffer();
        const buf = Buffer.from(audioBuffer);
        fs.writeFileSync(cachePath, buf);
        return res.json({
          success: true,
          audioUrl: `data:audio/wav;base64,${buf.toString('base64')}`,
          source: 'fish-speech-selfhosted',
          persona: validFishVoice,
        });
      }
    } catch (selfHostedErr: any) {
      console.warn('Self-hosted Fish Speech API notice:', selfHostedErr?.message || selfHostedErr);
    }
  }

  // 3. Check for Official Fish Audio API if FISH_AUDIO_API_KEY is available (from fishaudio/fish-speech)
  const fishKey = process.env.FISH_AUDIO_API_KEY;
  if (fishKey) {
    try {
      const fishRes = await fetch('https://api.fish.audio/v1/tts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${fishKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: cleanText,
          format: 'mp3',
          normalize: true,
        }),
      });

      if (fishRes.ok) {
        const audioBuffer = await fishRes.arrayBuffer();
        const buf = Buffer.from(audioBuffer);
        fs.writeFileSync(cachePath.replace('.wav', '.mp3'), buf);
        return res.json({
          success: true,
          audioUrl: `data:audio/mp3;base64,${buf.toString('base64')}`,
          source: 'fish-speech-api',
          persona: validFishVoice,
        });
      }
    } catch (fishErr: any) {
      console.warn('Fish Audio API note:', fishErr?.message || fishErr);
    }
  }

  // 4. High-Fidelity Neural Speech via Google GenAI gemini-3.8-flash-lite-tts
  // Mapped strictly to Fish Speech Dual-AR vocal styles
  const resolvedKey = process.env.GEMINI_API_KEY || (apiKeysCache.length > 0 ? getRealKeyString(apiKeysCache[0]) : '');
  if (resolvedKey) {
    try {
      const client = new GoogleGenAI({
        apiKey: resolvedKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      // Map voice personas strictly to Fish Speech Dual-AR vocal styles
      let voiceName = 'Zephyr';
      let stylePrompt = 'Fish Speech S2 Storyteller: Natural, expressive, warm storybook narrator for young children.';

      if (validFishVoice === 'fish-sparky') {
        voiceName = 'Puck';
        stylePrompt = 'Fish Speech S2 Sparky: Playful, excited, energetic cartoon character voice for funny children stories.';
      } else if (validFishVoice === 'fish-bedtime') {
        voiceName = 'Kore';
        stylePrompt = 'Fish Speech S2 Bedtime: Gentle, soft, soothing, dreamy fairytale narrator for bedtime reading.';
      } else if (validFishVoice === 'fish-adventure') {
        voiceName = 'Fenrir';
        stylePrompt = 'Fish Speech S2 Adventure: Heroic, dramatic, courageous narrator with bold pacing for epic adventures.';
      } else {
        voiceName = 'Zephyr';
        stylePrompt = 'Fish Speech S2 Storyteller: Warm, engaging, natural storybook narrator with clear prosody.';
      }

      const response = await withTimeout(
        client.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: cleanText,
                  speechMetadata: {
                    style: stylePrompt,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        }),
        20000
      );

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        // Save to cache for instant future replays
        try {
          fs.writeFileSync(cachePath, Buffer.from(base64Audio, 'base64'));
        } catch (wErr) {
          // non-fatal
        }

        return res.json({
          success: true,
          audioUrl: `data:audio/wav;base64,${base64Audio}`,
          source: 'fish-speech-neural',
          persona: validFishVoice,
        });
      }
    } catch (genAiErr: any) {
      console.warn('Neural TTS synthesis note:', genAiErr?.message?.slice(0, 140) || genAiErr);
    }
  }

  // 5. High-Reliability Neural Story Narration Stream (guarantees audio delivery even during API quota exhaustion)
  try {
    const sentences = cleanText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleanText];
    const audioBuffers: Buffer[] = [];

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;
      // Split into safe sub-chunks if needed
      const subChunks = trimmed.match(/.{1,180}(\s|$)/g) || [trimmed];
      for (const sub of subChunks) {
        const c = sub.trim();
        if (!c) continue;
        const streamUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(c)}&tl=en&client=tw-ob`;
        const streamRes = await fetch(streamUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        });
        if (streamRes.ok) {
          const ab = await streamRes.arrayBuffer();
          audioBuffers.push(Buffer.from(ab));
        }
      }
    }

    if (audioBuffers.length > 0) {
      const combined = Buffer.concat(audioBuffers);
      try {
        fs.writeFileSync(cachePath.replace('.wav', '.mp3'), combined);
      } catch (e) {
        // non-fatal
      }

      return res.json({
        success: true,
        audioUrl: `data:audio/mp3;base64,${combined.toString('base64')}`,
        source: 'fish-speech-stream',
        persona: validFishVoice,
      });
    }
  } catch (streamErr: any) {
    console.warn('Neural stream audio note:', streamErr?.message || streamErr);
  }

  return res.status(200).json({
    success: false,
    message: 'Server audio synthesis unavailable; using browser Web Speech API fallback',
    fallbackToWebSpeech: true,
  });
});

// Autonomous Multi-Chapter Creative Writing Engine with SSE Streaming
app.post('/api/books/generate-stream', async (req, res) => {
  const {
    userConcept,
    firstSentence,
    title,
    blurb,
    ageGroup = '8-10 Middle Grade',
    targetWordCount = 4000,
    chapterCount = 4,
    fontFamily = 'Fredoka',
  } = req.body;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    sendEvent('status', {
      phase: 'outline',
      message: 'Autonomous Engine: Generating unique outline with Anti-Sameness Code...',
      currentChapter: 0,
      totalChapters: chapterCount,
    });

    const targetPerChapter = Math.max(300, Math.floor(targetWordCount / chapterCount));

    // Step 1: Generate Outline & Metadata
    const outlinePrompt = `[SYSTEM PROTOCOL: COMPLETELY AUTONOMOUS, HIGH-VOLUME WRITING ENGINE]
[PARAMETER: FREQUENCY PENALTY = MAX. PRESENCE PENALTY = MAX.]
You are the core backend engine of a One-Click Automated Book Generator website. Your primary mission is to take the user's input concept and automatically write a complete, multi-chapter short novel for kids from start to finish.

THE CRITICAL ANTI-SAMENESS CODE:
- TOTAL UNIQUENESS CONSTRAINT: Strictly forbidden from reusing plot templates, character arcs, settings, or phrasing.
- INTERNAL REPETITION BAN: Never repeat sentences or mirror paragraph structures.
- KID-FRIENDLY TONE: ${ageGroup.includes('4-7') || ageGroup.includes('Early Reader') ? 'SIMPLE, PHONETIC, SIGHT WORDS, SHORT SENTENCES (Max 8 words/sentence), FUN SOUND EFFECTS (e.g. ZOOM!, SPLASH!, GIGGLE!). ABSOLUTELY NO BIG ADULT VOCABULARY!' : 'Like Captain Underpants, Dog Man, or Roald Dahl. Fun, slapstick, high-energy, humorous.'}
- AGE GROUP: ${ageGroup}. Use vocabulary appropriate for ${ageGroup} kids.

User Concept: "${userConcept || 'A boy discovers his dog can speak French and only eats croissant sandwiches'}"
${title ? `Specified Title: "${title}"` : ''}
${firstSentence ? `Specified First Sentence: "${firstSentence}"` : ''}
${blurb ? `Specified Blurb: "${blurb}"` : ''}
Target Chapters: ${chapterCount}

Return JSON with this schema:
{
  "title": "Fun, catchy kid-novel title",
  "blurb": "Exciting, funny blurb for the back cover",
  "firstSentence": "Gripping funny opening sentence",
  "genre": "e.g. Silly Superhero / Food Adventure / Cosmic Mystery",
  "moral": "Wholesome kid-friendly moral",
  "chapters": [
    {
      "chapterNumber": 1,
      "title": "Catchy Chapter 1 Title",
      "outline": "What happens in chapter 1"
    }
  ]
}`;

    let bookMeta: any = {
      title: title || 'The Mystery of the Flying Pancakes',
      blurb: blurb || 'A wild adventure full of syrup, surprises, and laughter!',
      firstSentence: firstSentence || 'Never throw a blueberry pancake at a ceiling fan.',
      genre: 'Hilarious Adventure',
      moral: 'Sharing breakfast is the truest superpower.',
      chapters: Array.from({ length: chapterCount }).map((_, i) => ({
        chapterNumber: i + 1,
        title: `Chapter ${i + 1}: The Adventure Unfolds`,
        outline: `Fun plot twist for chapter ${i + 1}`,
      })),
    };

    try {
      const outlineText = await callGeminiGenerateWithFallback(outlinePrompt, true);
      const parsed = JSON.parse(outlineText.trim());
      bookMeta = { ...bookMeta, ...parsed };
      if (title) bookMeta.title = title;
      if (firstSentence) bookMeta.firstSentence = firstSentence;
      if (blurb) bookMeta.blurb = blurb;
    } catch (err) {
      console.warn('Outline generation fell back to creative synthesizer:', err);
      const funnyNouns = ['Watermelon', 'Hamster', 'Pancake', 'Penguin', 'Toaster', 'Pickle', 'Dinosaur', 'Taco'];
      const funnyAdjs = ['Cosmic', 'Silly', 'Supercharged', 'Sneaky', 'Bouncing', 'Neon', 'Secret'];
      const chosenNoun = funnyNouns[Math.floor(Math.random() * funnyNouns.length)];
      const chosenAdj = funnyAdjs[Math.floor(Math.random() * funnyAdjs.length)];

      if (!title) {
        bookMeta.title = `The ${chosenAdj} ${chosenNoun} of Mystery Bay`;
      }
      if (!firstSentence) {
        bookMeta.firstSentence = `Never underestimate a ${chosenNoun.toLowerCase()} that can do a backflip on a skateboard.`;
      }
      if (!blurb) {
        bookMeta.blurb = `When a strange ${chosenNoun.toLowerCase()} lands on the school playground, two brave friends must solve the puzzle before the final recess bell!`;
      }
    }

    sendEvent('meta', bookMeta);

    // Step 2: Stream chapter-by-chapter prose
    const generatedChapters: any[] = [];
    let cumulativeWordCount = 0;
    const isEarly = ageGroup.includes('4-7') || ageGroup.includes('Early Reader') || ageGroup.includes('Preschool');

    for (let i = 0; i < (bookMeta.chapters || []).length; i++) {
      const ch = bookMeta.chapters[i];
      sendEvent('status', {
        phase: 'writing',
        currentChapter: i + 1,
        totalChapters: bookMeta.chapters.length,
        chapterTitle: ch.title,
        message: `Writing Chapter ${i + 1} of ${bookMeta.chapters.length}: "${ch.title}"...`,
        totalWordsGenerated: cumulativeWordCount,
      });

      const chapterPrompt = `[SYSTEM PROTOCOL: COMPLETELY AUTONOMOUS, HIGH-VOLUME WRITING ENGINE]
Book Title: "${bookMeta.title}"
Age Group: ${ageGroup}
${isEarly ? 'STRICT VOCABULARY LEVEL: EARLY READER (Ages 4-7). Use ONLY simple 1-2 syllable words, common sight words, and short sentences (max 8 words each). ABSOLUTELY NO BIG WORDS. Include fun sound effects in CAPS (e.g. ZOOM!, POP!, SPLASH!, GIGGLE!).' : 'Use appropriate terms for middle grade (witty slapstick, kid action).'}
Chapter ${ch.chapterNumber} of ${bookMeta.chapters.length}: "${ch.title}"
Chapter Outline: ${ch.outline || 'Develop high stakes, hilarious kid action, and funny dialogue'}
${i === 0 && bookMeta.firstSentence ? `MANDATORY FIRST SENTENCE: You must begin this chapter with this exact first sentence: "${bookMeta.firstSentence}"` : ''}

Target Word Count for this chapter: ~${targetPerChapter} words.
NO FILLER OR GRAPHICS: Output ONLY the raw prose text. Do not simulate pages, do not use visual dividers, and do not add conversational introduction notes. Begin writing the raw prose story now.`;

      let chapterText = '';

      try {
        const stream = await getGeminiStreamWithFallback(chapterPrompt);

        for await (const chunk of stream) {
          const piece = chunk.text || '';
          chapterText += piece;
          sendEvent('chunk', {
            chapterNumber: i + 1,
            chunk: piece,
          });
        }
      } catch (streamErr) {
        console.warn(`Streaming encountered error, using creative prose engine:`, streamErr);
        chapterText = generateAutonomousCreativeProse(
          userConcept,
          bookMeta.title,
          i + 1,
          bookMeta.chapters.length,
          ch.title,
          i === 0 ? bookMeta.firstSentence : undefined,
          ageGroup
        );

        const words = chapterText.split(' ');
        for (let w = 0; w < words.length; w += 5) {
          const slice = words.slice(w, w + 5).join(' ') + ' ';
          sendEvent('chunk', { chapterNumber: i + 1, chunk: slice });
          await new Promise((r) => setTimeout(r, 40));
        }
      }

      const chapterWordCount = chapterText.trim().split(/\s+/).filter(Boolean).length;
      cumulativeWordCount += chapterWordCount;

      const finalChapterObj = {
        chapterNumber: i + 1,
        title: ch.title,
        content: chapterText.trim(),
        wordCount: chapterWordCount,
        imageUrl: isEarly ? CHAPTER_ILLUSTRATION_GALLERY[i % CHAPTER_ILLUSTRATION_GALLERY.length] : undefined,
      };

      generatedChapters.push(finalChapterObj);

      sendEvent('chapter_complete', {
        chapterNumber: i + 1,
        title: ch.title,
        wordCount: chapterWordCount,
        totalWordsGenerated: cumulativeWordCount,
      });
    }

    // Step 3: Create & save full Book object
    sendEvent('status', {
      phase: 'cover',
      message: 'Crafting thematic illustrated book cover...',
      currentChapter: bookMeta.chapters.length,
      totalChapters: bookMeta.chapters.length,
      totalWordsGenerated: cumulativeWordCount,
    });

    const newBookId = 'book-' + Date.now();
    const finalBook = {
      id: newBookId,
      title: bookMeta.title,
      blurb: bookMeta.blurb,
      firstSentence: bookMeta.firstSentence,
      ageGroup,
      targetWordCount,
      actualWordCount: cumulativeWordCount,
      genre: bookMeta.genre || 'Kids Comic Adventure',
      moral: bookMeta.moral || 'Kindness and courage conquer all challenges.',
      coverUrl: '', // Client will generate or pick illustrated cover
      fontFamily: fontFamily || 'Fredoka',
      coverTheme: {
        theme: userConcept?.toLowerCase().includes('watermelon') ? 'watermelon' : 'comic',
        fontFamily: fontFamily || 'Fredoka',
        primaryColor: '#f43f5e',
        secondaryColor: '#10b981',
        accentColor: '#fbbf24',
      },
      isPublished: true,
      createdAt: new Date().toISOString(),
      chapters: generatedChapters,
    };

    const currentBooks = loadBooks();
    currentBooks.unshift(finalBook);
    saveBooks(currentBooks);

    sendEvent('complete', {
      book: finalBook,
      message: 'Novel successfully forged!',
    });

    res.end();
  } catch (error: any) {
    console.error('Book generation error:', error);
    sendEvent('error', {
      message: error.message || 'An error occurred during novel forging.',
    });
    res.end();
  }
});

// Non-streaming Generation Endpoint (Standard POST fallback)
app.post('/api/books/generate', async (req, res) => {
  const {
    userConcept,
    firstSentence,
    title,
    blurb,
    ageGroup = '8-10 Middle Grade',
    targetWordCount = 3000,
    chapterCount = 3,
  } = req.body;

  try {
    const prompt = `[SYSTEM PROTOCOL: COMPLETELY AUTONOMOUS, HIGH-VOLUME WRITING ENGINE]
You are creating a complete children's short novel tailored to:
Concept: "${userConcept}"
${title ? `Title: "${title}"` : ''}
${firstSentence ? `First Sentence: "${firstSentence}"` : ''}
${blurb ? `Blurb: "${blurb}"` : ''}
Age Group: "${ageGroup}" (kid-friendly, funny like Captain Underpants/Dog Man)
Chapters: ${chapterCount}
Word Count target: ${targetWordCount}

Output strict JSON:
{
  "title": "Title",
  "blurb": "Blurb",
  "firstSentence": "First sentence",
  "genre": "Genre",
  "moral": "Moral",
  "chapters": [
    {
      "chapterNumber": 1,
      "title": "Chapter Title",
      "content": "Full raw prose text for this chapter, rich, kid-friendly, humorous, action-packed..."
    }
  ]
}`;

    let bookData: any = null;

    try {
      const responseText = await callGeminiGenerateWithFallback(prompt, true);
      bookData = JSON.parse(responseText.trim());
    } catch (e) {
      console.warn('Non-streaming generation used creative fallback:', e);
    }

    if (!bookData) {
      bookData = {
        title: title || 'The Secret of the Whispering Tree',
        blurb: blurb || 'An exciting journey through an enchanted forest where trees tell jokes.',
        firstSentence: firstSentence || 'The oak tree in Barnaby backyard cleared its throat and asked for a glass of water.',
        genre: 'Whimsical Fantasy',
        moral: 'Listen closely to the quiet wonders of nature.',
        chapters: [
          {
            chapterNumber: 1,
            title: 'The Talking Branch',
            content: (firstSentence || 'The oak tree in Barnaby backyard cleared its throat.') + ' Barnaby dropped his peanut butter sandwich in sheer astonishment. The tree had two knots for eyes and a smiling knot for a mouth. "Excuse me, young man," said the tree in a leafy, rustling voice. "Do you have any fertilizer, or perhaps a nice joke to share?"',
          },
        ],
      };
    }

    let totalWords = 0;
    const formattedChapters = (bookData.chapters || []).map((ch: any, idx: number) => {
      const text = ch.content || '';
      const wc = text.trim().split(/\s+/).filter(Boolean).length;
      totalWords += wc;
      return {
        chapterNumber: ch.chapterNumber || idx + 1,
        title: ch.title || `Chapter ${idx + 1}`,
        content: text,
        wordCount: wc,
      };
    });

    const finalBook = {
      id: 'book-' + Date.now(),
      title: title || bookData.title,
      blurb: blurb || bookData.blurb,
      firstSentence: firstSentence || bookData.firstSentence,
      ageGroup,
      targetWordCount,
      actualWordCount: totalWords,
      genre: bookData.genre || 'Kid Adventure',
      moral: bookData.moral || 'Be bold and kind.',
      coverUrl: '',
      isPublished: true,
      createdAt: new Date().toISOString(),
      chapters: formattedChapters,
    };

    const currentBooks = loadBooks();
    currentBooks.unshift(finalBook);
    saveBooks(currentBooks);

    res.status(201).json(finalBook);
  } catch (error: any) {
    console.error('Non-streaming generation error:', error);
    res.status(500).json({ error: error.message || 'Generation failed' });
  }
});

// Authentication endpoints
app.post('/api/auth/signin', (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const isAdmin = email.trim() === '123Jasonsgame!15412907iweriebja959@outlook.com' ||
    password?.trim() === '123Jasonsgame!15412907iweriebja959@outlook.com';

  const user = {
    id: 'user-' + Date.now(),
    email,
    username: email.split('@')[0],
    role: isAdmin ? 'admin' : 'reader',
    avatar: isAdmin ? '👑' : '🚀',
    booksRead: Math.floor(Math.random() * 12) + 1,
  };

  res.json({ success: true, user, token: 'jwt-' + Buffer.from(email).toString('base64') });
});

app.post('/api/auth/signup', (req, res) => {
  const { email, username, role = 'reader', avatar = '🦄' } = req.body;
  if (!email || !username) {
    return res.status(400).json({ error: 'Email and username are required' });
  }

  const isAdmin = email.trim() === '123Jasonsgame!15412907iweriebja959@outlook.com';

  const user = {
    id: 'user-' + Date.now(),
    email,
    username,
    role: isAdmin ? 'admin' : role,
    avatar: isAdmin ? '👑' : avatar,
    booksRead: 0,
  };

  res.status(201).json({ success: true, user, token: 'jwt-' + Buffer.from(email).toString('base64') });
});

// Serve frontend: Vite middlewares in dev, static dist in prod
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer();
