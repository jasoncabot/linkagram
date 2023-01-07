import letterDistribution from "./../public/data/letters.json";
import smallWords from "./../public/data/small.json";
import { hashCode } from "./../src/hash";
import Linkagram from "./../src/scenes/Linkagram";

export interface Env {
  IMAGE_GENERATOR: Fetcher;
  ASSETS: any;
}

export async function onRequest(context: {
  request: Request;
  next: () => Promise<Response>;
  env: Env;
}): Promise<Response> {
  const { request, next } = context;
  const { pathname } = new URL(request.url);


  // Serve up some dynamic text and data
  if (pathname === "/assets/sample.png") {
    const { letters } = boardAndSolutionsForToday();
    return context.env.IMAGE_GENERATOR.fetch(context.request, {
      method: 'POST',
      body: JSON.stringify(letters)
});
  } else if (pathname === "/") {
    const { words } = boardAndSolutionsForToday();
    const asset = await context.env.ASSETS.fetch(context.request.url)
    let response = new Response(asset.body, asset)
    return new HTMLRewriter().on('meta', new MetaUpdater(words.size)).transform(response);
  }

  return next();
}

class MetaUpdater {
  count: number;
  constructor(count: number) {
    this.count = count;
  }
  element(element: HTMLElement) {
    if (element.getAttribute('property') === 'og:description') {
      element.setAttribute('content', `${this.count} word${this.count === 1 ? "" : "s"} to find today. Play now to find them all.`);
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
    hints: new Map<string, Set<number>>(),
    revealCount: 0,
    save: () => { },
  });
  game.initialise(smallWords, letterDistribution);
  return {
    words: game.wordList.words,
    letters: game.tiles.map(tile => tile.value)
  }
}
