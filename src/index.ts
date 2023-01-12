import { hashCode } from './hash';
import './sass/mystyles.scss';

import Linkagram, { LinkagramConfig, LinkagramState } from './scenes/Linkagram';

const parseConfig: () => LinkagramConfig = () => {
    const parameters: URLSearchParams = new URLSearchParams(window.location.search);

    if (!parameters.get('id')) {
        const today = new Date();
        // a unique puzzle every day ;)
        const id = [today.getFullYear(), today.getMonth() + 1, today.getDate()].join('');
        parameters.set('id', id);
    }
    if (!parameters.get('width')) {
        parameters.set('width', '4');
    }
    if (!parameters.get('height')) {
        parameters.set('height', '4');
    }
    if (!parameters.get('dict')) {
        parameters.set('dict', 'small.json');
    }

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
    const startedAtString = localStorage.getItem(gameKey("startedAt"));
    const finishedAtString = localStorage.getItem(gameKey("finishedAt"));
    return {
        seed: hashCode(key),
        words: new Set(wordsAlreadyFound),
        hints: hints,
        startedAt: startedAtString ? new Date(startedAtString) : new Date(),
        finishedAt: finishedAtString ? new Date(finishedAtString) : null,
        hintCount: parseInt(localStorage.getItem(accountKey("hints")) || "30", 10),
        played: JSON.parse(localStorage.getItem(accountKey("played")) || "[]"),
        completed: JSON.parse(localStorage.getItem(accountKey("completed")) || "[]"),
        streak: parseInt(localStorage.getItem(accountKey("streak")) || "0", 10),
        maxStreak: parseInt(localStorage.getItem(accountKey("maxStreak")) || "0", 10),
        save: (state: LinkagramState) => {
            localStorage.setItem(gameKey("words"), JSON.stringify(Array.from(state.words)));
            localStorage.setItem(gameKey("hints"), serialise(state.hints));
            localStorage.setItem(gameKey("startedAt"), state.startedAt.toString());
            if (state.finishedAt) localStorage.setItem(gameKey("finishedAt"), state.finishedAt.toString());
            localStorage.setItem(accountKey("hints"), JSON.stringify(state.hintCount));
            localStorage.setItem(accountKey("played"), JSON.stringify(state.played));
            localStorage.setItem(accountKey("completed"), JSON.stringify(state.completed));
            localStorage.setItem(accountKey("streak"), JSON.stringify(state.streak));
            localStorage.setItem(accountKey("maxStreak"), JSON.stringify(state.maxStreak));
        },
        purge: () => {
            // TODO: clear up old storage
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // start running game
    const config = parseConfig();
    const linkagram = new Linkagram(config, loadState(config));
    linkagram.run();

    (document as any).linkagram = linkagram;
});
