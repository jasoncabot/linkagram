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
}

export default class Demo extends Phaser.Scene {
  generator: Phaser.Math.RandomDataGenerator;
  selectedIndexes: number[]
  letterButtons: Phaser.GameObjects.Text[];
  currentSelectionText: Phaser.GameObjects.Text | undefined;
  wordList: WordList

  constructor() {
    super('GameScene');

    this.generator = new Phaser.Math.RandomDataGenerator();
    this.selectedIndexes = [];
    this.letterButtons = [];
    this.wordList = {
      byLength: [],
      words: new Set()
    };
  }

  preload() {
    this.load.json('words', 'assets/words.json');
    this.load.json('letterFrequencies', 'assets/letters.json');
    this.load.addFile(new WebFontFile(this.load, 'Seaweed Script'));
  }

  create() {
    const words = this.cache.json.get('words');
    const letterFrequencies = this.cache.json.get('letterFrequencies');
    const trie = buildTrie(words);

    const board = {
      w: 8,
      h: 8
    }
    const numberOfTiles = board.w * board.h;

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
    for (let x = 0; x < numberOfTiles; x++) {

      // generate all surrounding indexes
      let indexes = [
        x - (1 + board.w), x - (0 + board.w), x - (-1 + board.w),
        x - (1 + 0), x - (0 + 0), x - (-1 + 0),
        x - (1 + -board.w), x - (0 + -board.w), x - (-1 + -board.w)];

      // if it's blocked by being out of bounds or against a wall
      // then the tiles aren't linked
      tiles[x].links = indexes.filter((idx, i) => {
        return !(idx == x || idx < 0 || idx > (numberOfTiles - 1)
          || (x % board.w == 0 && i % 3 == 0) // left column
          || ((x + 1) % board.w == 0 && (i + 1) % 3 == 0) // right column
          || (x < (board.w - 1) && i < 3) // top row
          || (x > (numberOfTiles - (board.w + 1)) && i > 5)); // bottom row
      }).map(i => tiles[i]); // convert to reference to another tile
    }

    // Find all the words you should be able to get
    this.wordList.words = this.findAllWords(tiles, trie);
    this.wordList.words.forEach(word => {
      let arr = this.wordList.byLength[word.length] || [];
      arr.push(word);
      this.wordList.byLength[word.length] = arr;
    });
    console.log(`There are ${this.wordList.words.size} words to find on this board`);

    const font = {
      fontFamily: `"Special Elite"`,
      fontSize: '50px'
    };

    // Draw the letters
    this.letterButtons = tiles.map(tile => {
      const x = 50 + ((tile.index % board.w) * 50);
      const y = 50 + Math.floor(tile.index / board.h) * 50;
      const letterButton = this.add.text(x, y, tile.value, font)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true })
        .setStyle({ fill: '#34820' })
        .setData('value', tile.value)
        .on('pointerdown', () => {
          const lastIndex = this.selectedIndexes[this.selectedIndexes.length - 1];
          if (tile.index == lastIndex) {
            const word = this.selectedIndexes.map(i => tiles[i].value).join('');
            this.submitWord(word, trie);
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
        })
        .on('pointerover', () => {
          const alreadySelected = this.selectedIndexes.find(idx => idx == tile.index);
          if (!alreadySelected) {
            letterButton.setStyle({ fill: '#f39c12' });
          }
        })
        .on('pointerout', () => {
          const alreadySelected = this.selectedIndexes.find(idx => idx == tile.index);
          if (!alreadySelected) {
            letterButton.setStyle({ fill: '#34820' });
          }
        });
      return letterButton;
    });

    this.currentSelectionText = this.add.text(0, 0, "", font)
      .setOrigin(0, 0)
      .setStyle({ fill: '#34820' });
  }

  submitWord = (word: string, trie: TrieNode) => {
    console.log(`is ${word} a word?`);
    if (isWord(trie, word)) {
      console.log('YES');
    } else {
      console.log('NO');
    }
  }

  addToSelection = (index: number) => {
    this.letterButtons[index].setStyle({ fill: '#c75122' });
    this.selectedIndexes.push(index);

    const word = this.selectedIndexes.map(i => this.letterButtons[i].getData('value')).join('');
    this.currentSelectionText?.setText(word);
  }

  clearSelection = () => {
    this.selectedIndexes.forEach(idx => {
      this.letterButtons[idx].setStyle({ fill: '#34820' });
    })
    this.selectedIndexes = [];
    this.currentSelectionText?.setText("");
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
