import { keyForToday } from "../src/key";
import letterDistribution from "./../public/data/letters.json";
import smallWords from "./../public/data/small.json";
import { hashCode } from "./../src/hash";
import Linkagram from "./../src/scenes/Linkagram";

export interface Env {
  IMAGE_GENERATOR: Fetcher;
  PAYMENT_SERVICE: Fetcher;
  PAYMENT_SERVICE_URL: string;
  ASSETS: any;
  ANALYTICS: AnalyticsEngineDataset;
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
    return env.IMAGE_GENERATOR.fetch(request, {
      method: "POST",
      body: JSON.stringify(letters),
    });
  } else if (pathname === "/hint_payment") {
    return fetch(env.PAYMENT_SERVICE_URL, { method: request.method });
  } else if (pathname === "/stats" && request.method === "POST") {

    // read the hints used and time taken from the request body
    const body = await request.json() as {
      hintsUsed: number;
      timeTaken: number;
      streak: number;
      maxStreak: number;
    };
    const hintsUsed = body.hintsUsed;
    const timeTaken = body.timeTaken;
    const streak = body.streak;
    const maxStreak = body.maxStreak;

    const dataPoint: AnalyticsEngineDataPoint = {
      blobs: [keyForToday()],
      doubles: [hintsUsed, timeTaken, streak, maxStreak],
      indexes: [request.cf.postalCode],
    };

    console.log("dataPoint", dataPoint);
    if (env.ANALYTICS) {
      env.ANALYTICS.writeDataPoint(dataPoint);
    }
  } else if (pathname === "/") {
    const { words, letters } = boardAndSolutionsForToday();
    const asset = await env.ASSETS.fetch(context.request.url);
    let response = new Response(asset.body, asset);
    return new HTMLRewriter()
      .on("meta", new MetaUpdater(words.size, letters, origin))
      .transform(response);
  } else {
    // if we are using images of the form: /assets/linkagramgame.png - we treat everything in
    // the path name as the dynamic set of letters to produce - it means we can cache it forever
    const assetRouteMatch = pathname.match(/assets\/([a-z]+)\.png/);
    if (assetRouteMatch?.length == 2) {
      const letters = assetRouteMatch[1].split("");
      return env.IMAGE_GENERATOR.fetch(context.request, {
        method: "POST",
        body: JSON.stringify(letters),
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
    if (element.getAttribute("property") === "og:description") {
      element.setAttribute(
        "content",
        `${this.count} word${
          this.count === 1 ? "" : "s"
        } to find today. Play now to find them all.`
      );
    } else if (element.getAttribute("property") === "og:image") {
      element.setAttribute(
        "content",
        `${this.origin}/assets/${this.letters.join("")}.png`
      );
    }
  }
}

const boardAndSolutionsForToday: () => {
  words: Set<string>;
  letters: string[];
} = () => {
  const id = parseInt(keyForToday(), 10);
  const config = {
    size: { width: 4, height: 4 },
    id: id,
    dictionary: "small.json",
    frequencies: "letters.json",
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
    fixes: new Set<string>(),
    save: (_) => {},
    purge: () => {},
  });
  game.initialise(smallWords, letterDistribution);
  return {
    words: game.wordList.words,
    letters: game.tiles.map((tile) => tile.value),
  };
};
