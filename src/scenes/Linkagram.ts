import { buildTrie, isPrefix, isWord, TrieNode } from '../trie';

interface LetterTile {
    index: number,
    value: string,
    links: LetterTile[]
}

interface WordList {
    byLength: { [key: number]: string[] }
    words: Set<string>
    found: Set<string>
}

interface RandomDataGenerator {
    weightedPick(letters: string[]): string
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
    save: (found: Set<string>) => (void)
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

    constructor(data: LinkagramConfig, state: LinkagramState) {
        this.selectedIndexes = [];
        this.highlightedIndexes = new Set();
        this.letterButtons = [];
        this.tiles = [];
        this.wordList = {
            byLength: [],
            words: new Set(),
            found: new Set()
        };
        this.state = state;
        this.config = data;

        const prng = buildMulberry32(state.seed);
        this.generator = {
            weightedPick: (letters) => {
                return letters[~~(Math.pow(prng(), 2) * letters.length)];
            }
        }
    }

    buildTiles = (board: { width: number; height: number; }, frequencies: string[]) => {
        const numberOfTiles = board.width * board.height;
        const tiles: LetterTile[] = [];
        for (let x = 0; x < numberOfTiles; x++) {
            tiles.push({
                index: x,
                value: this.generator.weightedPick(frequencies),
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

    run = async () => {

        const [wordsResponse, frequenciesResponse] = await Promise.all([
            fetch("/data/" + this.config.dictionary),
            fetch("/data/" + this.config.frequencies)
        ]);
        const words = await wordsResponse.json();
        const frequencies = await frequenciesResponse.json();
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

        // Add any words we have already found
        this.state.words.forEach(word => this.wordList.found.add(word));

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
            tableCell.innerHTML = `<div class="is-flex is-justify-content-center is-align-content-center"><a class="letter is-clickable">${tile.value}</a></div>`;
            row?.appendChild(tableCell);

            const letter = tableCell.children[0].children[0] as HTMLElement;
            letter.dataset.value = tile.value;
            letter.dataset.index = tile.index.toString();
            return letter;
        });

        const showWordList = (e: PointerEvent) => {
            e.preventDefault();
            document.getElementById('wordlist-modal')?.classList.add('is-active');
        };
        const hideWordList = (e: PointerEvent) => {
            e.preventDefault();
            document.getElementById('wordlist-modal')?.classList.remove('is-active');
        };
        document.getElementById("total-found")?.addEventListener('pointerdown', showWordList);
        document.getElementById("wordlist-modal-close")?.addEventListener('pointerdown', hideWordList);
        document.getElementById("wordlist-modal-background")?.addEventListener('pointerdown', hideWordList);

        this.onWordListUpdated();
        this.onSelectionChanged();
        this.clearSelection();
    }

    onTileSelected = (tile: LetterTile, submit: boolean) => {
        const lastIndex = this.selectedIndexes[this.selectedIndexes.length - 1];
        if (tile.index == lastIndex) {
            if (submit) {
                this.submitWord();
            }
        } else if (this.selectedIndexes.length == 0) {
            this.addTileToSelection(tile);
        } else {
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

        if (this.wordList.found.has(word)) {
            this.flashButtons(buttons, FlashState.AlreadyFound);
        } else if (this.wordList.words.has(word)) {
            this.wordList.found.add(word);
            this.state.save(this.wordList.found);
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
                if (this.wordList.found.has(word)) {
                    return `<li><a>${word}</a></li>`;
                } else {
                    // when we have hints we can fill individual letters in
                    const stillToGuess = "_ ".repeat(word.length).trim();
                    return `<li><a>${stillToGuess}</a></li>`
                }
            }).join('');
            return `<p class="menu-label">${length} letters</p><ol class="menu-list">${words}</ol></p>`;
        });
        return `<aside class="menu">${sections.join('')}</aside>`;
    }

    flashButtons = (buttons: HTMLElement[], state: FlashState) => {
        buttons.forEach(button => button.classList.add(state.valueOf()));
        setTimeout(() => {
            buttons.forEach(button => button.classList.remove(state.valueOf()));
        }, 250);
    }

    onWordListUpdated = () => {
        const found = this?.wordList.found.size;
        const total = this?.wordList.words.size;
        const totalFound = document.getElementById("total-found");
        totalFound!.innerText = `${found} / ${total}`;
        const wordlist = document.getElementById('wordlist')!;
        wordlist.innerHTML = this.wordListAsHTML();
        const wordlistModal = document.getElementById('wordlist-modal-content')!;
        wordlistModal.innerHTML = wordlist.innerHTML;
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