import { buildTrie, isPrefix, isWord, TrieNode } from "../trie";
import { celebrate } from "../confetti";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { keyForDate, keyForToday } from "../key";

export interface LinkagramStatRequest {
  hintsRemaining: number;
  timeTaken: number;
  streak: number;
  maxStreak: number;
}

interface LetterTile {
  index: number;
  value: string;
  links: LetterTile[];
}

interface WordList {
  byLength: { [key: number]: string[] };
  words: Set<string>;
}

interface RandomDataGenerator {
  pick(numbers: number[]): number;
  weightedPick(letters: string[], count: number): string[];
}

enum FlashState {
  Valid = "valid",
  Invalid = "invalid",
  AlreadyFound = "found",
}

interface LinkagramConfig {
  id: number;
  size: { width: number; height: number };
  dictionary: string;
  frequencies: string;
}

interface LinkagramState {
  seed: number;
  words: Set<string>;
  hints: Map<string, Set<number>>;
  startedAt: Date;
  finishedAt: Date | null;
  hintCount: number;
  played: string[];
  completed: string[];
  streak: number;
  maxStreak: number;
  fixes: Set<string>;
  save: (state: LinkagramState) => void;
  purge: () => void;
}

const buildMulberry32 = (seed: number) => {
  return () => {
    var t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export default class Linkagram {
  generator: RandomDataGenerator;
  selectedIndexes: number[];
  hoverIndex: number | undefined;
  highlightedIndexes: Set<number>;
  tiles: LetterTile[];
  letterButtons: HTMLElement[];
  wordsFoundButton: any;
  wordList: WordList;
  config: LinkagramConfig;
  wordListPopup: any | undefined;
  state: LinkagramState;
  stripe: Stripe | null;
  currentModals: HTMLElement[];
  
  // Keyboard input state
  keyboardPaths: number[][] = [];  // All possible paths being typed
  keyboardWord: string = '';  // The word being typed

  constructor(data: LinkagramConfig, state: LinkagramState) {
    this.selectedIndexes = [];
    this.highlightedIndexes = new Set();
    this.letterButtons = [];
    this.tiles = [];
    this.wordList = {
      byLength: [],
      words: new Set(),
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
        });

        // Shuffle the weighted array
        let currentIndex = weightedArray.length;
        let randomIndex = 0;
        while (currentIndex != 0) {
          randomIndex = Math.floor(prng() * currentIndex);
          currentIndex--;

          // And swap it with the current element.
          [weightedArray[currentIndex], weightedArray[randomIndex]] = [
            weightedArray[randomIndex],
            weightedArray[currentIndex],
          ];
        }

        // pick the first elements up to however many we want to take
        return weightedArray.slice(0, count);
      },
    };
  }

  buildTiles = (
    board: { width: number; height: number },
    frequencies: string[]
  ) => {
    const numberOfTiles = board.width * board.height;
    const tiles: LetterTile[] = [];

    const key = keyForToday();
    const specials: Record<string, string[]> = {
      "2023731": "knvehinrparspyta".split(""), // 🐰 🥚 ❤️
      "20231113": "vbikeosrlptdpyah".split(""), // 🎂
      "20240310": "hrisetunvodgmlya".split(""), // 🤰
    };
    const values =
      specials[key] ?? this.generator.weightedPick(frequencies, numberOfTiles);
    for (let x = 0; x < numberOfTiles; x++) {
      tiles.push({
        index: x,
        value: values[x],
        links: [],
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
        x - board.width - 1,
        x - board.width,
        x - board.width + 1,
        x - 1,
        x,
        x + 1,
        x + board.width - 1,
        x + board.width,
        x + board.width + 1,
      ];

      // if it's blocked by being out of bounds or against a wall
      // then the tiles aren't linked
      tiles[x].links = indexes
        .filter((linkIndex, idx) => {
          return !(
            linkIndex == x ||
            linkIndex < 0 ||
            linkIndex > numberOfTiles - 1 ||
            (x % board.width == 0 && idx % 3 == 0) || // left column
            ((x + 1) % board.width == 0 && (idx + 1) % 3 == 0) || // right column
            (x < board.width - 1 && idx < 3) || // top row
            (x > numberOfTiles - (board.width + 1) && idx > 5)
          ); // bottom row
        })
        .map((i) => tiles[i]); // convert to reference to another tile
    }
    return tiles;
  };

  initialise = (words: string[], frequencies: string[]) => {
    const trie = buildTrie(words);

    // generate random letters
    this.tiles = this.buildTiles(this.config.size, frequencies);

    // Find all the words you should be able to get
    this.wordList.words = this.findAllWords(this.tiles, trie);
    this.wordList.words.forEach((word) => {
      let arr = this.wordList.byLength[word.length] || [];
      arr.push(word);
      this.wordList.byLength[word.length] = arr;
    });
    Object.keys(this.wordList.byLength).forEach((k) =>
      this.wordList.byLength[parseInt(k, 10)].sort()
    );
  };

  showModal = (id: string) => {
    return (e: Event) => {
      e.preventDefault();
      const modal = document.getElementById(id);
      if (!modal) return;
      modal.classList.add("open");

      this.clearSelection();

      this.currentModals.push(modal);
      this.currentModals.forEach(
        (m, i) => (m.style.zIndex = (50 + i * 10).toString())
      );
    };
  };

  hideModal = (id: string) => {
    return (e: Event) => {
      e.preventDefault();
      const modal = document.getElementById(id);
      if (!modal) return;
      modal.classList.remove("open");
      this.currentModals = this.currentModals.filter((m) => m != modal);
    };
  };

  run = async () => {
    const [wordsResponse, frequenciesResponse] = await Promise.all([
      fetch("/data/" + this.config.dictionary),
      fetch("/data/" + this.config.frequencies),
    ]);

    const words = await wordsResponse.json();
    const frequencies = await frequenciesResponse.json();
    this.initialise(words, frequencies);

    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const wordYOffset = isMobile ? -150 : -90;

    const updateTileSelection = (x: number, y: number, submit: boolean) => {
      const letter = document.elementFromPoint(x, y) as HTMLElement;
      if (letter && letter.dataset.index) {
        const index = parseInt(letter.dataset.index, 10);
        const tile = this.tiles[index];
        this.onTileSelected(tile, submit);
      }
      const currentWord = document.getElementById("current-word")!;
      currentWord.style.left =
        (x - currentWord.clientWidth / 2).toString() + "px";
      currentWord.style.top = (y + wordYOffset).toString() + "px";
      return letter;
    };

    // Draw the letters
    const board = document.getElementById("board")?.children[0] as HTMLElement;
    let firstTile: HTMLElement | undefined;
    let selectedNewLetter = true;
    board.addEventListener("pointerdown", (e: PointerEvent) => {
      e.preventDefault();
      // Clear any keyboard selection when using pointer input
      if (this.keyboardWord.length > 0) {
        this.clearKeyboardSelection();
      }
      const letter = document.elementFromPoint(
        e.clientX,
        e.clientY
      ) as HTMLElement;
      const index = parseInt(letter.dataset.index!, 10);
      // if this letter has already been picked previously
      selectedNewLetter =
        this.selectedIndexes.find((i) => i === index) === undefined;
      firstTile = updateTileSelection(e.clientX, e.clientY, false);
    });
    board.addEventListener("pointermove", (e: PointerEvent) => {
      e.preventDefault();
      if (e.buttons) {
        updateTileSelection(e.clientX, e.clientY, false);
      }
    });
    board.addEventListener("pointerup", (e: PointerEvent) => {
      e.preventDefault();
      const letter = document.elementFromPoint(
        e.clientX,
        e.clientY
      ) as HTMLElement;
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

        // Position the current word overlay above the tap point
        const currentWord = document.getElementById("current-word")!;
        currentWord.style.left =
          (e.clientX - currentWord.clientWidth / 2).toString() + "px";
        currentWord.style.top = (e.clientY + wordYOffset).toString() + "px";
      }
    });
    board.addEventListener("pointercancel", () => {
      this.clearSelection();
    });

    this.letterButtons = this.tiles.map((tile) => {
      const rowIndex = Math.floor(tile.index / this.config.size.width);

      let row = board?.children[rowIndex];
      if (!row) {
        row = document.createElement("tr");
        row.classList.add("board-row");
        board?.appendChild(row);
      }

      const tableCell = document.createElement("td");
      tableCell.classList.add("no-select");
      tableCell.innerHTML = `<div class="tile-cell"><a class="letter">${tile.value}</a></div>`;
      row?.appendChild(tableCell);

      const letter = tableCell.children[0].children[0] as HTMLElement;
      letter.dataset.value = tile.value;
      letter.dataset.index = tile.index.toString();
      return letter;
    });

    document
      .getElementById("total-found")
      ?.addEventListener("click", this.showModal("wordlist-modal"));
    document
      .getElementById("wordlist-modal-close")
      ?.addEventListener("click", this.hideModal("wordlist-modal"));
    document
      .getElementById("wordlist-modal-background")
      ?.addEventListener("click", this.hideModal("wordlist-modal"));

    document
      .getElementById("hints-modal-close")
      ?.addEventListener("click", this.hideModal("hints-modal"));
    document
      .getElementById("hints-modal-background")
      ?.addEventListener("click", this.hideModal("hints-modal"));

    document
      .getElementById("show-hints")
      ?.addEventListener("click", this.showHintModal);

    document
      .getElementById("how-to-play-button")
      ?.addEventListener("click", this.showModal("how-to-play-modal"));
    document
      .getElementById("how-to-play-modal-close")
      ?.addEventListener("click", this.hideModal("how-to-play-modal"));
    document
      .getElementById("how-to-play-modal-close-ok")
      ?.addEventListener("click", this.hideModal("how-to-play-modal"));
    document
      .getElementById("how-to-play-modal-background")
      ?.addEventListener("click", this.hideModal("how-to-play-modal"));

    document
      .getElementById("stats-button")
      ?.addEventListener("click", this.showModal("stats-modal"));
    document
      .getElementById("stats-modal-close")
      ?.addEventListener("click", this.hideModal("stats-modal"));
    document
      .getElementById("stats-modal-background")
      ?.addEventListener("click", this.hideModal("stats-modal"));

    document
      .getElementById("share-button")
      ?.addEventListener("click", async () => {
        try {
          if (!navigator.share) return;

          // if you've completed it
          let text = `Found ${this.state.words.size} / ${this.wordList.words.size}`;
          if (this.state.words.size === this.wordList.words.size) {
            const finished = this.state.finishedAt!;
            const started = this.state.startedAt;

            const elapsed = finished.getTime() - started.getTime();

            const hours = Math.floor((elapsed % 86400000) / 3600000);
            const minutes = Math.round(
              ((elapsed % 86400000) % 3600000) / 60000
            );

            let hintsUsed = 0;
            this.state.hints.forEach((hints, _word) => {
              hintsUsed += hints.size;
            });

            const lines = [
              `⌛ ${hours}h ${minutes}m`,
              `💡 ${hintsUsed} ${hintsUsed == 1 ? "hint" : "hints"}`,
            ];
            if (this.state.streak > 2) {
              // add another fire for every 100 days
              const fires = Array(Math.floor(this.state.streak / 100) + 1)
                .fill("🔥")
                .join("");
              lines.push(`${fires} ${this.state.streak}`);
            }
            text = lines.join("\n");
          }

          await navigator.share({
            title: "Linkagram",
            text: text,
            url: document.URL,
          });
        } catch (error) {
          console.warn(error);
        }
      });

    this.onWordListUpdated();
    this.onSelectionChanged();
    this.clearSelection();
    this.onGameStarted();

    // Keyboard event listener for desktop
    document.addEventListener('keydown', this.handleKeyDown);

    // Bottom sheet gesture handling
    const sheet = document.getElementById("wordlist-sheet");
    const handle = document.getElementById("bottom-sheet-handle");
    const peek = document.getElementById("bottom-sheet-peek");
    if (sheet && handle && peek) {
      let startY = 0;
      let currentY = 0;
      let isDragging = false;

      const onTouchStart = (e: TouchEvent) => {
        startY = e.touches[0].clientY;
        currentY = startY;
        isDragging = true;
        sheet.classList.add("dragging");
      };

      const onTouchMove = (e: TouchEvent) => {
        if (!isDragging) return;
        currentY = e.touches[0].clientY;
        const isOpen = sheet.classList.contains("open");
        const dy = currentY - startY;
        if (isOpen) {
          if (dy > 0) {
            sheet.style.transform = `translateY(${dy}px)`;
          }
        } else {
          if (dy < 0) {
            const base = `calc(100% - var(--bottom-sheet-peek) - var(--safe-bottom))`;
            sheet.style.transform = `translateY(calc(${base} + ${dy}px))`;
          }
        }
      };

      const onTouchEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        sheet.classList.remove("dragging");
        sheet.style.transform = "";
        const dy = currentY - startY;
        if (Math.abs(dy) > 50) {
          if (dy < 0) {
            sheet.classList.add("open");
          } else {
            sheet.classList.remove("open");
          }
        }
      };

      handle.addEventListener("touchstart", onTouchStart, { passive: true });
      handle.addEventListener("touchmove", onTouchMove, { passive: true });
      handle.addEventListener("touchend", onTouchEnd);
      peek.addEventListener("touchstart", onTouchStart, { passive: true });
      peek.addEventListener("touchmove", onTouchMove, { passive: true });
      peek.addEventListener("touchend", onTouchEnd);

      // Tap to toggle
      peek.addEventListener("click", () => {
        sheet.classList.toggle("open");
      });

      // Tap outside to dismiss
      const backdrop = document.getElementById("bottom-sheet-backdrop");
      if (backdrop) {
        backdrop.addEventListener("click", () => {
          sheet.classList.remove("open");
        });
      }
    }
  };

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
      const touching =
        tile.links.find((link) => link.index === lastIndex) !== undefined;
      const alreadySelected =
        this.selectedIndexes.find((idx) => idx === tile.index) !== undefined;
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
  };

  submitWord = () => {
    const word: string = this.selectedIndexes
      .map((i) => this.tiles[i].value)
      .join("");
    const buttons: HTMLElement[] = this.selectedIndexes.map(
      (i) => this.letterButtons[i]
    );

    if (this.state.words.has(word)) {
      this.flashButtons(buttons, FlashState.AlreadyFound);
    } else if (this.wordList.words.has(word)) {
      this.onWordRevealed(word);
      this.state.save(this.state);
      this.flashButtons(buttons, FlashState.Valid);
      this.flashTotalFound();
      this.onWordListUpdated();
    } else {
      this.flashButtons(buttons, FlashState.Invalid);
    }
    this.clearSelection();
  };

  wordListAsHTML = () => {
    const sections = Object.keys(this.wordList.byLength)
      .sort()
      .map((length: string) => {
        const words = this.wordList.byLength[parseInt(length)]
          .map((word) => {
            if (this.state.words.has(word)) {
              return `<div class="word-item no-select"><a onclick="document.linkagram.define('${word}')">${word}</a></div>`;
            } else {
              const revealedIndexes = this.state.hints.get(word) || new Set();
              const stillToGuess = Array(word.length)
                .fill("_")
                .map((placeholder, idx) =>
                  revealedIndexes.has(idx) ? word.charAt(idx) : placeholder
                )
                .join(" ");
              return `<div class="word-item no-select"><a onclick="document.linkagram.hint('${word}')">${stillToGuess}</a></div>`;
            }
          })
          .join("");
        return `<div class="word-group-label">${length} letters</div><div class="word-list">${words}</div>`;
      });
    const hintsLeft = this.state.hintCount;
    const hintsLabel = hintsLeft === 1 ? "hint" : "hints";
    const hintsBar = `<div class="hints-bar" onclick="document.linkagram.showHintModal()">` +
      `<span class="hints-bar-icon">💡</span>` +
      `<span class="hints-bar-text"><span class="hints-bar-count">${hintsLeft}</span> ${hintsLabel} remaining</span>` +
      (hintsLeft <= 4 ? `<span class="hints-bar-action">Get more</span>` : '') +
      `</div>`;
    return `${hintsBar}${sections.join("")}`;
  };

  increaseAvailableHints = (count: number) => {
    this.state.hintCount += count;
    this.state.save(this.state);
    this.onWordListUpdated();
  };

  showHintModal = async (event: Event | undefined) => {
    document.getElementById("hint-count")!.innerText =
      this.state.hintCount.toString();
    this.showModal("hints-modal")(event || new Event("hint"));

    const onPaymentComplete = () => {
      this.increaseAvailableHints(12);
      document.getElementById("hints-modal")?.classList.remove("open");
    };

    const onPaymentError = (err: any) => {
      document
        .getElementById("payment-request-loading")
        ?.classList.remove("hidden");
      document
        .getElementById("payment-request-loading")
        ?.classList.remove("loading");
      console.error(err);
    };

    if (!this.stripe) {
      onPaymentError(new Error("unable to load stripe"));
      return;
    }

    const stripe = this.stripe;

    const paymentRequest = stripe.paymentRequest({
      country: "GB",
      currency: "gbp",
      total: {
        label: "12 linkagram hints",
        amount: 99,
      },
    });

    const elements = stripe.elements();
    const prButton = elements.create("paymentRequestButton", {
      paymentRequest,
    });

    (async () => {
      document
        .getElementById("payment-request-loading")
        ?.classList.remove("hidden");
      document
        .getElementById("payment-request-loading")
        ?.classList.add("loading");
      const result = await paymentRequest.canMakePayment();
      if (result) {
        prButton.mount("#payment-request-button");
        document
          .getElementById("payment-request-loading")
          ?.classList.add("hidden");
      } else {
        document
          .getElementById("payment-request-button")
          ?.classList.add("hidden");
      }
    })();

    try {
      const response = await fetch(`/hint_payment`, {
        method: "POST",
        headers: {
          "content-type": "application/json;charset=UTF-8",
        },
      });
      const clientSecretResponse = await response.json();
      const clientSecret = clientSecretResponse.secret;

      paymentRequest.on("paymentmethod", async (ev) => {
        try {
          const { paymentIntent, error: confirmError } =
            await stripe.confirmCardPayment(
              clientSecret,
              { payment_method: ev.paymentMethod.id },
              { handleActions: false }
            );

          if (confirmError) {
            ev.complete("fail");
          } else {
            ev.complete("success");
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
  };

  hint = async (word: string) => {
    if (this.state.hintCount === 0) {
      this.showHintModal(undefined);
      return;
    }

    // use our hint
    this.state.hintCount -= 1;

    const set = this.state.hints.get(word) || new Set();
    const potentials = Array(word.length)
      .fill(0)
      .map((_, idx) => idx)
      .filter((i) => !set.has(i));
    set.add(this.generator.pick(potentials));
    this.state.hints.set(word, set);

    // if this hint would reveal the word
    if (potentials.length == 1) {
      this.onWordRevealed(word);
    }
    this.state.save(this.state);
    this.onWordListUpdated();
  };

  define = async (word: string) => {
    try {
      const result = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`
      );
      const entry = (await result.json()) as [
        {
          word: string;
          meanings: [{ definitions: [{ definition: string }] }];
        }
      ];

      const definition = entry[0]?.meanings[0]?.definitions[0]?.definition;
      if (definition) {
        alert(word + "\n\n" + definition);
      }
    } catch (err) {
      console.log("Unable to find definition of " + word);
    }
  };

  flashButtons = (buttons: HTMLElement[], state: FlashState) => {
    buttons.forEach((button) => button.classList.add(state.valueOf()));
    setTimeout(() => {
      buttons.forEach((button) => button.classList.remove(state.valueOf()));
    }, 250);
  };

  flashTotalFound = () => {
    const totalFound = document.getElementById("total-found");
    const totalFoundMobile = document.getElementById("total-found-mobile");
    const elements = [totalFound, totalFoundMobile].filter(Boolean) as HTMLElement[];
    elements.forEach((el) => {
      el.classList.remove("flash-valid");
      // Force reflow to restart animation
      void el.offsetWidth;
      el.classList.add("flash-valid");
    });
    setTimeout(() => {
      elements.forEach((el) => el.classList.remove("flash-valid"));
    }, 500);
  };

  onWordListUpdated = () => {
    const found = this?.state.words.size;
    const total = this?.wordList.words.size;
    const totalFound = document.getElementById("total-found");
    totalFound!.innerText = `${found} / ${total}`;
    const wordlist = document.getElementById("wordlist")!;
    wordlist.innerHTML = this.wordListAsHTML();
    const wordlistModal = document.getElementById("wordlist-modal-content")!;
    wordlistModal.innerHTML = wordlist.innerHTML;

    // Update mobile bottom sheet
    const totalFoundMobile = document.getElementById("total-found-mobile");
    if (totalFoundMobile) totalFoundMobile.innerText = `${found} / ${total}`;
    const sheetContent = document.getElementById("wordlist-sheet-content");
    if (sheetContent) sheetContent.innerHTML = wordlist.innerHTML;

    if (found === total) {
      this.onGameEnded();
    }
  };

  onGameStarted = async () => {
    const key = keyForToday();

    this.fixupIfRequired(key);

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
      this.showModal("how-to-play-modal")(new Event("onGameEnded"));
    }

    const stripeKey: string =
      "pk_live_51MQ4wTDjdwEKhnhgi8jlWuTSTjrokSs6lBqHIFP9O6c7Sot00xW54LRCXprU1v2ToVuAoTnvr5gdOWG0jRKAyrZn00pWtSmzKq";
    this.stripe = await loadStripe(stripeKey, { apiVersion: "2022-11-15" });
  };

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

      // submit the stats to the server
      fetch(`/stats`, {
        method: "POST",
        headers: {
          "content-type": "application/json;charset=UTF-8",
        },
        body: JSON.stringify({
          hintsRemaining: this.state.hintCount,
          timeTaken:
            this.state.finishedAt.getTime() - this.state.startedAt.getTime(),
          streak: this.state.streak,
          maxStreak: this.state.maxStreak,
        } as LinkagramStatRequest),
      });
    }
    this.onStatsUpdated();
    celebrate(() => this.showModal("stats-modal")(new Event("onGameEnded")));
  };

  onWordRevealed = (word: string) => {
    this.state.words.add(word);
  };

  onStatsUpdated = () => {
    const setState = (name: string, value: number) => {
      const e = document.getElementById(name);
      if (!e) return;
      e.innerText = value.toString();
    };
    setState("stats-played", this.state.played.length);
    setState("stats-completed", this.state.completed.length);
    setState("stats-streak", this.state.streak);
    setState("stats-max-streak", this.state.maxStreak);
  };

  fixupIfRequired = (key: string) => {
    // We have a bug where we don't record the streak correctly
    // Perform a one-time fix up of the streaks
    const fixedStreaks = "streaks2";
    if (!this.state.fixes.has(fixedStreaks)) {
      this.state.streak = 0;
      // go through our completed state and calculate the streak and maxStreak

      // iterate through completed in reverse and find the first time that
      // a key that can be parsed as a date is not equal to the previous day
      // then we know that the streak ended there
      let calculatedStreak = 0;
      const fixedKeysForDate = (date: Date) => {
        // this was broken and fixed up before, so we check both keys just in case
        const paddedDayString = date.getDate().toString().padStart(2, "0");
        const paddedMonthString = (date.getMonth() + 1)
          .toString()
          .padStart(2, "0");
        const current =
          date.getFullYear() + paddedMonthString + paddedDayString;
        const previousBroken = parseInt(
          [date.getFullYear(), date.getMonth() + 1, date.getDate()].join(""),
          10
        ).toString();
        return [current, previousBroken];
      };

      let current = new Date();
      let idx = this.state.completed.length - 1;
      while (idx >= 0) {
        const x = this.state.completed[idx];
        const currentKeys = fixedKeysForDate(current);
        if (!currentKeys.includes(x)) {
          console.log(`Streak ended at ${current.toDateString()}`);
          break;
        }
        calculatedStreak += 1;
        idx -= 1;
        current.setDate(current.getDate() - 1);
      }

      this.state.streak = calculatedStreak;
      if (calculatedStreak > this.state.maxStreak) {
        this.state.maxStreak = calculatedStreak;
      }

      // record the fact we performed this fixup
      this.state.fixes.add(fixedStreaks);
      this.state.save(this.state);
    }
  };

  addTileToSelection = (tile: LetterTile) => {
    const previous: HTMLElement | undefined =
      this.selectedIndexes.length === 0
        ? undefined
        : this.letterButtons[
            this.selectedIndexes[this.selectedIndexes.length - 1]
          ];
    const next = this.letterButtons[tile.index];

    this.selectedIndexes.push(tile.index);

    if (previous) {
      // draw a line linking previous to next
      const svg = document.getElementById("connections")!;
      const svgRect = svg.getBoundingClientRect();

      const prevRect = previous.getBoundingClientRect();
      const nextRect = next.getBoundingClientRect();

      // Use percentage-based coordinates relative to the SVG element
      const x1 = ((prevRect.x + prevRect.width / 2 - svgRect.x) / svgRect.width) * 100;
      const y1 = ((prevRect.y + prevRect.height / 2 - svgRect.y) / svgRect.height) * 100;
      const x2 = ((nextRect.x + nextRect.width / 2 - svgRect.x) / svgRect.width) * 100;
      const y2 = ((nextRect.y + nextRect.height / 2 - svgRect.y) / svgRect.height) * 100;

      let arrow = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      arrow.classList.add("connection");
      const segmentIndex = this.selectedIndexes.length - 2;
      arrow.setAttribute("data-segment", segmentIndex.toString());
      arrow.setAttribute("x1", x1 + "%");
      arrow.setAttribute("y1", y1 + "%");
      arrow.setAttribute("x2", x2 + "%");
      arrow.setAttribute("y2", y2 + "%");
      svg.appendChild(arrow);
    }

    // highlight every letter touching this last one
    this.highlightedIndexes.clear();
    tile.links.forEach((t) => this.highlightedIndexes.add(t.index));

    const word = this.selectedIndexes.map((i) => this.tiles[i].value).join("");
    const currentWord = document.getElementById("current-word")!;
    currentWord.innerText = word;
    currentWord.classList.add("has-word");
  };

  clearSelection = () => {
    const svg = document.getElementById("connections")!;
    svg.querySelectorAll(".connection").forEach((el) => el.remove());
    this.selectedIndexes = [];
    this.highlightedIndexes.clear();
    const currentWord = document.getElementById("current-word")!;
    currentWord.innerText = "";
    currentWord.classList.remove("has-word");
    currentWord.style.left = "";
    currentWord.style.top = "";
    this.onSelectionChanged();
  };

  onSelectionChanged = () => {
    // Toggle has-selection class on board for dimming non-highlighted tiles
    const board = document.getElementById("board");
    if (board) {
      if (this.selectedIndexes.length > 0) {
        board.classList.add("has-selection");
      } else {
        board.classList.remove("has-selection");
      }
    }

    // go through each letter
    // make sure it's in the right state based on the selectedIndexes, highlightedIndexes
    this.letterButtons.forEach((button, idx) => {
      const selected: boolean =
        this.selectedIndexes.find((i) => i === idx) !== undefined;
      const highlighted: boolean =
        this.highlightedIndexes.has(idx) || this.selectedIndexes.length === 0;

      button.classList.remove("selected", "highlighted");
      if (selected) {
        button.classList.add("selected");
      } else if (highlighted) {
        button.classList.add("highlighted");
      }
    });
  };

  findAllWords = (tiles: LetterTile[], trie: TrieNode) => {
    interface LetterNode {
      index: number;
      value: string;
      visited: Set<number>;
    }

    let toExplore: LetterNode[] = tiles.map((l) => {
      return {
        index: l.index,
        value: "",
        visited: new Set(),
      };
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

      tiles[node.index].links
        .map((l) => {
          if (node.visited.has(l.index)) return undefined;
          let updated = new Set(node.visited);
          updated.add(l.index);
          return {
            index: l.index,
            value: node.value + l.value,
            visited: updated,
          };
        })
        .filter((n) => !!n)
        .forEach((child) => toExplore.push(child!));
    }

    return allWords;
  };

  // Keyboard input methods
  handleKeyDown = (e: KeyboardEvent) => {
    // Ignore if a modal is open or if focus is on an input
    if (this.currentModals.length > 0) return;
    if (document.activeElement?.tagName === 'INPUT') return;
    if (document.activeElement?.tagName === 'TEXTAREA') return;

    const key = e.key.toLowerCase();

    if (key === 'enter') {
      this.submitKeyboardWord();
      e.preventDefault();
      return;
    }

    if (key === 'backspace') {
      this.keyboardBackspace();
      e.preventDefault();
      return;
    }

    if (key === 'escape') {
      this.clearKeyboardSelection();
      e.preventDefault();
      return;
    }

    // Only handle single letter keys
    if (key.length !== 1 || !key.match(/[a-z]/i)) return;

    this.handleKeyboardLetter(key);
    e.preventDefault();
  };

  handleKeyboardLetter = (letter: string) => {
    // Clear any touch/click selection when starting keyboard input
    if (this.keyboardWord === '' && this.selectedIndexes.length > 0) {
      this.clearSelection();
    }

    if (this.keyboardPaths.length === 0) {
      // Starting fresh - find all tiles with this letter
      const matchingIndexes = this.tiles
        .filter(t => t.value === letter)
        .map(t => t.index);

      if (matchingIndexes.length === 0) {
        // No such letter on board - flash error
        this.flashButtons(this.letterButtons, FlashState.Invalid);
        return;
      }

      this.keyboardPaths = matchingIndexes.map(i => [i]);
    } else {
      // Extend existing paths
      const newPaths: number[][] = [];

      for (const path of this.keyboardPaths) {
        const lastIndex = path[path.length - 1];
        const lastTile = this.tiles[lastIndex];

        // Find adjacent tiles with this letter that aren't already in the path
        const adjacentMatches = lastTile.links
          .filter(t => t.value === letter && !path.includes(t.index))
          .map(t => t.index);

        for (const nextIndex of adjacentMatches) {
          newPaths.push([...path, nextIndex]);
        }
      }

      if (newPaths.length === 0) {
        // No valid continuation - flash the last candidates
        const lastCandidates = this.getLastCandidates();
        const buttons = lastCandidates.map(i => this.letterButtons[i]);
        this.flashButtons(buttons, FlashState.Invalid);
        return;
      }

      this.keyboardPaths = newPaths;
    }

    this.keyboardWord += letter;
    this.updateKeyboardVisualization();
  };

  keyboardBackspace = () => {
    if (this.keyboardWord === '') return;

    this.keyboardWord = this.keyboardWord.slice(0, -1);

    if (this.keyboardWord === '') {
      this.keyboardPaths = [];
    } else {
      // Remove last element from each path and deduplicate
      this.keyboardPaths = this.keyboardPaths.map(p => p.slice(0, -1));
      this.keyboardPaths = this.deduplicatePaths(this.keyboardPaths);
    }

    this.updateKeyboardVisualization();
  };

  deduplicatePaths = (paths: number[][]): number[][] => {
    const seen = new Set<string>();
    return paths.filter(p => {
      const key = p.join(',');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  getLastCandidates = (): number[] => {
    if (this.keyboardPaths.length === 0) return [];
    const lastPosition = this.keyboardWord.length - 1;
    const candidates = new Set<number>();
    for (const path of this.keyboardPaths) {
      if (path[lastPosition] !== undefined) {
        candidates.add(path[lastPosition]);
      }
    }
    return [...candidates];
  };

  submitKeyboardWord = () => {
    if (this.keyboardPaths.length === 0) return;

    // Use the first path (all paths spell the same word)
    const path = this.keyboardPaths[0];

    // Set selectedIndexes to this path and submit
    this.selectedIndexes = [...path];
    this.submitWord();
    this.clearKeyboardSelection();
  };

  clearKeyboardSelection = () => {
    this.keyboardPaths = [];
    this.keyboardWord = '';
    this.updateKeyboardVisualization();
    this.clearSelection();
  };

  updateKeyboardVisualization = () => {
    // Clear old connection lines
    const svg = document.getElementById("connections")!;
    svg.querySelectorAll(".connection").forEach((el) => el.remove());

    // Update current word display
    const currentWord = document.getElementById("current-word")!;
    currentWord.innerText = this.keyboardWord;
    if (this.keyboardWord) {
      currentWord.classList.add("has-word");
      // Position it at top center of board
      const board = document.getElementById("board");
      if (board) {
        const boardRect = board.getBoundingClientRect();
        currentWord.style.left = (boardRect.left + boardRect.width / 2 - currentWord.clientWidth / 2) + "px";
        currentWord.style.top = (boardRect.top - 50) + "px";
      }
    } else {
      currentWord.classList.remove("has-word");
    }

    // Determine which tiles are definite vs candidates at each position
    const confirmedAtPosition: (number | null)[] = [];
    const candidatesAtPosition: Set<number>[] = [];

    const wordLength = this.keyboardWord.length;
    for (let pos = 0; pos < wordLength; pos++) {
      const indexesAtPos = new Set(this.keyboardPaths.map(p => p[pos]));
      candidatesAtPosition[pos] = indexesAtPos;
      if (indexesAtPos.size === 1) {
        confirmedAtPosition[pos] = [...indexesAtPos][0];
      } else {
        confirmedAtPosition[pos] = null;
      }
    }

    // Update tile CSS classes
    this.letterButtons.forEach((button) => {
      button.classList.remove("selected", "highlighted", "candidate");
    });

    // Collect all tiles in any path for highlighting
    const tilesInPaths = new Set<number>();
    for (const path of this.keyboardPaths) {
      for (const idx of path) {
        tilesInPaths.add(idx);
      }
    }

    // Apply selected and candidate classes
    for (let pos = 0; pos < wordLength; pos++) {
      if (confirmedAtPosition[pos] !== null) {
        this.letterButtons[confirmedAtPosition[pos]!].classList.add("selected");
      } else {
        for (const candidateIdx of candidatesAtPosition[pos]) {
          this.letterButtons[candidateIdx].classList.add("candidate");
        }
      }
    }

    // Draw connection lines between confirmed tiles
    const confirmed = confirmedAtPosition.filter(c => c !== null) as number[];
    for (let i = 1; i < confirmed.length; i++) {
      this.drawConnectionBetween(confirmed[i - 1], confirmed[i], i - 1);
    }

    // Handle "has-selection" class on board
    const board = document.getElementById("board");
    if (board) {
      if (this.keyboardWord.length > 0) {
        board.classList.add("has-selection");
      } else {
        board.classList.remove("has-selection");
      }
    }

    // Update highlighted indexes for dimming (don't dim tiles in paths or adjacent to last candidates)
    this.highlightedIndexes.clear();
    for (const idx of tilesInPaths) {
      this.highlightedIndexes.add(idx);
    }
    // Also highlight tiles adjacent to last candidates
    const lastCandidates = candidatesAtPosition[wordLength - 1] || new Set();
    for (const candidateIdx of lastCandidates) {
      const tile = this.tiles[candidateIdx];
      for (const link of tile.links) {
        this.highlightedIndexes.add(link.index);
      }
    }

    this.onSelectionChanged();
  };

  drawConnectionBetween = (fromIdx: number, toIdx: number, segmentIndex: number) => {
    const svg = document.getElementById("connections")!;
    const svgRect = svg.getBoundingClientRect();

    const prevRect = this.letterButtons[fromIdx].getBoundingClientRect();
    const nextRect = this.letterButtons[toIdx].getBoundingClientRect();

    const x1 = ((prevRect.x + prevRect.width / 2 - svgRect.x) / svgRect.width) * 100;
    const y1 = ((prevRect.y + prevRect.height / 2 - svgRect.y) / svgRect.height) * 100;
    const x2 = ((nextRect.x + nextRect.width / 2 - svgRect.x) / svgRect.width) * 100;
    const y2 = ((nextRect.y + nextRect.height / 2 - svgRect.y) / svgRect.height) * 100;

    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "line");
    arrow.classList.add("connection");
    arrow.setAttribute("data-segment", segmentIndex.toString());
    arrow.setAttribute("x1", x1 + "%");
    arrow.setAttribute("y1", y1 + "%");
    arrow.setAttribute("x2", x2 + "%");
    arrow.setAttribute("y2", y2 + "%");
    svg.appendChild(arrow);
  };
}

export type { LinkagramState, LinkagramConfig };
