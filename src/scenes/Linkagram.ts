import words from './../data/words.json';
import letterFrequencies from './../data/letters.json';
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
    dictionaryPath: string
    frequenciesPath: string
}

interface RandomDataGenerator {
    weightedPick(letters: string[]): string
}

enum FlashState {
    Valid = 'warning',
    Invalid = 'danger',
    AlreadyFound = 'info'
}

const buildMulberry32 = (seed: number) => {
    return () => {
        var t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
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

export default class Linkagram {
    generator: RandomDataGenerator;
    selectedIndexes: number[]
    hoverIndex: number | undefined;
    highlightedIndexes: Set<number>
    letterButtons: HTMLElement[];
    wordsFoundButton: any;
    wordList: WordList
    board: { w: number; h: number; };
    wordListPopup: any | undefined;

    constructor(data: any) {
        this.selectedIndexes = [];
        this.highlightedIndexes = new Set();
        this.letterButtons = [];
        // TODO: make the dictionary / frequencies work again
        this.wordList = {
            byLength: [],
            words: new Set(),
            found: new Set(),
            dictionaryPath: data.dictionary || 'assets/words.json',
            frequenciesPath: data.words || 'assets/letters.json'
        };

        this.board = { w: data.size!.width, h: data.size!.height };
        let gameId = data.id;
        // seed the random generator based on (id, words, letters, width, height) as a change in any will cause the available words to be different
        let gameKey = `${gameId},${this.wordList.dictionaryPath},${this.wordList.frequenciesPath},${this.board.w},${this.board.h}`;

        const prng = buildMulberry32(hashCode(gameKey));
        this.generator = {
            weightedPick: (letters) => {
                return letters[Math.floor(prng() * letters.length)];
            }
        }
    }

    buildTiles = (board: { w: number; h: number; }) => {
        const numberOfTiles = board.w * board.h;
        const tiles: LetterTile[] = [];
        for (let x = 0; x < numberOfTiles; x++) {
            tiles.push({
                index: x,
                value: this.generator.weightedPick(letterFrequencies),
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
                (x - board.w) - 1, x - board.w, (x - board.w) + 1,
                x - 1, x, x + 1,
                (x + board.w) - 1, (x + board.w), (x + board.w) + 1];

            // if it's blocked by being out of bounds or against a wall
            // then the tiles aren't linked
            tiles[x].links = indexes.filter((linkIndex, idx) => {
                return !(linkIndex == x 
                    || linkIndex < 0 
                    || linkIndex > (numberOfTiles - 1)
                    || (x % board.w == 0 && idx % 3 == 0) // left column
                    || ((x + 1) % board.w == 0 && (idx + 1) % 3 == 0) // right column
                    || (x < (board.w - 1) && idx < 3) // top row
                    || (x > (numberOfTiles - (board.w + 1)) && idx > 5)); // bottom row
            }).map(i => tiles[i]); // convert to reference to another tile
        }
        return tiles;
    }

    run = () => {
        const trie = buildTrie(words);

        // generate random letters
        const tiles: LetterTile[] = this.buildTiles(this.board);

        // Find all the words you should be able to get
        this.wordList.words = this.findAllWords(tiles, trie);
        this.wordList.words.forEach(word => {
            let arr = this.wordList.byLength[word.length] || [];
            arr.push(word);
            this.wordList.byLength[word.length] = arr;
        });
        Object.keys(this.wordList.byLength).forEach(k => this.wordList.byLength[parseInt(k, 10)].sort());

        // Draw the letters
        const board = document.getElementById("board")?.children[0];
        this.letterButtons = tiles.map(tile => {
            const rowIndex = Math.floor(tile.index / this.board.w);

            let row = board?.children[rowIndex];
            if (!row) {
                row = document.createElement("tr");
                row.classList.add("board-row");
                board?.appendChild(row);
            }

            const letter = document.createElement("td");
            letter.classList.add('letter', 'is-clickable', 'is-unselectable');
            letter.innerHTML = `<div><a>${tile.value}</a></div>`;
            letter.dataset.value = tile.value;
            letter.dataset.linkIndexes = tile.links.map(t => t.index).join(",");
            const handleInteraction = (e: TouchEvent | MouseEvent) => {
                e.preventDefault();
                const lastIndex = this.selectedIndexes[this.selectedIndexes.length - 1];
                if (tile.index == lastIndex) {
                    const word = this.selectedIndexes.map(i => tiles[i].value).join('');
                    const buttons = this.selectedIndexes.map(i => this.letterButtons[i]);
                    this.submitWord(word, buttons);
                    this.clearSelection();
                } else if (this.selectedIndexes.length == 0) {
                    this.addToSelection(tile.index);
                } else {
                    // if this index is touching the last one
                    const touching = tile.links.find(link => link.index === lastIndex);
                    const alreadySelected = this.selectedIndexes.find(idx => idx === tile.index) !== undefined;
                    if (touching && !alreadySelected) {
                        this.addToSelection(tile.index);
                    } else if (!touching) {
                        this.clearSelection();
                        this.addToSelection(tile.index);
                    } else {
                        this.clearSelection();
                    }
                }
                this.onSelectionChanged();
            }
            letter.addEventListener('touchstart', handleInteraction);
            letter.addEventListener('click', handleInteraction);

            row?.appendChild(letter);

            return letter;
        });

        const showWordList = (e: TouchEvent | MouseEvent) => {
            e.preventDefault();
            document.getElementById('wordlist-modal')?.classList.add('is-active');
        };
        const hideWordList = (e: TouchEvent | MouseEvent) => {
            e.preventDefault();
            document.getElementById('wordlist-modal')?.classList.remove('is-active');
        };
        document.getElementById("total-found")?.addEventListener('touchstart', showWordList);
        document.getElementById("total-found")?.addEventListener('click', showWordList);
        document.getElementById("wordlist-modal-close")?.addEventListener('touchstart', hideWordList);
        document.getElementById("wordlist-modal-close")?.addEventListener('click', hideWordList);
        document.getElementById("wordlist-modal-background")?.addEventListener('touchstart', hideWordList);
        document.getElementById("wordlist-modal-background")?.addEventListener('click', hideWordList);

        this.onWordListUpdated();
        this.onSelectionChanged();
    }

    submitWord = (word: string, buttons: HTMLElement[]) => {
        if (this.wordList.found.has(word)) {
            this.flashButtons(buttons, FlashState.AlreadyFound);
        } else if (this.wordList.words.has(word)) {
            this.wordList.found.add(word);
            this.flashButtons(buttons, FlashState.Valid);
            this.onWordListUpdated();
        } else {
            this.flashButtons(buttons, FlashState.Invalid);
        }
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

    addToSelection = (index: number) => {
        const previous: HTMLElement | undefined = this.selectedIndexes.length === 0 ? undefined : this.letterButtons[this.selectedIndexes[0]];
        const next = this.letterButtons[index];

        this.selectedIndexes.push(index);

        if (previous) {
            // TODO: Draw an arrow between previous and next using SVG
            // draw an arrow linking previous to next
            // const svg = document.getElementById("arrow-overlay");
            // let arrow = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            // arrow.classList.add('arrow');
            // arrow.setAttribute('stroke', '#000000');
            // arrow.setAttribute('stroke-width', '1px');
            // arrow.setAttribute('x1', previous.getBoundingClientRect().x.toString());
            // arrow.setAttribute('y1', previous.getBoundingClientRect().y.toString());
            // arrow.setAttribute('x2', next.getBoundingClientRect().x.toString());
            // arrow.setAttribute('y2', next.getBoundingClientRect().y.toString());
            // svg?.appendChild(arrow);
        }

        // highlight every letter touching this last one
        this.highlightedIndexes.clear();
        this.letterButtons[index].dataset.linkIndexes?.split(",").forEach((i: string) => this.highlightedIndexes.add(parseInt(i, 10)));

        const word = this.selectedIndexes.map(i => this.letterButtons[i].dataset.value).join('');
        document.getElementById("current-word")!.innerText = word;
    }

    clearSelection = () => {
        this.selectedIndexes = [];
        this.highlightedIndexes.clear();
        document.getElementById("current-word")!.innerText = "";
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
