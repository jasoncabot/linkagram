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
│   ├── platform.ts         # Platform detection (native vs web) via Capacitor
│   ├── payment/            # Payment abstraction layer
│   │   ├── PaymentProvider.ts   # Interface for payment providers
│   │   ├── StripeProvider.ts    # Web implementation (Stripe)
│   │   └── StoreKitProvider.ts  # iOS implementation (StoreKit via cordova-plugin-purchase)
│   └── sass/               # Styles (tokens, layout, tiles, modals, etc.)
├── ios/                    # Capacitor iOS project (generated, Xcode workspace)
├── capacitor.config.ts     # Capacitor configuration (app ID, plugins)
├── fastlane/               # Fastlane automation for App Store
│   ├── Appfile             # App identifier and Apple ID
│   ├── Fastfile            # Build lanes (beta, release, screenshots)
│   ├── Matchfile           # Code signing config (match)
│   └── metadata/           # App Store metadata
├── Gemfile                 # Ruby dependencies (Fastlane)
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
├── vite.config.ts          # Vite build config with PWA plugin (excluded in capacitor mode)
└── package.json            # Node project config
```

## How It Works

1. **Board generation**: A deterministic PRNG (Mulberry32) seeded by the date produces the same 4x4 letter grid for all players each day. Letters are chosen using weighted English letter frequencies.
2. **Word finding**: On load, a Trie is built from the dictionary. A DFS traversal of the board finds all valid words that can be formed by following adjacent tiles.
3. **Gameplay**: Players swipe/click to connect adjacent letters. Words are validated against the pre-computed set of findable words.
4. **State**: All game progress (found words, hints, streaks, stats) is stored in `localStorage`.
5. **Hints**: Players start with hints and can buy more. On web, hints use Stripe; on iOS, hints use StoreKit IAP. The payment layer is abstracted via `PaymentProvider` interface with dynamic imports so Stripe JS is never bundled in the iOS build and vice versa.
6. **Special boards**: Certain dates have hardcoded letter arrangements (e.g., birthdays, holidays).

## Key Technical Details

- **Stack**: TypeScript, Vite, Cloudflare Pages
- **PWA**: Service worker via vite-plugin-pwa for offline play (web only)
- **iOS**: Capacitor wraps the Vite `dist/` output into a native WKWebView app. Built with `--mode capacitor` which excludes the PWA plugin (service workers don't work in WKWebView). Assets are served locally from the app bundle — fully offline from first launch.
- **Hosting**: Cloudflare Pages with Functions for server-side logic (web)
- **Analytics**: Cloudflare Analytics Engine for completion stats (fire-and-forget, fails silently offline)
- **Payments**: Abstracted via `src/payment/PaymentProvider.ts`. Web uses Stripe (`StripeProvider`), iOS uses StoreKit via cordova-plugin-purchase (`StoreKitProvider`). Platform detected at runtime via `src/platform.ts`. Dynamic imports keep each provider out of the other platform's bundle.
- **IAP Product**: `com.jasoncabot.linkagram.hints12` — consumable, 99p, grants 12 hints
- **Native polish**: Haptic feedback on tile selection (light), valid word (success), invalid word (error), game completion (heavy). Status bar styled dark to match theme.
- **Dictionary definitions**: Cached in localStorage per word. Shows "(Definition available when online)" when offline.
- **Dictionary**: `public/data/small.json` — a curated list of ~3000 common English words. Use `yarn word <word>` to add new words.
- **Fastlane**: `bundle exec fastlane ios beta` builds and uploads to TestFlight. Code signing via `match` (private git repo for certs).

## Word Validity

The project owner is the sole arbiter of which words are valid. The dictionary (`public/data/small.json`) is a curated list — not every English word is included. This is intentional: a smaller dictionary makes the game more completable and fun. Do not add words to the dictionary without explicit approval.

## Versioning

The app version must be kept in sync across two files:
- `package.json` → `"version"` (used by Vite build for `__APP_VERSION__`, shown in settings UI)
- `ios/App/App.xcodeproj/project.pbxproj` → `MARKETING_VERSION` (shown in App Store / iOS settings)

When bumping the version, update **both** files. The pbxproj has `MARKETING_VERSION` in multiple build configuration blocks (Debug + Release for both app and widget targets) — update all occurrences.

## Development

```
npm install
npm run dev          # Start dev server (web)
npm run build        # Production web build (with PWA)
npm run build:ios    # Production iOS build (no PWA)
npm run cap:sync     # Sync web assets to iOS project
npm run ios          # Build, sync, and open in Xcode
npm run word <w>     # Add a word to the dictionary (requires approval)

bundle exec fastlane ios beta     # Build and upload to TestFlight
bundle exec fastlane ios release  # Build, upload, and submit for review
```
