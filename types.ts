export interface Chapter {
  chapterNumber: number;
  title: string;
  content: string; // raw prose text
  wordCount: number;
  summary?: string;
  imageUrl?: string; // Storybook illustration for opening page
  pageImages?: Record<number, string>; // Map of pageNumber (1-based index) to image URL for each page of the chapter
}

export interface CoverTheme {
  theme: string;
  fontFamily?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  pattern?: string;
}

export interface Book {
  id: string;
  title: string;
  blurb: string;
  firstSentence: string;
  ageGroup: string; // e.g. "4-7 Early Reader", "8-10 Middle Grade", "11-13 Chapter Book"
  targetWordCount: number;
  actualWordCount: number;
  genre: string;
  moral: string;
  coverUrl: string;
  coverTheme?: CoverTheme;
  fontFamily?: string; // Custom word font for the book
  characterProfile?: string; // Consistent protagonist appearance (hair, clothes, colors) across cover and all pages
  pageCount?: number; // Total number of pages in the book
  wordsPerPage?: number; // Target words per page
  isPublished: boolean;
  createdAt: string;
  chapters: Chapter[];
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'reader' | 'author' | 'admin';
  avatar: string;
  booksRead: number;
}

export interface GenerateNovelInput {
  userConcept: string;
  firstSentence?: string;
  title?: string;
  blurb?: string;
  ageGroup: string;
  targetWordCount: number;
  chapterCount?: number;
  pageCount?: number;
  wordsPerPage?: number;
  fontFamily?: string;
}

export interface AdminApiKey {
  id: string;
  name: string;
  maskedKey: string;
  status: 'active' | 'cooldown' | 'exhausted';
  usageCount: number;
  lastError: string | null;
  isCurrent: boolean;
}

export interface GenerationStatus {
  phase: 'idle' | 'outline' | 'writing' | 'cover' | 'complete' | 'error';
  totalChapters: number;
  currentChapter: number;
  currentChapterTitle: string;
  totalWordsGenerated: number;
  targetWords: number;
  currentStreamChunk: string;
  error?: string;
}
