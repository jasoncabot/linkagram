import { buildTrie, isPrefix, isWord, TrieNode } from '../trie';
import { celebrate } from "../confetti";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { keyForDate, keyForToday } from '../key';

interface LetterTile {
    index: number,
    value: string,
    links: LetterTile[]
}

interface WordList {
    byLength: { [key: number]: string[] }
    words: Set<string>
}

interface RandomDataGenerator {
    pick(numbers: number[]): number
    weightedPick(letters: string[], count: number): string[]
}

enum FlashState {
    Valid = 'valid',
    Invalid = 'invalid',
    AlreadyFound = 'found'
}

interface LinkagramConfig {
    id: number
    size: { width: number, height: number }
    dictionary: string
    frequencies: string
}

interface LinkagramState {
    seed: number
    words: Set<string>
    hints: Map<string, Set<number>>
    startedAt: Date,
    finishedAt: Date | null,
    hintCount: number
    played: string[]
    completed: string[]
    streak: number
    maxStreak: number
    save: (state: LinkagramState) => (void)
    purge: () => (void)
}

const buildMulberry32 = (seed: number) => {
    return () => {
        var t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

export default class Linkagram {
    generator: RandomDataGenerator;
    selectedIndexes: number[]
    hoverIndex: number | undefined;
    highlightedIndexes: Set<number>
    tiles: LetterTile[]
    letterButtons: HTMLElement[];
    wordsFoundButton: any;
    wordList: WordList
    config: LinkagramConfig;
    wordListPopup: any | undefined;
    state: LinkagramState;
    stripe: Stripe | null;
    currentModals: HTMLElement[];

    constructor(data: LinkagramConfig, state: LinkagramState) {
        this.selectedIndexes = [];
        this.highlightedIndexes = new Set();
        this.letterButtons = [];
        this.tiles = [];
        this.wordList = {
            byLength: [],
            words: new Set()
        };
        this.state = state;
        this.config = data;
        this.stripe = null;
        this.currentModals = [];

        const prng = buildMulberry32(state.seed);
        this.generator = {
            pick: (array) => {
                return array[Math.floor(prng() * array.length)];
            },
            weightedPick: (letters, count) => {
                const weightedArray: string[] = [];
                letters.forEach((letter, i) => {
                    let numberOfTimes = 0;
                    if (i < 12) {
                        numberOfTimes = 7;
                    } else if (i < 20) {
                        numberOfTimes = 3;
                    } else if (i < 23) {
                        numberOfTimes = 2;
                    } else {
                        numberOfTimes = 1;
                    }
                    for (let count = 0; count < numberOfTimes; count++) {
                        weightedArray.push(letter);
                    }
                })

                // Shuffle the weighted array 
                let currentIndex = weightedArray.length;
                let randomIndex = 0;
                while (currentIndex != 0) {
                    randomIndex = Math.floor(prng() * currentIndex);
                    currentIndex--;

                    // And swap it with the current element.
                    [weightedArray[currentIndex], weightedArray[randomIndex]] = [
                        weightedArray[randomIndex], weightedArray[currentIndex]];
                }

                // pick the first elements up to however many we want to take
                return weightedArray.slice(0, count);
            }
        }
    }

    buildTiles = (board: { width: number; height: number; }, frequencies: string[]) => {
        const numberOfTiles = board.width * board.height;
        const tiles: LetterTile[] = [];

        const key = keyForToday();
        const specials: Record<string, string[]> = {
            '2023731': "knvehinrparspyta".split(''), // 🐰 🥚 ❤️
            '20231113': "vbikeosrlptdpyah".split(''), // 🎂
        };
        const values = specials[key] ?? this.generator.weightedPick(frequencies, numberOfTiles);
        for (let x = 0; x < numberOfTiles; x++) {
            tiles.push({
                index: x,
                value: values[x],
                links: []
            });
        }
        // generate links between letters
        // for each tile, set the links
        /*
          0  1  2  3
          4  5  6  7
          8  9 10 11
         12 13 14 15
        */
        for (let x = 0; x < numberOfTiles; x++) {

            // generate all surrounding indexes
            let indexes = [
                (x - board.width) - 1, x - board.width, (x - board.width) + 1,
                x - 1, x, x + 1,
                (x + board.width) - 1, (x + board.width), (x + board.width) + 1];

            // if it's blocked by being out of bounds or against a wall
            // then the tiles aren't linked
            tiles[x].links = indexes.filter((linkIndex, idx) => {
                return !(linkIndex == x
                    || linkIndex < 0
                    || linkIndex > (numberOfTiles - 1)
                    || (x % board.width == 0 && idx % 3 == 0) // left column
                    || ((x + 1) % board.width == 0 && (idx + 1) % 3 == 0) // right column
                    || (x < (board.width - 1) && idx < 3) // top row
                    || (x > (numberOfTiles - (board.width + 1)) && idx > 5)); // bottom row
            }).map(i => tiles[i]); // convert to reference to another tile
        }
        return tiles;
    }

    initialise = (words: string[], frequencies: string[]) => {
        const trie = buildTrie(words);

        // generate random letters
        this.tiles = this.buildTiles(this.config.size, frequencies);

        // Find all the words you should be able to get
        this.wordList.words = this.findAllWords(this.tiles, trie);
        this.wordList.words.forEach(word => {
            let arr = this.wordList.byLength[word.length] || [];
            arr.push(word);
            this.wordList.byLength[word.length] = arr;
        });
        Object.keys(this.wordList.byLength).forEach(k => this.wordList.byLength[parseInt(k, 10)].sort());
    }

    showModal = (id: string) => {
        return (e: Event) => {
            e.preventDefault();
            const modal = document.getElementById(id);
            if (!modal) return;
            modal.classList.add('is-active');

            this.clearSelection();

            this.currentModals.push(modal);
            this.currentModals.forEach((m, i) => m.style.zIndex = (i*100).toString());
        };
    }

    hideModal = (id: string) => {
        return (e: Event) => {
            e.preventDefault();
            const modal = document.getElementById(id);
            if (!modal) return;
            modal.classList.remove('is-active');
            this.currentModals = this.currentModals.filter(m => m != modal);
        };
    }

    run = async () => {

        const [wordsResponse, frequenciesResponse] = await Promise.all([
            fetch("/data/" + this.config.dictionary),
            fetch("/data/" + this.config.frequencies)
        ]);

        const words = await wordsResponse.json();
        const frequencies = await frequenciesResponse.json();
        this.initialise(words, frequencies);

        const updateTileSelection = (x: number, y: number, submit: boolean) => {
            const letter = document.elementFromPoint(x, y) as HTMLElement;
            if (letter && letter.dataset.index) {
                const index = parseInt(letter.dataset.index, 10);
                const tile = this.tiles[index];
                this.onTileSelected(tile, submit);
            }
            const currentWord = document.getElementById("current-word")!
            currentWord.style.left = (x - (currentWord.clientWidth / 2)).toString() + 'px';
            currentWord.style.top = (y - 90).toString() + 'px';
            return letter;
        }

        // Draw the letters
        const board = document.getElementById("board")?.children[0] as HTMLElement;
        let firstTile: HTMLElement | undefined;
        let selectedNewLetter = true;
        board.addEventListener('pointerdown', (e: PointerEvent) => {
            e.preventDefault();
            const letter = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
            const index = parseInt(letter.dataset.index!, 10);
            // if this letter has already been picked previously 
            selectedNewLetter = (this.selectedIndexes.find(i => i === index) === undefined);
            firstTile = updateTileSelection(e.clientX, e.clientY, false);
        });
        board.addEventListener('pointermove', (e: PointerEvent) => {
            e.preventDefault();
            if (e.buttons) {
                updateTileSelection(e.clientX, e.clientY, false);
            }
        });
        board.addEventListener('pointerup', (e: PointerEvent) => {
            e.preventDefault();
            const letter = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
            // if we lifted up on a different letter, no letter or a previously selected letter
            if (!letter || letter != firstTile || !selectedNewLetter) {
                // submit it
                this.submitWord();
            } else {
                // otherwise highlight it
                const index = parseInt(letter.dataset.index!, 10);
                const tile = this.tiles[index];

                // if this index is also our last
                this.onTileSelected(tile, !selectedNewLetter);
            }
        });

        this.letterButtons = this.tiles.map(tile => {
            const rowIndex = Math.floor(tile.index / this.config.size.width);

            let row = board?.children[rowIndex];
            if (!row) {
                row = document.createElement("tr");
                row.classList.add("board-row");
                board?.appendChild(row);
            }

            const tableCell = document.createElement("td");
            tableCell.classList.add('is-unselectable');
            tableCell.innerHTML = `<div class="is-flex is-justify-content-center is-align-content-center"><a class="letter is-clickable is-uppercase">${tile.value}</a></div>`;
            row?.appendChild(tableCell);

            const letter = tableCell.children[0].children[0] as HTMLElement;
            letter.dataset.value = tile.value;
            letter.dataset.index = tile.index.toString();
            return letter;
        });

        document.getElementById("total-found")?.addEventListener('click', this.showModal('wordlist-modal'));
        document.getElementById("wordlist-modal-close")?.addEventListener('click', this.hideModal('wordlist-modal'));
        document.getElementById("wordlist-modal-background")?.addEventListener('click', this.hideModal('wordlist-modal'));

        document.getElementById("hints-modal-close")?.addEventListener('click', this.hideModal('hints-modal'));
        document.getElementById("hints-modal-background")?.addEventListener('click', this.hideModal('hints-modal'));

        document.getElementById("show-hints")?.addEventListener('click', this.showHintModal);

        document.getElementById("how-to-play-button")?.addEventListener('click', this.showModal('how-to-play-modal'));
        document.getElementById("how-to-play-modal-close")?.addEventListener('click', this.hideModal('how-to-play-modal'));
        document.getElementById("how-to-play-modal-close-ok")?.addEventListener('click', this.hideModal('how-to-play-modal'));
        document.getElementById("how-to-play-modal-background")?.addEventListener('click', this.hideModal('how-to-play-modal'));

        document.getElementById("stats-button")?.addEventListener('click', this.showModal('stats-modal'));
        document.getElementById("stats-modal-close")?.addEventListener('click', this.hideModal('stats-modal'));
        document.getElementById("stats-modal-background")?.addEventListener('click', this.hideModal('stats-modal'));

        document.getElementById("share-button")?.addEventListener('click', async () => {
            try {
                if (!navigator.share) return;

                // if you've completed it
                let text = `Found ${this.state.words.size} / ${this.wordList.words.size}`;
                if (this.state.words.size === this.wordList.words.size) {

                    const finished = this.state.finishedAt!;
                    const started = this.state.startedAt;

                    const elapsed = (finished.getTime() - started.getTime());

                    const hours = Math.floor((elapsed % 86400000) / 3600000);
                    const minutes = Math.round(((elapsed % 86400000) % 3600000) / 60000);

                    let hintsUsed = 0;
                    this.state.hints.forEach((hints, _word) => {
                        hintsUsed += hints.size;
                    })

                    const lines = [
                        `⌛ ${hours}h ${minutes}m`,
                        `💡 ${hintsUsed} ${(hintsUsed == 1) ? "hint" : "hints"}`
                    ];
                    if (this.state.streak > 2) {
                        // add another fire for every 100 days
                        const fires = Array(Math.floor(this.state.streak / 100) + 1).fill("🔥").join('');
                        lines.push(`${fires} ${this.state.streak}`);
                    }
                    text = lines.join('\n');
                }

                await navigator.share({
                    title: 'Linkagram',
                    text: text,
                    url: document.URL
                });
            } catch (error) {
                console.warn(error);
            }
        });

        this.onWordListUpdated();
        this.onSelectionChanged();
        this.clearSelection();
        this.onGameStarted();
    }

    onTileSelected = (tile: LetterTile | undefined, submit: boolean) => {
        const lastIndex = this.selectedIndexes[this.selectedIndexes.length - 1];
        if (tile?.index == lastIndex) {
            if (submit) {
                this.submitWord();
            }
        } else if (tile && this.selectedIndexes.length == 0) {
            this.addTileToSelection(tile);
        } else if (tile) {
            // if this index is touching the last one
            const touching = tile.links.find(link => link.index === lastIndex) !== undefined;
            const alreadySelected = this.selectedIndexes.find(idx => idx === tile.index) !== undefined;
            if (touching && !alreadySelected) {
                this.addTileToSelection(tile);
            } else if (!touching) {
                this.clearSelection();
                this.addTileToSelection(tile);
            } else {
                this.clearSelection();
            }
        }
        this.onSelectionChanged();
    }

    submitWord = () => {
        const word: string = this.selectedIndexes.map(i => this.tiles[i].value).join('');
        const buttons: HTMLElement[] = this.selectedIndexes.map(i => this.letterButtons[i]);

        if (this.state.words.has(word)) {
            this.flashButtons(buttons, FlashState.AlreadyFound);
        } else if (this.wordList.words.has(word)) {
            this.onWordRevealed(word);
            this.state.save(this.state);
            this.flashButtons(buttons, FlashState.Valid);
            this.onWordListUpdated();
        } else {
            this.flashButtons(buttons, FlashState.Invalid);
        }
        this.clearSelection();
    }

    wordListAsHTML = () => {
        const sections = Object.keys(this.wordList.byLength).sort().map((length: string) => {
            const words = this.wordList.byLength[parseInt(length)].map(word => {
                if (this.state.words.has(word)) {
                    return `<li class="is-unselectable"><a class="is-family-monospace" onclick="document.linkagram.define('${word}')">${word}</a></li>`
                } else {
                    const revealedIndexes = this.state.hints.get(word) || new Set();
                    const stillToGuess = Array(word.length)
                        .fill("_")
                        .map((placeholder, idx) => revealedIndexes.has(idx) ? word.charAt(idx) : placeholder)
                        .join(" ");
                    return `<li class="is-unselectable"><a class="is-family-monospace" onclick="document.linkagram.hint('${word}')">${stillToGuess}</a></li>`
                }
            }).join('');
            return `<p class="menu-label">${length} letters</p><ol class="menu-list">${words}</ol></p>`;
        });
        const hintsLeft = this.state.hintCount;
        return `<aside class="menu"><div><a onclick="document.linkagram.showHintModal()">${hintsLeft} ${hintsLeft === 1 ? "hint" : "hints"} remaining</a></div>${sections.join('')}</aside>`;
    }

    increaseAvailableHints = (count: number) => {
        this.state.hintCount += count;
        this.state.save(this.state);
        this.onWordListUpdated();
    }

    showHintModal = async (event: Event | undefined) => {
        document.getElementById('hint-count')!.innerText = this.state.hintCount.toString();
        this.showModal("hints-modal")(event || new Event("hint"));

        const onPaymentComplete = () => {
            this.increaseAvailableHints(12);
            document.getElementById("hints-modal")?.classList.remove('is-active')
        }

        const onPaymentError = (err: any) => {
            document.getElementById('payment-request-loading')?.classList.remove('is-hidden');
            document.getElementById('payment-request-loading')?.classList.remove('is-loading');
            console.error(err);    
        }

        if (!this.stripe) {
            onPaymentError(new Error("unable to load stripe"));
            return;
        };

        const stripe = this.stripe;

        const paymentRequest = stripe.paymentRequest({
            country: 'GB',
            currency: 'gbp',
            total: {
                label: '12 linkagram hints',
                amount: 99,
            }
        });

        const elements = stripe.elements();
        const prButton = elements.create('paymentRequestButton', {
            paymentRequest,
        });

        (async () => {
            document.getElementById('payment-request-loading')?.classList.remove('is-hidden');
            document.getElementById('payment-request-loading')?.classList.add('is-loading');
            const result = await paymentRequest.canMakePayment();
            if (result) {
                prButton.mount('#payment-request-button');
                document.getElementById('payment-request-loading')?.classList.add('is-hidden');
            } else {
                document.getElementById('payment-request-button')?.classList.add('is-hidden');
            }
        })();

        try {
            const response = await fetch(`/hint_payment`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json;charset=UTF-8',
                },
            });
            const clientSecretResponse = await response.json();
            const clientSecret = clientSecretResponse.secret;

            paymentRequest.on('paymentmethod', async (ev) => {
                try {
                    const { paymentIntent, error: confirmError } = await stripe.confirmCardPayment(
                        clientSecret,
                        { payment_method: ev.paymentMethod.id },
                        { handleActions: false }
                    );

                    if (confirmError) {
                        ev.complete('fail');
                    } else {
                        ev.complete('success');
                        if (paymentIntent.status === "requires_action") {
                            const { error } = await stripe.confirmCardPayment(clientSecret);
                            if (!error) {
                            } else {
                                onPaymentComplete();
                            }
                        } else {
                            onPaymentComplete();
                        }
                    }
                } catch (err) {
                    onPaymentError(err);
                }
            });
        } catch (err) {
            onPaymentError(err);
        }
    }

    hint = async (word: string) => {
        if (this.state.hintCount === 0) {
            this.showHintModal(undefined);
            return;
        }

        // use our hint
        this.state.hintCount -= 1;

        const set = this.state.hints.get(word) || new Set();
        const potentials = Array(word.length).fill(0).map((_, idx) => idx).filter(i => !set.has(i));
        set.add(this.generator.pick(potentials));
        this.state.hints.set(word, set);

        // if this hint would reveal the word
        if (potentials.length == 1) {
            this.onWordRevealed(word);
        }
        this.state.save(this.state);
        this.onWordListUpdated();
    }

    define = async (word: string) => {
        try {
            const result = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
            const entry = await result.json() as [{
                word: string
                meanings: [
                    { definitions: [{ definition: string }] }
                ]
            }];

            const definition = entry[0]?.meanings[0]?.definitions[0]?.definition;
            if (definition) {
                alert(word + "\n\n" + definition);
            }

        } catch (err) {
            console.log('Unable to find definition of ' + word);
        }
    }

    flashButtons = (buttons: HTMLElement[], state: FlashState) => {
        buttons.forEach(button => button.classList.add(state.valueOf()));
        setTimeout(() => {
            buttons.forEach(button => button.classList.remove(state.valueOf()));
        }, 250);
    }

    onWordListUpdated = () => {
        const found = this?.state.words.size;
        const total = this?.wordList.words.size;
        const totalFound = document.getElementById("total-found");
        totalFound!.innerText = `${found} / ${total}`;
        const wordlist = document.getElementById('wordlist')!;
        wordlist.innerHTML = this.wordListAsHTML();
        const wordlistModal = document.getElementById('wordlist-modal-content')!;
        wordlistModal.innerHTML = wordlist.innerHTML;

        if (found === total) {
            this.onGameEnded();
        }
    }

    onGameStarted = async () => {
        const key = keyForToday();

        // if we haven't played this game before
        // we don't just look at the last element as you might play different
        // games (by modifying the URL)
        let showHowToPlay = false;
        if (!this.state.played.includes(key)) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdaysKey = keyForDate(yesterday);

            // have we ever played before?
            if (this.state.played.length == 0) {
                showHowToPlay = true;
            }

            // increase how many games we have played
            this.state.played.push(key);

            // record the time we started this particular board
            this.state.startedAt = new Date();

            // if we didn't complete yesterdays puzzle
            if (!this.state.completed.includes(yesterdaysKey)) {
                // soz no streak for you
                this.state.streak = 0;
            }

            // go on then, have a minimum number of hints each day
            this.state.hintCount = Math.max(this.state.hintCount, 4);

            this.state.save(this.state);

            this.onWordListUpdated();
        }

        this.onStatsUpdated();

        if (showHowToPlay) {
            this.showModal('how-to-play-modal')(new Event("onGameEnded"))
        }

        const stripeKey: string = "pk_live_51MQ4wTDjdwEKhnhgi8jlWuTSTjrokSs6lBqHIFP9O6c7Sot00xW54LRCXprU1v2ToVuAoTnvr5gdOWG0jRKAyrZn00pWtSmzKq";
        this.stripe = await loadStripe(stripeKey, { apiVersion: "2022-11-15" });
    }

    onGameEnded = () => {
        const key = keyForToday();

        // if we haven't already recorded the fact we completed this game then do it now
        if (!this.state.completed.includes(key)) {
            this.state.finishedAt = new Date();
            this.state.completed.push(key);
            this.state.streak += 1;
            if (this.state.streak > this.state.maxStreak) {
                this.state.maxStreak = this.state.streak;
            }
            this.state.purge();
            this.state.save(this.state);
        }
        this.onStatsUpdated();
        celebrate(() => (this.showModal('stats-modal')(new Event("onGameEnded"))));
    }

    onWordRevealed = (word: string) => {
        this.state.words.add(word);
    }

    onStatsUpdated = () => {
        const setState = (name: string, value: number) => {
            const e = document.getElementById(name);
            if (!e) return;
            e.innerText = value.toString();
        }
        setState('stats-played', this.state.played.length);
        setState('stats-completed', this.state.completed.length);
        setState('stats-streak', this.state.streak);
        setState('stats-max-streak', this.state.maxStreak);
    }

    addTileToSelection = (tile: LetterTile) => {
        const previous: HTMLElement | undefined = this.selectedIndexes.length === 0 ? undefined : this.letterButtons[this.selectedIndexes[this.selectedIndexes.length - 1]];
        const next = this.letterButtons[tile.index];

        this.selectedIndexes.push(tile.index);

        if (previous) {
            // draw an arrow linking previous to next
            const svg = document.getElementById("connections")!;
            let arrow = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            arrow.classList.add('connection');
            const x1 = (previous.getBoundingClientRect().x) + (previous.getBoundingClientRect().width / 2);
            const x2 = (next.getBoundingClientRect().x + (previous.getBoundingClientRect().width / 2));
            const y1 = (previous.getBoundingClientRect().y) + (previous.getBoundingClientRect().height / 2);
            const y2 = (next.getBoundingClientRect().y + (previous.getBoundingClientRect().height / 2));
            arrow.setAttribute('stroke', 'hsl(171, 100%, 41%)');
            arrow.setAttribute('stroke-width', '6px');
            arrow.setAttribute('x1', ((x1 / svg.clientWidth) * 100) + "%");
            arrow.setAttribute('y1', ((y1 / svg.clientHeight) * 100) + "%");
            arrow.setAttribute('x2', ((x2 / svg.clientWidth) * 100) + "%");
            arrow.setAttribute('y2', ((y2 / svg.clientHeight) * 100) + "%");
            svg?.appendChild(arrow);
        }

        // highlight every letter touching this last one
        this.highlightedIndexes.clear();
        tile.links.forEach(t => this.highlightedIndexes.add(t.index));

        const word = this.selectedIndexes.map(i => this.tiles[i].value).join('');
        const currentWord = document.getElementById("current-word")!
        currentWord.innerText = word;
        currentWord.classList.add('has-word');
    }

    clearSelection = () => {
        const svg = document.getElementById("connections");
        svg!.innerHTML = ``;
        this.selectedIndexes = [];
        this.highlightedIndexes.clear();
        const currentWord = document.getElementById("current-word")!
        currentWord.innerText = '';
        currentWord.classList.remove('has-word');
        this.onSelectionChanged();
    }

    onSelectionChanged = () => {
        // go through each letter
        // make sure it's in the right state based on the selectedIndexes, highlightedIndexes
        this.letterButtons.forEach((button, idx) => {
            const selected: boolean = this.selectedIndexes.find(i => i === idx) !== undefined;
            const highlighted: boolean = this.highlightedIndexes.has(idx) || this.selectedIndexes.length === 0;

            button.classList.remove('selected', 'highlighted');
            if (selected) {
                button.classList.add('selected');
            } else if (highlighted) {
                button.classList.add('highlighted');
            }
        });
    }

    findAllWords = (tiles: LetterTile[], trie: TrieNode) => {

        interface LetterNode {
            index: number
            value: string
            visited: Set<number>
        }

        let toExplore: LetterNode[] = tiles.map(l => {
            return {
                index: l.index,
                value: '',
                visited: new Set()
            }
        });

        let allWords = new Set<string>();
        while (toExplore.length > 0) {

            const node = toExplore.pop()!;

            if (isWord(trie, node.value)) {
                allWords.add(node.value);
            }

            if (!isPrefix(trie, node.value)) {
                continue;
            }

            tiles[node.index].links.map(l => {
                if (node.visited.has(l.index)) return undefined;
                let updated = new Set(node.visited);
                updated.add(l.index);
                return {
                    index: l.index,
                    value: node.value + l.value,
                    visited: updated
                }
            }).filter(n => !!n).forEach(child => toExplore.push(child!));
        }

        return allWords;
    }
}

export type { LinkagramState, LinkagramConfig };
