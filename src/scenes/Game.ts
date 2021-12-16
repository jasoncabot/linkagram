import Phaser from 'phaser';
import { buildTrie, isWord, isPrefix, TrieNode } from '../trie';
import WebFontFile from '../WebFontFile';

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

const colours = {
  sage: 0xC9CBA3,
  peach: 0xFFE1A8,
  terracotta: 0xE26D5C,
  catawba: 0x723D46,
  old_burgundy: 0x472D30
}

export default class Game extends Phaser.Scene {
  generator!: Phaser.Math.RandomDataGenerator;
  selectedIndexes!: number[]
  hoverIndex: number | undefined;
  highlightedIndexes!: Set<number>
  letterButtons!: Phaser.GameObjects.Text[];
  currentSelectionText!: Phaser.GameObjects.Text;
  wordsFoundButton!: Phaser.GameObjects.Text;
  wordList!: WordList
  board!: { w: number; h: number; };
  wordListPopup: Phaser.GameObjects.DOMElement | undefined;

  constructor() {
    super('GameScene');
  }

  init(data: any) {
    this.selectedIndexes = [];
    this.highlightedIndexes = new Set();
    this.letterButtons = [];
    this.wordList = {
      byLength: [],
      words: new Set(),
      found: new Set(),
      dictionaryPath: data.dictionary || 'assets/words.json',
      frequenciesPath: data.words || 'assets/letters.json'
    };

    this.board = {
      w: data.size?.width || 4,
      h: data.size?.height || 4
    };

    let gameId = data.id || Phaser.Math.RND.integer();
    // seed the random generator based on (id, words, letters, width, height) as a change in any will cause the available words to be different
    let gameKey = `${gameId},${this.wordList.dictionaryPath},${this.wordList.frequenciesPath},${this.board.w},${this.board.h}`;

    this.generator = new Phaser.Math.RandomDataGenerator([gameKey]);
  }

  preload() {
    this.load.json('words', this.wordList.dictionaryPath);
    this.load.json('letterFrequencies', this.wordList.frequenciesPath);
    this.load.addFile(new WebFontFile(this.load, 'Seaweed Script'));
  }

