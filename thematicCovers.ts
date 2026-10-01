/**
 * Thematic Illustrated Watercolor Storybook Cover Generator
 * Produces rich, painted children's book covers inspired by classic picture books
 * and modern illustrated novels (like "ZIP! ZAP! SCRIBBLE!" and "My Hamster is a Video Game Hero!").
 *
 * Features:
 * - Hand-painted watercolor wash backgrounds on warm textured cream paper
 * - Vibrant hand-lettered arched titles with multi-color pencil sketch shadows
 * - Playful storytelling character vignettes and scene elements
 * - Watercolor paint splatters, stardust sparkles, and soft organic margins
 */

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generateThematicCoverSvg(
  title: string,
  concept: string,
  ageGroup: string,
  genre: string
): string {
  const lower = (concept + ' ' + title + ' ' + genre).toLowerCase();

  // Palette and thematic motif configuration matching watercolor picture book art
  let themeConfig = {
    washTop: '#fdfbf7',
    washMid: '#fef3c7',
    washBottom: '#fed7aa',
    accent1: '#ec4899',
    accent2: '#06b6d4',
    accent3: '#8b5cf6',
    titleGradient: ['#ea580c', '#e11d48'],
    sceneType: 'adventure',
  };

  if (lower.includes('hamster') || lower.includes('space') || lower.includes('lunar') || lower.includes('game') || lower.includes('pixel')) {
    themeConfig = {
      washTop: '#1e1b4b',
      washMid: '#4338ca',
      washBottom: '#38bdf8',
      accent1: '#facc15',
      accent2: '#38bdf8',
      accent3: '#ec4899',
      titleGradient: ['#38bdf8', '#c084fc'],
      sceneType: 'space-gaming',
    };
  } else if (lower.includes('puppy') || lower.includes('barkery') || lower.includes('bake') || lower.includes('muffin') || lower.includes('dog')) {
    themeConfig = {
      washTop: '#fffbeb',
      washMid: '#fde68a',
      washBottom: '#f97316',
      accent1: '#3b82f6',
      accent2: '#ec4899',
      accent3: '#10b981',
      titleGradient: ['#c2410c', '#ea580c'],
      sceneType: 'bakery-puppy',
    };
  } else if (lower.includes('scribble') || lower.includes('art') || lower.includes('zap') || lower.includes('magic')) {
    themeConfig = {
      washTop: '#fdfbf7',
      washMid: '#fef08a',
      washBottom: '#a5f3fc',
      accent1: '#f43f5e',
      accent2: '#8b5cf6',
      accent3: '#10b981',
      titleGradient: ['#db2777', '#0284c7'],
      sceneType: 'scribble-magic',
    };
  } else if (lower.includes('pizza') || lower.includes('pirate') || lower.includes('food')) {
    themeConfig = {
      washTop: '#fff7ed',
      washMid: '#ffedd5',
      washBottom: '#fb7185',
      accent1: '#f59e0b',
      accent2: '#16a34a',
      accent3: '#e11d48',
      titleGradient: ['#dc2626', '#d97706'],
      sceneType: 'pizza-pirate',
    };
  }

  // Word-wrapping for title
  const words = title.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= 16) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  // Dynamic Scene Illustration
  let sceneIllustration = '';

  if (themeConfig.sceneType === 'space-gaming') {
    sceneIllustration = `
      <!-- Cosmic Watercolor Swirl -->
      <path d="M 120 440 C 220 380, 380 400, 480 460 C 520 480, 460 620, 360 630 C 240 640, 140 520, 120 440 Z" fill="${themeConfig.accent3}" opacity="0.35" filter="url(#blurWash)" />
      <path d="M 180 480 C 260 420, 400 440, 450 510 C 420 580, 300 600, 220 570 Z" fill="${themeConfig.accent2}" opacity="0.45" filter="url(#blurWash)" />

      <!-- Retro Handheld Console / Portal -->
      <g transform="translate(180, 440) scale(1.1)" filter="url(#dropShadow)">
        <rect x="0" y="0" width="130" height="200" rx="22" fill="#a855f7" stroke="#7e22ce" stroke-width="4" />
        <rect x="15" y="20" width="100" height="90" rx="10" fill="#0f172a" />
        <!-- Screen Portal Vortex -->
        <circle cx="65" cy="65" r="38" fill="url(#portalGrad)" />
        <ellipse cx="65" cy="65" rx="30" ry="20" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.8" />
        <ellipse cx="65" cy="65" rx="18" ry="10" fill="none" stroke="#67e8f9" stroke-width="3" opacity="0.9" />
        <!-- Controls -->
        <path d="M 35 140 h 12 v -12 h 12 v 12 h 12 v 12 h -12 v 12 h -12 v -12 h -12 Z" fill="#1e1b4b" />
        <circle cx="95" cy="142" r="9" fill="#f43f5e" />
        <circle cx="110" cy="155" r="9" fill="#facc15" />
      </g>

      <!-- Flying Astro-Hamster Leaping From Screen -->
      <g transform="translate(330, 360) rotate(-15)" filter="url(#dropShadow)">
        <!-- Helmet Bubble -->
        <circle cx="70" cy="70" r="50" fill="#e0f2fe" opacity="0.65" stroke="#38bdf8" stroke-width="3" />
        <ellipse cx="55" cy="55" rx="18" ry="8" fill="#ffffff" opacity="0.8" transform="rotate(-30, 55, 55)" />
        <!-- Hamster Body -->
        <ellipse cx="70" cy="74" rx="32" ry="26" fill="#f59e0b" />
        <ellipse cx="70" cy="78" rx="22" ry="18" fill="#fef3c7" />
        <circle cx="58" cy="66" r="4.5" fill="#1e293b" />
        <circle cx="82" cy="66" r="4.5" fill="#1e293b" />
        <ellipse cx="70" cy="72" rx="4" ry="3" fill="#f43f5e" />
        <!-- Little Paws & Boots -->
        <ellipse cx="48" cy="85" rx="7" ry="5" fill="#ffffff" />
        <ellipse cx="92" cy="85" rx="7" ry="5" fill="#ffffff" />
        <!-- Rocket Jetpack on Back -->
        <rect x="25" y="58" width="18" height="34" rx="6" fill="#ef4444" stroke="#b91c1c" stroke-width="2" />
        <!-- Jet Flame -->
        <path d="M 28 92 Q 34 118 40 92 Z" fill="#38bdf8" />
      </g>

      <!-- Stars, Planets & Watercolor Splatters -->
      <circle cx="120" cy="340" r="18" fill="#fef08a" opacity="0.9" />
      <ellipse cx="120" cy="340" rx="30" ry="7" fill="none" stroke="#fde047" stroke-width="2.5" transform="rotate(-20, 120, 340)" />
      <path d="M 470 320 l 5 12 l 13 2 l -9 9 l 2 13 l -11 -6 l -11 6 l 2 -13 l -9 -9 l 13 -2 Z" fill="#fde047" />
      <path d="M 160 580 l 3 8 l 8 1 l -6 6 l 1 8 l -7 -4 l -7 4 l 1 -8 l -6 -6 l 8 -1 Z" fill="#ffffff" opacity="0.8" />
      <circle cx="480" cy="560" r="7" fill="${themeConfig.accent1}" opacity="0.7" />
      <circle cx="495" cy="580" r="4" fill="${themeConfig.accent2}" opacity="0.7" />
    `;
  } else if (themeConfig.sceneType === 'bakery-puppy') {
    sceneIllustration = `
      <!-- Warm Kitchen Sunbeam Wash -->
      <path d="M 100 380 Q 300 320 500 380 Q 480 640 100 640 Z" fill="#fde68a" opacity="0.4" filter="url(#blurWash)" />
      <circle cx="300" cy="460" r="140" fill="#fef08a" opacity="0.3" filter="url(#blurWash)" />

      <!-- Cheerful Golden Puppy Baker in Chef Hat -->
      <g transform="translate(200, 380)" filter="url(#dropShadow)">
        <!-- Chef Hat -->
        <path d="M 75 40 Q 60 10 95 10 Q 110 5 125 15 Q 155 10 145 40 Z" fill="#ffffff" stroke="#e2e8f0" stroke-width="3" />
        <rect x="75" y="38" width="70" height="18" rx="5" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2" />
        
        <!-- Puppy Head -->
        <ellipse cx="110" cy="95" rx="50" ry="44" fill="#f59e0b" />
        <!-- Big Floppy Ears -->
        <path d="M 65 75 C 35 90, 40 140, 68 135 C 72 120, 75 90, 65 75 Z" fill="#d97706" />
        <path d="M 155 75 C 185 90, 180 140, 152 135 C 148 120, 145 90, 155 75 Z" fill="#d97706" />
        <!-- Snout & Smile -->
        <ellipse cx="110" cy="108" rx="24" ry="18" fill="#fef3c7" />
        <ellipse cx="110" cy="100" rx="9" ry="6" fill="#1e293b" />
        <path d="M 104 110 Q 110 118 116 110" fill="none" stroke="#1e293b" stroke-width="3" stroke-linecap="round" />
        <!-- Puppy Eyes -->
        <circle cx="94" cy="85" r="7" fill="#1e293b" />
        <circle cx="96" cy="83" r="2.5" fill="#ffffff" />
        <circle cx="126" cy="85" r="7" fill="#1e293b" />
        <circle cx="128" cy="83" r="2.5" fill="#ffffff" />
        <!-- Flour Smudge on Cheek -->
        <circle cx="85" cy="98" r="6" fill="#ffffff" opacity="0.8" />
        <!-- Red Baker Bandana -->
        <path d="M 85 130 Q 110 145 135 130 L 110 155 Z" fill="#ef4444" />
      </g>

      <!-- Flying Juggling Giant Blueberry Muffins -->
      <g transform="translate(110, 360) rotate(-15)" filter="url(#dropShadow)">
        <path d="M 20 40 Q 40 15 60 40 L 52 70 L 28 70 Z" fill="#d97706" />
        <path d="M 15 42 Q 40 20 65 42 Q 72 40 68 32 Q 55 18 35 18 Q 18 20 12 32 Z" fill="#92400e" />
        <circle cx="32" cy="30" r="4.5" fill="#1e40af" />
        <circle cx="48" cy="34" r="4" fill="#1e40af" />
        <circle cx="40" cy="24" r="3.5" fill="#1e40af" />
      </g>

      <g transform="translate(420, 370) rotate(20)" filter="url(#dropShadow)">
        <path d="M 20 40 Q 40 15 60 40 L 52 70 L 28 70 Z" fill="#d97706" />
        <path d="M 15 42 Q 40 20 65 42 Q 72 40 68 32 Q 55 18 35 18 Q 18 20 12 32 Z" fill="#92400e" />
        <circle cx="30" cy="30" r="4.5" fill="#1e40af" />
        <circle cx="50" cy="34" r="4" fill="#1e40af" />
      </g>

      <!-- Puffs of Exploding White Flour & Sprinkles -->
      <circle cx="160" cy="460" r="16" fill="#ffffff" opacity="0.6" filter="url(#blurWash)" />
      <circle cx="430" cy="480" r="22" fill="#ffffff" opacity="0.7" filter="url(#blurWash)" />
      <circle cx="190" cy="500" r="4" fill="#f43f5e" />
      <circle cx="210" cy="495" r="4" fill="#38bdf8" />
      <circle cx="390" cy="520" r="4" fill="#facc15" />
      <circle cx="410" cy="505" r="4" fill="#22c55e" />
    `;
  } else if (themeConfig.sceneType === 'scribble-magic') {
    sceneIllustration = `
      <!-- School Hallway Watercolor Wash Perspective -->
      <path d="M 50 350 L 260 440 L 340 440 L 550 350 L 550 670 L 50 670 Z" fill="#fef08a" opacity="0.25" filter="url(#blurWash)" />

      <!-- Joyful Running Boy -->
      <g transform="translate(100, 420)" filter="url(#dropShadow)">
        <!-- Boy Head & Hair -->
        <circle cx="80" cy="75" r="32" fill="#fed7aa" />
        <!-- Messy Brown Hair -->
        <path d="M 50 70 Q 55 35 80 40 Q 95 30 110 45 Q 120 60 112 80 Z" fill="#78350f" />
        <!-- Happy Face -->
        <circle cx="88" cy="72" r="4" fill="#1e293b" />
        <path d="M 85 82 Q 95 92 105 82" fill="none" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round" />
        <!-- Running Body in Blue Striped Shirt -->
        <path d="M 68 105 L 105 105 L 98 150 L 62 150 Z" fill="#0284c7" />
        <line x1="66" y1="118" x2="103" y2="118" stroke="#ffffff" stroke-width="4" />
        <line x1="64" y1="134" x2="100" y2="134" stroke="#ffffff" stroke-width="4" />
        <!-- Shorts & Running Legs with Sneakers -->
        <rect x="62" y="148" width="38" height="24" rx="4" fill="#ea580c" />
        <!-- Outstretched Arm Reaching -->
        <path d="M 98 115 Q 135 110 150 100" fill="none" stroke="#fed7aa" stroke-width="12" stroke-linecap="round" />
      </g>

      <!-- Rainbow Scribble Octopus in Sneakers -->
      <g transform="translate(320, 390)" filter="url(#dropShadow)">
        <!-- Glowing Scribble Body with Rainbow Outline -->
        <ellipse cx="90" cy="70" rx="42" ry="46" fill="#ffffff" stroke="url(#rainbowGrad)" stroke-width="5" />
        <!-- Cute Happy Face -->
        <circle cx="78" cy="65" r="4" fill="#1e293b" />
        <circle cx="102" cy="65" r="4" fill="#1e293b" />
        <path d="M 82 78 Q 90 86 98 78" fill="none" stroke="#f43f5e" stroke-width="3" stroke-linecap="round" />
        <circle cx="72" cy="74" r="6" fill="#fda4af" opacity="0.8" />
        <circle cx="108" cy="74" r="6" fill="#fda4af" opacity="0.8" />
        <!-- Waving Curled Tentacles -->
        <path d="M 55 90 C 20 110, 10 135, 25 150 C 40 160, 55 125, 65 105" fill="none" stroke="#38bdf8" stroke-width="7" stroke-linecap="round" />
        <path d="M 72 105 C 50 130, 45 155, 60 170 C 75 180, 85 140, 85 110" fill="none" stroke="#facc15" stroke-width="7" stroke-linecap="round" />
        <path d="M 105 110 C 105 140, 115 180, 130 170 C 145 155, 140 130, 118 105" fill="none" stroke="#22c55e" stroke-width="7" stroke-linecap="round" />
        <path d="M 125 105 C 135 125, 150 160, 165 150 C 180 135, 170 110, 135 90" fill="none" stroke="#f43f5e" stroke-width="7" stroke-linecap="round" />
        <!-- Tiny Sneaker Shoes on Tentacles -->
        <rect x="15" y="145" width="22" height="12" rx="4" fill="#ef4444" />
        <rect x="52" y="165" width="22" height="12" rx="4" fill="#3b82f6" />
        <rect x="122" y="165" width="22" height="12" rx="4" fill="#10b981" />
        <rect x="155" y="145" width="22" height="12" rx="4" fill="#f59e0b" />
      </g>

      <!-- Rainbow Pencil Scribble Trails & Confetti Dots -->
      <path d="M 160 520 Q 280 470 380 500 T 520 480" fill="none" stroke="#ec4899" stroke-width="3" stroke-dasharray="8 6" opacity="0.8" />
      <path d="M 170 535 Q 290 485 390 515 T 530 495" fill="none" stroke="#38bdf8" stroke-width="3" stroke-dasharray="6 6" opacity="0.8" />
      <path d="M 180 550 Q 300 500 400 530 T 540 510" fill="none" stroke="#facc15" stroke-width="3" stroke-dasharray="8 4" opacity="0.8" />
    `;
  } else {
    // Default: Pizza Pirates / Swashbuckling Comic
    sceneIllustration = `
      <!-- Marinara Ocean Wash -->
      <path d="M 60 500 Q 200 460 300 490 T 540 480 L 540 680 L 60 680 Z" fill="#ef4444" opacity="0.45" filter="url(#blurWash)" />
      
      <!-- Pizza Slice Pirate Ship -->
      <g transform="translate(180, 410)" filter="url(#dropShadow)">
        <!-- Crust Hull -->
        <path d="M 20 140 Q 120 170 220 140 L 200 180 Q 120 195 40 180 Z" fill="#d97706" stroke="#b45309" stroke-width="3" />
        <circle cx="80" cy="160" r="10" fill="#dc2626" />
        <circle cx="150" cy="160" r="10" fill="#dc2626" />
        <!-- Pepperoni Pizza Slice Main Sail -->
        <path d="M 120 20 L 50 130 L 190 130 Z" fill="#fbbf24" stroke="#f59e0b" stroke-width="3" />
        <!-- Pepperoni Slices on Sail -->
        <circle cx="100" cy="80" r="14" fill="#dc2626" />
        <circle cx="135" cy="95" r="12" fill="#dc2626" />
        <circle cx="120" cy="50" r="10" fill="#dc2626" />
        <!-- Mozzarella Cheese Drips -->
        <path d="M 50 130 Q 80 145 110 130 Q 140 145 190 130" fill="none" stroke="#ffffff" stroke-width="4" />
        <!-- Jolly Roger Tricorn Pirate Cat -->
        <circle cx="120" cy="15" r="18" fill="#f8fafc" />
        <polygon points="105,5 120,-8 135,5" fill="#f8fafc" />
        <!-- Eye Patch -->
        <circle cx="114" cy="15" r="4" fill="#1e293b" />
        <circle cx="126" cy="15" r="4" fill="#16a34a" />
      </g>

      <!-- Splash Waves of Tomato Sauce & Basil Leaves -->
      <path d="M 120 540 Q 160 510 200 550" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" />
      <path d="M 380 530 Q 420 500 460 540" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" />
      <ellipse cx="140" cy="560" rx="14" ry="7" fill="#15803d" transform="rotate(-30, 140, 560)" />
      <ellipse cx="440" cy="560" rx="14" ry="7" fill="#15803d" transform="rotate(25, 440, 560)" />
    `;
  }

  return `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="100%" height="100%">
  <defs>
    <!-- Background Watercolor Wash Gradient -->
    <linearGradient id="paperWash" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${themeConfig.washTop}" />
      <stop offset="45%" stop-color="${themeConfig.washMid}" />
      <stop offset="100%" stop-color="${themeConfig.washBottom}" />
    </linearGradient>

    <!-- Title Artistic Gradient -->
    <linearGradient id="titleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${themeConfig.titleGradient[0]}" />
      <stop offset="100%" stop-color="${themeConfig.titleGradient[1]}" />
    </linearGradient>

    <!-- Rainbow Gradient -->
    <linearGradient id="rainbowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ef4444" />
      <stop offset="25%" stop-color="#f59e0b" />
      <stop offset="50%" stop-color="#10b981" />
      <stop offset="75%" stop-color="#06b6d4" />
      <stop offset="100%" stop-color="#8b5cf6" />
    </linearGradient>

    <radialGradient id="portalGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="40%" stop-color="#67e8f9" />
      <stop offset="80%" stop-color="#3b82f6" />
      <stop offset="100%" stop-color="#1e1b4b" />
    </radialGradient>

    <!-- Soft Watercolor Blur Filter -->
    <filter id="blurWash" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="28" />
    </filter>

    <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="3" dy="6" stdDeviation="5" flood-color="#0f172a" flood-opacity="0.3" />
    </filter>

    <!-- Paper Texture Speckle Filter -->
    <filter id="paperGrain">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
      <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.08 0" />
      <feComposite in2="SourceGraphic" in="gl" operator="in" />
    </filter>
  </defs>

  <!-- Warm Textured Watercolor Paper Base -->
  <rect width="600" height="800" rx="16" fill="url(#paperWash)" />
  <rect width="600" height="800" rx="16" fill="#fdfbf7" opacity="0.18" filter="url(#paperGrain)" />

  <!-- Watercolor Edge Vignette & Subtle Deckled Border -->
  <rect x="18" y="18" width="564" height="764" rx="12" fill="none" stroke="#f1e6d0" stroke-width="2.5" opacity="0.8" />
  <rect x="24" y="24" width="552" height="752" rx="10" fill="none" stroke="#e6d5b8" stroke-width="1.5" stroke-dasharray="6 8" opacity="0.6" />

  <!-- Dynamic Thematic Center Illustration Scene -->
  ${sceneIllustration}

  <!-- Playful Hand-Drawn Arched Storybook Title -->
  <g filter="url(#dropShadow)">
    ${lines.map((line, idx) => {
      const yPos = 100 + idx * 56;
      return `
        <!-- Colored Pencil Sketch Shadow -->
        <text
          x="302"
          y="${yPos + 4}"
          font-family="Fredoka, Bubblegum Sans, Comic Neue, sans-serif"
          font-weight="900"
          font-size="${lines.length > 2 ? 36 : 46}"
          text-anchor="middle"
          fill="#1e1b4b"
          opacity="0.35"
          letter-spacing="1.5"
        >${escapeXml(line)}</text>

        <!-- White Highlight Outline -->
        <text
          x="300"
          y="${yPos}"
          font-family="Fredoka, Bubblegum Sans, Comic Neue, sans-serif"
          font-weight="900"
          font-size="${lines.length > 2 ? 36 : 46}"
          text-anchor="middle"
          fill="#ffffff"
          stroke="#ffffff"
          stroke-width="8"
          stroke-linejoin="round"
          letter-spacing="1.5"
        >${escapeXml(line)}</text>

        <!-- Main Vibrant Watercolor Lettering -->
        <text
          x="300"
          y="${yPos}"
          font-family="Fredoka, Bubblegum Sans, Comic Neue, sans-serif"
          font-weight="900"
          font-size="${lines.length > 2 ? 36 : 46}"
          text-anchor="middle"
          fill="url(#titleGrad)"
          letter-spacing="1.5"
        >${escapeXml(line)}</text>
      `;
    }).join('')}
  </g>

  <!-- Tagline / Age Pill Hand-Drawn Banner at Bottom -->
  <g transform="translate(300, 725)" filter="url(#dropShadow)">
    <rect x="-110" y="-18" width="220" height="36" rx="18" fill="#ffffff" stroke="#fde047" stroke-width="3" opacity="0.95" />
    <text x="0" y="5" font-family="Fredoka, sans-serif" font-weight="800" font-size="14" fill="#0f172a" text-anchor="middle">
      ★ ${escapeXml(ageGroup)} ★
    </text>
  </g>

  <!-- Spine Binding Highlight Simulation -->
  <rect x="0" y="0" width="14" height="800" rx="4" fill="#000000" opacity="0.1" />
  <line x1="14" y1="0" x2="14" y2="800" stroke="#ffffff" stroke-width="1.5" opacity="0.3" />
</svg>
  `)}`;
}
