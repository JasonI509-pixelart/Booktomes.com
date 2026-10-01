// Advanced Storybook Narration Engine powered by fishaudio/fish-speech
// Repository: https://github.com/fishaudio/fish-speech
// Features dual-engine architecture:
// 1. Primary: High-fidelity audio synthesis via Fish Audio S2 & Neural Storybook Voice models
// 2. Secondary: Instant browser Web Speech API fallback for zero-latency offline narration
// 3. Web Audio API Context pre-unlocking on user gesture to prevent browser autoplay blocking

export type VoicePersona = 
  | 'fish-storyteller'
  | 'fish-sparky'
  | 'fish-bedtime'
  | 'fish-adventure';

export interface VoiceProfile {
  id: VoicePersona;
  name: string;
  repoName: string;
  repoUrl: string;
  tagline: string;
  badgeColor: string;
  description: string;
  pitch: number;
  rate: number;
  voiceGenderPreference: 'female' | 'male' | 'child' | 'neutral';
}

export const VOICE_PROFILES: Record<VoicePersona, VoiceProfile> = {
  'fish-storyteller': {
    id: 'fish-storyteller',
    name: 'Fish Speech - Storyteller',
    repoName: 'fishaudio/fish-speech',
    repoUrl: 'https://github.com/fishaudio/fish-speech',
    tagline: 'Natural & Expressive',
    badgeColor: 'bg-emerald-600 text-emerald-50 border-emerald-400',
    description: 'Fish Audio S2 neural voice model. Warm, engaging, and beautifully paced storybook narrator.',
    pitch: 1.0,
    rate: 0.95,
    voiceGenderPreference: 'neutral',
  },
  'fish-sparky': {
    id: 'fish-sparky',
    name: 'Fish Speech - Sparky',
    repoName: 'fishaudio/fish-speech',
    repoUrl: 'https://github.com/fishaudio/fish-speech',
    tagline: 'Playful & Animated',
    badgeColor: 'bg-amber-500 text-stone-950 border-amber-300',
    description: 'High-energy, whimsical cartoon character voice for funny dialogue and energetic scenes.',
    pitch: 1.25,
    rate: 1.02,
    voiceGenderPreference: 'child',
  },
  'fish-bedtime': {
    id: 'fish-bedtime',
    name: 'Fish Speech - Bedtime',
    repoName: 'fishaudio/fish-speech',
    repoUrl: 'https://github.com/fishaudio/fish-speech',
    tagline: 'Soothing Fairytale',
    badgeColor: 'bg-indigo-600 text-indigo-50 border-indigo-400',
    description: 'Calm, gentle, and dreamy cadence ideal for bedtime stories and magical fables.',
    pitch: 0.92,
    rate: 0.88,
    voiceGenderPreference: 'female',
  },
  'fish-adventure': {
    id: 'fish-adventure',
    name: 'Fish Speech - Adventure',
    repoName: 'fishaudio/fish-speech',
    repoUrl: 'https://github.com/fishaudio/fish-speech',
    tagline: 'Cinematic Hero',
    badgeColor: 'bg-rose-600 text-rose-50 border-rose-400',
    description: 'Deep, resonant, and dramatic narration with bold pacing for epic quests and superhero tales.',
    pitch: 0.98,
    rate: 1.0,
    voiceGenderPreference: 'male',
  },
};

export interface SpeakOptions {
  onStart?: () => void;
  onEnd?: () => void;
  onBoundary?: (charIndex: number, charLength?: number) => void;
  onError?: (err: any) => void;
  onLoading?: () => void;
}

class TTSEngine {
  // Web Audio Context for zero-latency autoplay-safe playback
  private audioCtx: AudioContext | null = null;
  private currentSourceNode: AudioBufferSourceNode | null = null;
  private unlockedAudio: HTMLAudioElement | null = null;

  // Audio playback state
  private activeAudio: HTMLAudioElement | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isSpeakingState = false;
  private isPausedState = false;
  private isLoadingAudioState = false;
  private currentAudioSource: 'fish-speech' | 'neural' | 'browser' | null = null;
  private activeAbortController: AbortController | null = null;

