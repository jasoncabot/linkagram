import './sass/mystyles.scss';

import Linkagram, { LinkagramConfig, LinkagramState } from './scenes/Linkagram';

const parseConfig: () => LinkagramConfig = () => {
    const parameters: URLSearchParams = new URLSearchParams(window.location.search);

    let shouldRedirect = false;
    if (!parameters.get('id')) {
        const today = new Date();
        // a unique puzzle every day ;)
        const id = [today.getFullYear(), today.getMonth() + 1, today.getDate()].join('');
        parameters.set('id', id);
        shouldRedirect = true;
    }
    if (!parameters.get('width')) {
        parameters.set('width', '4');
        shouldRedirect = true;
    }
    if (!parameters.get('height')) {
        parameters.set('height', '4');
        shouldRedirect = true;
    }
    if (!parameters.get('dict')) {
        parameters.set('dict', 'wiktionary.json');
        shouldRedirect = true;
    }
    if (shouldRedirect) window.location.search = parameters.toString();

    return {
        size: {
            width: parseInt(parameters.get('width')!, 10),
            height: parseInt(parameters.get('height')!, 10)
        },
        id: parseInt(parameters.get('id')!, 10),
        dictionary: parameters.get('dict')!,
        frequencies: 'letters.json'
    };
}

const loadState: (config: LinkagramConfig) => (LinkagramState) = (config: LinkagramConfig) => {
    // seed the random generator based on (id, words, letters, width, height) as a change in any will cause the available words to be different
    const key = `${config.id},${config.dictionary},${config.frequencies},${config.size.width},${config.size.height}`;

    const accountKey = (type: string) => { return type };
    const gameKey = (type: string) => { return `${key}.${type}` };

    // store our progress keyed by game id
    const wordsAlreadyFound: string[] = JSON.parse(localStorage.getItem(gameKey("words")) || "[]");

    // Read and parse hints from storage
    const hints: Map<string, Set<number>> = new Map();
    const savedHints: any = JSON.parse(localStorage.getItem(gameKey("hints")) || "{}");
    Object.keys(savedHints).forEach(key => {
        const found: number[] = savedHints[key] || [];
        hints.set(key, new Set(found));
    });
    const serialise = (hints: Map<string, Set<number>>) => {
        const object: any = {};
        hints.forEach((indexes, key) => {
            object[key] = Array.from(indexes);
        });
        return JSON.stringify(object);
    }

    const hashCode = (s: string) => {
        var hash = 0, i, chr;
        if (s.length === 0) return hash;
        for (i = 0; i < s.length; i++) {
            chr = s.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    };

    return {
        seed: hashCode(key),
        words: new Set(wordsAlreadyFound),
        hints: hints,
        hintCount: parseInt(localStorage.getItem(accountKey("hints")) || "30", 10),
        revealCount: parseInt(localStorage.getItem(accountKey("reveals")) || "10", 10),
        save: (state: LinkagramState) => {
            localStorage.setItem(gameKey("words"), JSON.stringify(Array.from(state.words)));
            localStorage.setItem(gameKey("hints"), serialise(state.hints));
            localStorage.setItem(accountKey("hints"), JSON.stringify(state.hintCount));
            localStorage.setItem(accountKey("reveals"), JSON.stringify(state.revealCount));
        }
    }
}

const setupHamburger = () => {
    const $navbarBurgers = Array.prototype.slice.call(document.querySelectorAll('.navbar-burger'), 0);
    if ($navbarBurgers.length > 0) {
        $navbarBurgers.forEach(el => {
            el.addEventListener('click', () => {
                const target = el.dataset.target;
                const $target = document.getElementById(target);
                el.classList.toggle('is-active');
                $target?.classList.toggle('is-active');
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // start running game
    const config = parseConfig();
    const linkagram = new Linkagram(config, loadState(config));
    linkagram.run();

    (document as any).linkagram = linkagram;

    setupHamburger();
});
