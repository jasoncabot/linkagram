import './sass/mystyles.scss';

import Linkagram, { LinkagramConfig } from './scenes/Linkagram';

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
    if (shouldRedirect) window.location.search = parameters.toString();

    return {
        size: {
            width: parseInt(parameters.get('width')!, 10),
            height: parseInt(parameters.get('height')!, 10)
        },
        id: parseInt(parameters.get('id')!, 10),
        dictionary: 'words.json',
        words: 'letters.json'
    };
}

const loadState = (config: LinkagramConfig) => {
    // seed the random generator based on (id, words, letters, width, height) as a change in any will cause the available words to be different
    const key = `${config.id},${config.dictionary},${config.words},${config.size.width},${config.size.height}`;

    // store our progress keyed by game id
    const wordsAlreadyFound: string[] = JSON.parse(localStorage.getItem(key) || "[]");

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
        save: (found: Set<string>) => {
            const toSave = Array.from(found);
            localStorage.setItem(key, JSON.stringify(toSave));
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
    new Linkagram(config, loadState(config)).run();

    setupHamburger();
});