  create() {
    const words = this.cache.json.get('words');
    const letterFrequencies = this.cache.json.get('letterFrequencies');
    const trie = buildTrie(words);

    const numberOfTiles = this.board.w * this.board.h;

    // generate random letters
    const tiles: LetterTile[] = [];
    for (let x = 0; x < numberOfTiles; x++) {
      tiles.push({
        index: x,
        value: this.generator.weightedPick(letterFrequencies),
        links: []
      });
    }

    // generate links between letters
    /*
      0  1  2  3
      4  5  6  7
      8  9 10 11
     12 13 14 15
    */
    // for each tile, set the links
    const b = this.board;
    for (let x = 0; x < numberOfTiles; x++) {

      // generate all surrounding indexes
      let indexes = [
        x - (1 + b.w), x - (0 + b.w), x - (-1 + b.w),
        x - (1 + 0), x - (0 + 0), x - (-1 + 0),
        x - (1 + -b.w), x - (0 + -b.w), x - (-1 + -b.w)];

      // if it's blocked by being out of bounds or against a wall
      // then the tiles aren't linked
      tiles[x].links = indexes.filter((idx, i) => {
        return !(idx == x || idx < 0 || idx > (numberOfTiles - 1)
          || (x % b.w == 0 && i % 3 == 0) // left column
          || ((x + 1) % b.w == 0 && (i + 1) % 3 == 0) // right column
          || (x < (b.w - 1) && i < 3) // top row
          || (x > (numberOfTiles - (b.w + 1)) && i > 5)); // bottom row
      }).map(i => tiles[i]); // convert to reference to another tile
    }

    // Find all the words you should be able to get
    this.wordList.words = this.findAllWords(tiles, trie);
    this.wordList.words.forEach(word => {
      let arr = this.wordList.byLength[word.length] || [];
      arr.push(word);
      this.wordList.byLength[word.length] = arr;
    });
    Object.keys(this.wordList.byLength).forEach(k => this.wordList.byLength[parseInt(k)].sort());
    console.log(`There are ${this.wordList.words.size} words to find on this board`);

    const font = {
      fontFamily: `"Cutive"`,
      fontSize: '50px'
    };

    // Draw the letters
    this.letterButtons = tiles.map(tile => {
      const x = 50 + ((tile.index % b.w) * 50);
      const y = 100 + Math.floor(tile.index / b.w) * 50;

      const letterButton = this.add.text(x, y, tile.value, font)
        .setOrigin(0.5, 0.5)
        .setInteractive({ useHandCursor: true })
        .setData('value', tile.value)
        .setData('linkIndexes', tile.links.map(t => t.index))
        .on('pointerdown', () => {
          const lastIndex = this.selectedIndexes[this.selectedIndexes.length - 1];
          if (tile.index == lastIndex) {
            const word = this.selectedIndexes.map(i => tiles[i].value).join('');
            this.submitWord(word);
            this.clearSelection();
          } else if (this.selectedIndexes.length == 0) {
            this.addToSelection(tile.index);
          } else {
            // if this index is touching the last one
            const touching = tile.links.find(link => link.index == lastIndex);
            const alreadySelected = this.selectedIndexes.find(idx => idx == tile.index);
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
        })
        .on('pointerover', () => {
          this.hoverIndex = tile.index;
          this.onSelectionChanged();
        })
        .on('pointerout', () => {
          this.hoverIndex = undefined;
          this.onSelectionChanged();
        });
      return letterButton;
    });

    this.currentSelectionText = this.add.text(0, 0, "", font)
      .setOrigin(0, 0)
      .setStyle({ fill: colours.terracotta.toString(16) });

    const wordsFoundButton = this.add.text(50, 500, "", font)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .setStyle({ fill: colours.terracotta.toString(16) })
      .on('pointerdown', () => {
        this.showWordList();
      })
      .on('pointerover', () => {
        wordsFoundButton.setStyle({ fill: colours.catawba.toString(16) });
      })
      .on('pointerout', () => {
        wordsFoundButton.setStyle({ fill: colours.terracotta.toString(16) });
      });
    this.wordsFoundButton = wordsFoundButton;

    this.onWordListUpdated();
    this.onSelectionChanged();
  }

  submitWord = (word: string) => {
    if (this.wordList.words.has(word)) {
      this.wordList.found.add(word);
      this.flashWord(word, true);
      this.onWordListUpdated();
    } else {
      this.flashWord(word, false);
    }
  }

  showWordList = () => {

    if (this.wordListPopup && this.wordListPopup?.visible) {
      this.wordListPopup?.setVisible(false);
    } else if (this.wordListPopup) {
      this.wordListPopup.setVisible(true);
      this.wordListPopup.setHTML(this.wordListAsHTML());
    } else {
      this.wordListPopup = this.add.dom(0, 0)
        .createFromHTML(this.wordListAsHTML())
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.wordListPopup?.setVisible(false);
        });
    }
  }

  wordListAsHTML = () => {
    const sections = Object.keys(this.wordList.byLength).sort().map((length: string) => {
      const words = this.wordList.byLength[parseInt(length)].map(word => {
        if (this.wordList.found.has(word)) {
          return `<li>${word}</li>`;
        } else {
          // when we have hints we can fill individual letters in
          const stillToGuess = "_ ".repeat(word.length).trim();
          return `<li>${stillToGuess}</li>`
        }
      }).join('');
      return `<section><h1>${length} letters</h1><ol>${words}</ol></section>`;
    });
    return `<div class="word_list">${sections.join('')}</div>`;
  }

  flashWord = (word: string, isValid: boolean) => {
  }

  onWordListUpdated = () => {
    const found = this?.wordList.found.size;
    const total = this?.wordList.words.size;
    this.wordsFoundButton?.setText(`${found} / ${total}`);
  }

  addToSelection = (index: number) => {
    this.selectedIndexes.push(index);

    // highlight every letter touching this last one
    this.highlightedIndexes.clear();
    this.letterButtons[index].getData('linkIndexes').forEach((i: number) => this.highlightedIndexes.add(i));

    const word = this.selectedIndexes.map(i => this.letterButtons[i].getData('value')).join('');
    this.currentSelectionText?.setText(word);
  }

  clearSelection = () => {
    this.selectedIndexes = [];
    this.highlightedIndexes.clear();
    this.currentSelectionText?.setText("");
  }

  onSelectionChanged = () => {
    // go through each letter
    // make sure it's in the right state based on the selectedIndexes, highlightedIndexes and hoverIndex
    const anythingSelected = this.selectedIndexes.length > 0;
    this.letterButtons.forEach((button, idx) => {
      const selected: boolean = this.selectedIndexes.find(i => i === idx) !== undefined;
      const highlighted: boolean = this.highlightedIndexes.has(idx);
      const hovered: boolean = this.hoverIndex === idx;

      if (selected && !hovered) {
        button.setStyle({ fill: colours.catawba.toString(16) }).setAlpha(1).setScale(1);
      } else if (selected && hovered) {
        button.setStyle({ fill: colours.catawba.toString(16) }).setAlpha(1).setScale(1.1);
      } else if (highlighted && !hovered) {
        button.setStyle({ fill: colours.terracotta.toString(16) }).setAlpha(1).setScale(1);
      } else if (hovered) {
        button.setStyle({ fill: colours.terracotta.toString(16) }).setAlpha(1).setScale(1.1);
      } else {
        button.setStyle({ fill: colours.terracotta.toString(16) }).setAlpha(anythingSelected ? 0.5 : 1).setScale(1);
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