  // In-memory cache for synthesized audio to ensure instant replay
  private audioCache = new Map<string, string>();
  private keepAliveInterval: any = null;
  private voicesCache: SpeechSynthesisVoice[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.loadVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        this.loadVoices();
      };
    }
  }

  // Pre-unlocks Web Audio Context and HTML5 Audio on user interaction gesture (e.g. click)
  // This completely eliminates "Autoplay prevented" errors in Chrome, Safari, and Firefox
  public unlockAudio(): void {
    try {
      if (typeof window === 'undefined') return;

      // 1. Initialize & resume Web Audio API AudioContext
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }

      // 2. Pre-unlock HTMLAudioElement with silent 1-sample WAV
      if (!this.unlockedAudio) {
        this.unlockedAudio = new Audio();
      }
      this.unlockedAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
      this.unlockedAudio.play().then(() => {
        this.unlockedAudio?.pause();
      }).catch(() => {});

      // 3. Unfreeze browser SpeechSynthesis if paused
      if ('speechSynthesis' in window) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      }
    } catch (e) {
      console.warn('AudioContext pre-unlock notice:', e);
    }
  }

  private loadVoices(): SpeechSynthesisVoice[] {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return [];
    }
    this.voicesCache = window.speechSynthesis.getVoices();
    return this.voicesCache;
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (this.voicesCache.length === 0) {
      this.loadVoices();
    }
    return this.voicesCache;
  }

  private pickBestVoice(profile: VoiceProfile): SpeechSynthesisVoice | null {
    const voices = this.getAvailableVoices();
    if (!voices || voices.length === 0) return null;

    const englishVoices = voices.filter((v) => v.lang.startsWith('en'));
    const pool = englishVoices.length > 0 ? englishVoices : voices;

    if (profile.id.includes('sparky')) {
      const preferred = pool.find((v) =>
        /samantha|karen|victoria|zoe|child|girl|young|google us english|zira/i.test(v.name)
      );
      if (preferred) return preferred;
    } else if (profile.id.includes('bedtime')) {
      const preferred = pool.find((v) =>
        /serena|moira|daniel|fiona|natural|audiobook|george|hazel/i.test(v.name)
      );
      if (preferred) return preferred;
    } else if (profile.id.includes('adventure')) {
      const preferred = pool.find((v) =>
        /alex|oliver|arthur|fred|david|expressive|enhanced/i.test(v.name)
      );
      if (preferred) return preferred;
    }

    return pool[0] || null;
  }

  // Synthesize and play audio with Fish Speech architecture + Web Speech fallback
  public async speak(
    text: string,
    persona: VoicePersona = 'fish-storyteller',
    speedMultiplier = 1.0,
    options?: SpeakOptions
  ): Promise<void> {
    this.stop();
    this.unlockAudio();

    if (!text || text.trim() === '') {
      options?.onEnd?.();
      return;
    }

    const cleanText = text.trim();
    const cacheKey = `${persona}_${cleanText}`;

    // 1. Check in-memory audio cache
    if (this.audioCache.has(cacheKey)) {
      const cachedUrl = this.audioCache.get(cacheKey)!;
      await this.playAudioFromUrl(cachedUrl, speedMultiplier, options, 'fish-speech');
      return;
    }

    // 2. Request synthesis from server (/api/tts/synthesize)
    this.isLoadingAudioState = true;
    options?.onLoading?.();

    try {
      this.activeAbortController = new AbortController();
      const timeoutId = setTimeout(() => this.activeAbortController?.abort(), 25000);

      const res = await fetch('/api/tts/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText,
          voice: persona,
          speed: speedMultiplier,
        }),
        signal: this.activeAbortController.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.audioUrl) {
          this.isLoadingAudioState = false;
          this.audioCache.set(cacheKey, data.audioUrl);
          await this.playAudioFromUrl(
            data.audioUrl,
            speedMultiplier,
            options,
            data.source?.startsWith('fish-speech') ? 'fish-speech' : 'neural'
          );
          return;
        }
      }
    } catch (err: any) {
      console.warn('Server TTS synthesis notice, switching to browser audio:', err?.message || err);
    } finally {
      this.isLoadingAudioState = false;
      this.activeAbortController = null;
    }

    // 3. Fallback to Web Speech API
    this.speakWithWebSpeech(cleanText, persona, speedMultiplier, options);
  }

  // Play audio url (data:audio/wav or http) via Web Audio API or HTML5 Audio
  private async playAudioFromUrl(
    audioUrl: string,
    speedMultiplier: number,
    options?: SpeakOptions,
    source: 'fish-speech' | 'neural' = 'fish-speech'
  ): Promise<void> {
    try {
      this.currentAudioSource = source;

      // Ensure AudioContext is available and running
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }

      if (this.audioCtx) {
        if (this.audioCtx.state === 'suspended') {
          await this.audioCtx.resume();
        }

        // Decode base64 or fetch arrayBuffer
        let arrayBuffer: ArrayBuffer;
        if (audioUrl.startsWith('data:audio/')) {
          const base64Data = audioUrl.split(',')[1];
          const binaryString = window.atob(base64Data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          arrayBuffer = bytes.buffer;
        } else {
          const resp = await fetch(audioUrl);
          arrayBuffer = await resp.arrayBuffer();
        }

        // Decode audio data with AudioContext
        const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer.slice(0));
        
        // Stop any previous source node
        if (this.currentSourceNode) {
          try { this.currentSourceNode.stop(); } catch (e) {}
          this.currentSourceNode = null;
        }

        const sourceNode = this.audioCtx.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.playbackRate.value = Math.max(0.5, Math.min(2.0, speedMultiplier));
        sourceNode.connect(this.audioCtx.destination);

        sourceNode.onended = () => {
          if (this.currentSourceNode === sourceNode) {
            this.isSpeakingState = false;
            this.isPausedState = false;
            this.currentSourceNode = null;
            options?.onEnd?.();
          }
        };

        this.currentSourceNode = sourceNode;
        this.isSpeakingState = true;
        this.isPausedState = false;
        sourceNode.start(0);
        options?.onStart?.();
        return;
      }
    } catch (webAudioErr) {
      console.warn('Web Audio API playback note, falling back to HTMLAudioElement:', webAudioErr);
    }

    // HTML5 Audio fallback
    this.playHtmlAudio(audioUrl, speedMultiplier, options, source);
  }

  // Play real audio file (WAV / MP3) via HTML5 Audio
  private playHtmlAudio(
    audioUrl: string,
    speedMultiplier: number,
    options?: SpeakOptions,
    source: 'fish-speech' | 'neural' = 'fish-speech'
  ): void {
    try {
      const audio = this.unlockedAudio || new Audio();
      audio.src = audioUrl;
      audio.playbackRate = Math.max(0.5, Math.min(2.0, speedMultiplier));
      this.activeAudio = audio;
      this.currentAudioSource = source;

      audio.onplay = () => {
        this.isSpeakingState = true;
        this.isPausedState = false;
        options?.onStart?.();
      };

      audio.onended = () => {
        this.isSpeakingState = false;
        this.isPausedState = false;
        this.activeAudio = null;
        options?.onEnd?.();
      };

      audio.onerror = (e) => {
        console.warn('HTML5 Audio playback error:', e);
        this.isSpeakingState = false;
        this.isPausedState = false;
        this.activeAudio = null;
        options?.onError?.(e);
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((playErr) => {
          console.warn('Autoplay caught:', playErr);
          this.speakWithWebSpeech(this.currentUtterance?.text || '', 'fish-storyteller', speedMultiplier, options);
        });
      }
    } catch (e) {
      console.error('Audio instance creation error:', e);
      options?.onError?.(e);
    }
  }

  // Fallback Web Speech synthesis
  private speakWithWebSpeech(
    text: string,
    persona: VoicePersona,
    speedMultiplier: number,
    options?: SpeakOptions
  ): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn('Web Speech API is unsupported in this environment.');
      options?.onError?.(new Error('Audio playback unsupported'));
      return;
    }

    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
    } catch (e) {
      // ignore
    }

    const profile = VOICE_PROFILES[persona] || VOICE_PROFILES['fish-storyteller'];
    const utterance = new SpeechSynthesisUtterance(text);

    const voice = this.pickBestVoice(profile);
    if (voice) {
      utterance.voice = voice;
    }

    utterance.pitch = profile.pitch;
    utterance.rate = Math.max(0.5, Math.min(2.0, profile.rate * speedMultiplier));
    utterance.volume = 1.0;

    utterance.onstart = () => {
      this.isSpeakingState = true;
      this.isPausedState = false;
      this.currentAudioSource = 'browser';
      this.startKeepAlive();
      options?.onStart?.();
    };

    utterance.onend = () => {
      this.isSpeakingState = false;
      this.isPausedState = false;
      this.stopKeepAlive();
      this.currentUtterance = null;
      options?.onEnd?.();
    };

    utterance.onerror = (e) => {
      this.isSpeakingState = false;
      this.isPausedState = false;
      this.stopKeepAlive();
      this.currentUtterance = null;
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        console.warn('SpeechSynthesis error:', e);
        options?.onError?.(e);
      }
    };

    utterance.onboundary = (e) => {
      if (e.name === 'word' || e.charIndex !== undefined) {
        options?.onBoundary?.(e.charIndex, (e as any).charLength || 0);
      }
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  public pause(): void {
    if (this.audioCtx && this.audioCtx.state === 'running') {
      this.audioCtx.suspend().catch(() => {});
      this.isPausedState = true;
      return;
    }

    if (this.activeAudio && !this.activeAudio.paused) {
      this.activeAudio.pause();
      this.isPausedState = true;
      return;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        this.isPausedState = true;
      }
    }
  }

  public resume(): void {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().then(() => {
        this.isPausedState = false;
        this.isSpeakingState = true;
      }).catch(() => {});
      return;
    }

    if (this.activeAudio && this.activeAudio.paused) {
      this.activeAudio.play().catch(console.warn);
      this.isPausedState = false;
      this.isSpeakingState = true;
      return;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        this.isPausedState = false;
        this.isSpeakingState = true;
      }
    }
  }

  public stop(): void {
    this.stopKeepAlive();

    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }

    if (this.currentSourceNode) {
      try {
        this.currentSourceNode.stop();
      } catch (e) {}
      this.currentSourceNode = null;
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    if (this.activeAudio) {
      this.activeAudio.pause();
      this.activeAudio.currentTime = 0;
      this.activeAudio = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    this.isSpeakingState = false;
    this.isPausedState = false;
    this.isLoadingAudioState = false;
    this.currentUtterance = null;
  }

  public setSpeed(multiplier: number): void {
    if (this.activeAudio) {
      this.activeAudio.playbackRate = Math.max(0.5, Math.min(2.0, multiplier));
    }
    if (this.currentSourceNode) {
      this.currentSourceNode.playbackRate.value = Math.max(0.5, Math.min(2.0, multiplier));
    }
  }

  public isSpeaking(): boolean {
    return this.isSpeakingState;
  }

  public isPaused(): boolean {
    return this.isPausedState;
  }

  public isLoading(): boolean {
    return this.isLoadingAudioState;
  }

  public getAudioSource(): 'fish-speech' | 'neural' | 'browser' | null {
    return this.currentAudioSource;
  }

  // Workaround for Chrome/WebKit bug where long utterances freeze after 15 seconds
  private startKeepAlive(): void {
    this.stopKeepAlive();
    this.keepAliveInterval = setInterval(() => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }
    }, 12000);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }
}

export const ttsEngine = new TTSEngine();
