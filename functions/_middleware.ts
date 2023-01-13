import letterDistribution from "./../public/data/letters.json";
import smallWords from "./../public/data/small.json";
import { hashCode } from "./../src/hash";
import Linkagram from "./../src/scenes/Linkagram";

export interface Env {
  IMAGE_GENERATOR: Fetcher;
  ASSETS: any;
  APPLE_PAY_PROXY: string;
  MERCH_IDENTITY_CERT: any;
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
    return context.env.IMAGE_GENERATOR.fetch(context.request, {
      method: 'POST',
      body: JSON.stringify(letters)
    });
  } else if (pathname === "/pay") {
    return tryApplePay(request, env);
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

const tryApplePay = async (request: Request, env: Env) => {
  const validAppleVerificationDomains = new Set<string>([
    "apple-pay-gateway.apple.com",
    "cn-apple-pay-gateway.apple.com",
    "apple-pay-gateway-nc-pod1.apple.com",
    "apple-pay-gateway-nc-pod2.apple.com",
    "apple-pay-gateway-nc-pod3.apple.com",
    "apple-pay-gateway-nc-pod4.apple.com",
    "apple-pay-gateway-nc-pod5.apple.com",
    "apple-pay-gateway-pr-pod1.apple.com",
    "apple-pay-gateway-pr-pod2.apple.com",
    "apple-pay-gateway-pr-pod3.apple.com",
    "apple-pay-gateway-pr-pod4.apple.com",
    "apple-pay-gateway-pr-pod5.apple.com",
    "cn-apple-pay-gateway-sh-pod1.apple.com",
    "cn-apple-pay-gateway-sh-pod2.apple.com",
    "cn-apple-pay-gateway-sh-pod3.apple.com",
    "cn-apple-pay-gateway-tj-pod1.apple.com",
    "cn-apple-pay-gateway-tj-pod2.apple.com",
    "cn-apple-pay-gateway-tj-pod3.apple.com",
    "apple-pay-gateway-cert.apple.com",
    "cn-apple-pay-gateway-cert.apple.com"
  ]);

  const { searchParams } = new URL(request.url);

  const rawValidationURL = searchParams.get('validationURL') || "";
  const validationURL = new URL(decodeURIComponent(rawValidationURL));
  if (!validationURL || !validAppleVerificationDomains.has(validationURL.host)) {
    return new Response(null, { status: 400 });
  }

  return fetch(`${env.APPLE_PAY_PROXY}?validationURL=${rawValidationURL}`, { method: 'POST' });
  // // sooooon https://blog.cloudflare.com/mutual-tls-for-workers/
  // const url = validationURL;
  // return env.MERCH_IDENTITY_CERT.fetch(url, {
  //   body: JSON.stringify({
  //     merchantIdentifier: "merchant.com.jasoncabot.linkagram",
  //     displayName: "Linkagram",
  //     initiative: "web",
  //     initiativeContext: "linkagram.jasoncabot.me"
  //   }),
  //   method: 'POST',
  //   headers: {
  //     'content-type': 'application/json;charset=UTF-8',
  //   },
  // });  
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
