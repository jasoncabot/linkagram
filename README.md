# Linkagram 

Make words by connecting letters. Each game is unique and you must find all the words.

![image](docs/screenshot.jpg)


## Config

You can change a few things by specifying URL parameters.


| Query Parameter  | Description | Default Value |
| ------------- | ------------- | -------------|
| id  | Seed for random number generator. Two games of the same size, words, letters and id will be identical  | `Math.random() * 10000` |
| width | Number of letter columns to generate | 4 |
| height | Number of letter rows to generate | 4 |

## Running locally

```
git clone ...
yarn install
yarn dev
```

## iOS App

The game ships as a native iOS app via [Capacitor](https://capacitorjs.com), wrapping the same web UI in a WKWebView. The entire `dist/` is bundled into the app binary, so it works fully offline from first launch.

```
yarn ios              # Build, sync, and open in Xcode
```

Hint purchases use StoreKit IAP on iOS (vs Stripe on web). Haptic feedback is provided on tile selection, valid/invalid words, and game completion.

Fastlane handles App Store automation:
```
export MATCH_GIT_URL=git@github.com:jasoncabot/ios-certificates.git
bundle install
bundle exec fastlane ios beta        # Upload to TestFlight
bundle exec fastlane ios release     # Submit for App Store review
bundle exec fastlane ios screenshots # Capture App Store screenshots
```

Screenshots are captured automatically using fastlane Snapshot on two simulators:
- **iPhone 11 Pro Max** — satisfies the 6.5" Display slot
- **iPad Air 13-inch (M3)** — satisfies the 13" Display slot

The UI test (`LinkagramUITests/LinkagramUITests.swift`) waits for the game board to fully render, then captures three screens: the game board, the how-to-play modal, and the personal stats modal. Output is saved to `fastlane/screenshots/`.

## How it's written

TypeScript for the code, vanilla DOM manipulation for the components. Vite for bundling.

## How it works

1. When you load the page, a dictionary of available words and letter frequencies of the english language is loaded
2. The correct number of letter tiles are generated, with links between them to form a graph of letters
3. A `Trie` is built to find all words that can be made on this particular board
4. Each complete word entered by the user is checked to see if it's valid or not, or whether it's already been discovered in this game

## Interesting things

### Solver

There is a solver written in Python to build special grids with a known set of words.

Read more about how it works [here](solver/README.md)

### WASM Images

There is a path that dynamically generates an image of todays board for use with social media sharing. This is done by writing an SVG file with a 'custom font' and converting to PNG with WASM before streaming the response back to the client.

### Payments in a static site

The game gives you a limited number of hints but you can buy more. On the web, this uses a Stripe integration — the client sends a request to a Cloudflare function to create a payment intent, and then uses the Stripe SDK to complete the payment. On iOS, it uses StoreKit in-app purchases via cordova-plugin-purchase. Both are abstracted behind a `PaymentProvider` interface so the game logic doesn't know which payment system is in use. There is no way around this. Nope. None at all. Definitely don't modify the local storage value yourself.