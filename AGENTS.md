# Linkagram

Linkagram is a daily word puzzle game. Players are presented with a 4x4 grid of letters and must find all valid words by connecting adjacent letters (including diagonals). Each letter can only be used once per word. There are no timers — the challenge is simply to complete the grid.

A new puzzle is generated each day based on the date, so every player gets the same grid on the same day.

## Project Structure

```
.
├── src/                    # Frontend TypeScript source
│   ├── index.ts            # Entry point: config parsing, state management (localStorage)
│   ├── scenes/Linkagram.ts # Core game logic: board generation, word finding, UI, hints, payments
│   ├── trie.ts             # Trie data structure for efficient word lookup
│   ├── key.ts              # Date-based key generation (YYYYMMDD format)
│   ├── hash.ts             # String hash function for seeding the PRNG
│   ├── confetti.ts         # Celebration animation on completion
│   └── sass/mystyles.scss  # Styles (Bulma-based)
├── functions/              # Cloudflare Pages Functions (server-side)
│   └── _middleware.ts      # Handles /stats, /hint_payment, dynamic OG images, HTML rewriting
├── solver/                 # Python constraint solver (Google OR-Tools)
│   └── ortools_solver.py   # Generates grids with specific words placed on them
├── scripts/
│   └── add-word.js         # CLI script to add a word to the dictionary
├── public/
│   └── data/
│       ├── small.json      # The word dictionary (~3000 common English words)
│       └── letters.json    # English letter frequency distribution
├── index.html              # Main HTML with modals for wordlist, hints, stats, how-to-play
├── vite.config.ts          # Vite build config with PWA plugin
└── package.json            # Node project config
```

## How It Works

1. **Board generation**: A deterministic PRNG (Mulberry32) seeded by the date produces the same 4x4 letter grid for all players each day. Letters are chosen using weighted English letter frequencies.
2. **Word finding**: On load, a Trie is built from the dictionary. A DFS traversal of the board finds all valid words that can be formed by following adjacent tiles.
3. **Gameplay**: Players swipe/click to connect adjacent letters. Words are validated against the pre-computed set of findable words.
4. **State**: All game progress (found words, hints, streaks, stats) is stored in `localStorage`.
5. **Hints**: Players start with hints and can buy more via Stripe. Hints reveal individual letters of unfound words.
6. **Special boards**: Certain dates have hardcoded letter arrangements (e.g., birthdays, holidays).

## Key Technical Details

- **Stack**: TypeScript, Vite, Bulma CSS, Cloudflare Pages
- **PWA**: Service worker via vite-plugin-pwa for offline play
- **Hosting**: Cloudflare Pages with Functions for server-side logic
- **Analytics**: Cloudflare Analytics Engine for completion stats
- **Dictionary**: `public/data/small.json` — a curated list of ~3000 common English words. Use `yarn word <word>` to add new words.

## Word Validity

The project owner is the sole arbiter of which words are valid. The dictionary (`public/data/small.json`) is a curated list — not every English word is included. This is intentional: a smaller dictionary makes the game more completable and fun. Do not add words to the dictionary without explicit approval.

## Development

```
yarn install
yarn dev        # Start dev server
yarn build      # Production build
yarn word <w>   # Add a word to the dictionary (requires approval)
```
