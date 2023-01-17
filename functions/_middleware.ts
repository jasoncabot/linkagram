import letterDistribution from "./../public/data/letters.json";
import smallWords from "./../public/data/small.json";
import { hashCode } from "./../src/hash";
import Linkagram from "./../src/scenes/Linkagram";

export interface Env {
  IMAGE_GENERATOR: Fetcher;
  PAYMENT_SERVICE: Fetcher;
  ASSETS: any;
}

export async function onRequest(context: {
  request: Request;
  next: () => Promise<Response>;
  env: Env;
}): Promise<Response> {
  const { request, next, env } = context;
  const { pathname, origin } = new URL(request.url);

  // Serve up some dynamic text and data
  if (pathname === "/assets/sample.png") {
    const { letters } = boardAndSolutionsForToday();
    return context.env.IMAGE_GENERATOR.fetch(request, {
      method: 'POST',
      body: JSON.stringify(letters)
    });
  } else if (pathname === "/hint_payment") {
    return context.env.PAYMENT_SERVICE.fetch(request);
  } else if (pathname === "/") {
    const { words, letters } = boardAndSolutionsForToday();
    const asset = await context.env.ASSETS.fetch(context.request.url)
    let response = new Response(asset.body, asset)
    return new HTMLRewriter().on('meta', new MetaUpdater(words.size, letters, origin)).transform(response);
  } else {
    // if we are using images of the form: /assets/linkagramgame.png - we treat everything in 
    // the path name as the dynamic set of letters to produce - it means we can cache it forever
    const assetRouteMatch = pathname.match(/assets\/([a-z]+)\.png/);
    if (assetRouteMatch?.length == 2) {
      const letters = assetRouteMatch[1].split("");
      return context.env.IMAGE_GENERATOR.fetch(context.request, {
        method: 'POST',
        body: JSON.stringify(letters)
      });
    }
  }

  return next();
}

class MetaUpdater {
  count: number;
  letters: string[];
  origin: string;
  constructor(count: number, letters: string[], origin: string) {
    this.count = count;
    this.letters = letters;
    this.origin = origin;
  }
  element(element: HTMLElement) {
    if (element.getAttribute('property') === 'og:description') {
      element.setAttribute('content', `${this.count} word${this.count === 1 ? "" : "s"} to find today. Play now to find them all.`);
    } else if (element.getAttribute('property') === 'og:image') {
      element.setAttribute('content', `${this.origin}/assets/${this.letters.join("")}.png`);
    }
  }
}

const boardAndSolutionsForToday: () => { words: Set<string>, letters: string[] } = () => {
  const today = new Date();
  const config = {
    size: { width: 4, height: 4 },
    id: parseInt([today.getFullYear(), today.getMonth() + 1, today.getDate()].join(''), 10),
    dictionary: "small.json",
    frequencies: 'letters.json'
  };
  const setOfWords = new Set<string>(smallWords);
  const key = `${config.id},${config.dictionary},${config.frequencies},${config.size.width},${config.size.height}`;
  const game = new Linkagram(config, {
    seed: hashCode(key),
    words: setOfWords,
    hintCount: 0,
    startedAt: new Date(),
    finishedAt: null,
    hints: new Map<string, Set<number>>(),
    completed: [],
    maxStreak: 0,
    played: [],
    streak: 0,
    save: (_) => { },
    purge: () => { },
  });
  game.initialise(smallWords, letterDistribution);
  return {
    words: game.wordList.words,
    letters: game.tiles.map(tile => tile.value)
  }
}
