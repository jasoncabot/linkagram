import { keyForToday } from "../src/key";
import letterDistribution from "./../public/data/letters.json";
import smallWords from "./../public/data/small.json";
import { hashCode } from "./../src/hash";
import Linkagram, { LinkagramStatRequest } from "./../src/scenes/Linkagram";
import { Request } from "@cloudflare/workers-types";

export interface Env {
  IMAGE_GENERATOR: Fetcher;
  PAYMENT_SERVICE: Fetcher;
  ASSETS: any;
  ANALYTICS: AnalyticsEngineDataset;
  ACCOUNT_ID: string;
  API_TOKEN: string;
  GITHUB_TOKEN: string;
  SUGGESTIONS: KVNamespace;
  DEFINITIONS: KVNamespace;
}

export async function onRequest(context: {
  request: Request;
  next: () => Promise<Response>;
  env: Env;
}): Promise<Response> {
  const { request, next, env } = context;
  const { pathname, origin } = new URL(request.url);

  // Apple requires AASA to be served as application/json with no redirects
  if (pathname === "/.well-known/apple-app-site-association") {
    const asset = await env.ASSETS.fetch(context.request.url);
    return new Response(asset.body, {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Serve up some dynamic text and data
  if (pathname === "/assets/sample.png") {
    const { letters } = boardAndSolutionsForToday();
    return env.IMAGE_GENERATOR.fetch(request as any, {
      method: "POST",
      body: JSON.stringify(letters),
    });
  } else if (pathname === "/hint_payment") {
    return env.PAYMENT_SERVICE.fetch(request.url, { method: request.method });
  } else if (pathname === "/stats" && request.method === "POST") {
    // read the hints used and time taken from the request body
    const body = (await request.json()) as LinkagramStatRequest;
    const hintsRemaining = body.hintsRemaining;
    const timeTaken = body.timeTaken;
    const streak = body.streak;
    const maxStreak = body.maxStreak;

    const dataPoint: AnalyticsEngineDataPoint = {
      doubles: [hintsRemaining, timeTaken, streak, maxStreak],
      indexes: [keyForToday()],
    };

    console.log("dataPoint", dataPoint);
    if (env.ANALYTICS) {
      env.ANALYTICS.writeDataPoint(dataPoint);
      return new Response("ok", { status: 201 });
    }
    return new Response("no-k", { status: 200 });
  } else if (pathname === "/stats" && request.method === "GET") {
    const query =
      "SELECT quantileWeighted(0.50, double2, _sample_interval) as p50, quantileWeighted(0.90, double2, _sample_interval) as p90 FROM completions";
    return fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/analytics_engine/sql`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.API_TOKEN}`,
        },
        body: query,
      }
    );
  } else if (pathname === "/share") {
    const { words, letters } = boardAndSolutionsForToday();
    const wordCount = words.size;
    const imageUrl = `${origin}/assets/${letters.join("")}.png`;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Linkagram - Daily Word Puzzle</title>
  <meta property="og:title" content="Linkagram - Daily Word Puzzle">
  <meta property="og:description" content="${wordCount} word${wordCount === 1 ? "" : "s"} to find today. Play now to find them all.">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:width" content="256">
  <meta property="og:image:height" content="256">
  <meta property="og:url" content="${origin}/share">
  <meta property="og:site_name" content="Linkagram">
  <meta name="apple-itunes-app" content="app-id=882340053, app-argument=${origin}/share">
  <script>
    // With Universal Links, iOS users with the app installed go straight
    // to the app and never reach this page. Everyone else gets the web app.
    window.location.replace("${origin}/");
  </script>
</head>
<body>
  <p>Redirecting to <a href="${origin}/">Linkagram</a>...</p>
</body>
</html>`;
    return new Response(html, {
      headers: { "Content-Type": "text/html;charset=UTF-8" },
    });
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
      return env.IMAGE_GENERATOR.fetch(request as any, {
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
    activeTimeMs: 0,
    lastActiveAt: null,
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
