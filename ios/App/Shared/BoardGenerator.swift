import Foundation
import JavaScriptCore

/// Uses JavaScriptCore to run the same JS board-generation code as the web app,
/// ensuring the widget always produces identical grids.
struct BoardGenerator {

    /// The embedded JS that mirrors key.ts, hash.ts, and the relevant parts of Linkagram.ts.
    /// This is the single source of truth — any changes to the web code should be reflected here.
    private static let boardJS = """
    const hashCode = (s) => {
        var hash = 0, i, chr;
        if (s.length === 0) return hash;
        for (i = 0; i < s.length; i++) {
            chr = s.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0;
        }
        return hash;
    };

    const keyForDate = (year, month, day) => {
        const paddedDay = String(day).padStart(2, '0');
        const paddedMonth = String(month).padStart(2, '0');
        return year + paddedMonth + paddedDay;
    };

    const buildMulberry32 = (seed) => {
        return () => {
            var t = (seed += 0x6d2b79f5);
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    };

    const letterFrequencies = ["e","t","a","o","i","n","s","r","h","d","l","u","c","m","f","y","w","g","p","b","v","k","x","q","j","z"];

    const specials = {
        "2023731": "knvehinrparspyta".split(""),
        "20231113": "vbikeosrlptdpyah".split(""),
        "20240310": "hrisetunvodgmlya".split("")
    };

    function generateBoard(year, month, day) {
        const id = keyForDate(year, month, day);
        const width = 4, height = 4;
        const count = width * height;
        const configKey = id + ",small.json,letters.json," + width + "," + height;
        const seed = hashCode(configKey);
        const prng = buildMulberry32(seed);

        if (specials[id]) {
            return specials[id];
        }

        const weightedArray = [];
        letterFrequencies.forEach((letter, i) => {
            let numberOfTimes = 0;
            if (i < 12) numberOfTimes = 7;
            else if (i < 20) numberOfTimes = 3;
            else if (i < 23) numberOfTimes = 2;
            else numberOfTimes = 1;
            for (let c = 0; c < numberOfTimes; c++) {
                weightedArray.push(letter);
            }
        });

        let currentIndex = weightedArray.length;
        while (currentIndex != 0) {
            const randomIndex = Math.floor(prng() * currentIndex);
            currentIndex--;
            [weightedArray[currentIndex], weightedArray[randomIndex]] =
                [weightedArray[randomIndex], weightedArray[currentIndex]];
        }

        return weightedArray.slice(0, count);
    }

    // --- Trie (mirrors src/trie.ts) ---

    function buildTrie(words) {
        const trie = { value: "", isLeaf: false, children: {} };
        for (let w = 0; w < words.length; w++) {
            const word = words[w];
            let current = trie;
            for (let i = 0; i < word.length; i++) {
                const letter = word.charAt(i);
                let child = current.children[letter];
                if (!child) {
                    child = { value: current.value + letter, isLeaf: i === word.length - 1, children: {} };
                    current.children[letter] = child;
                }
                if (i === word.length - 1) child.isLeaf = true;
                current = child;
            }
        }
        return trie;
    }

    function isWord(trie, word) {
        let node = trie;
        for (let i = 0; i < word.length; i++) {
            node = node.children[word.charAt(i)];
            if (!node) return false;
        }
        return node.isLeaf;
    }

    function isPrefix(trie, word) {
        let node = trie;
        for (let i = 0; i < word.length; i++) {
            node = node.children[word.charAt(i)];
            if (!node) return false;
        }
        return true;
    }

    // --- Adjacency & word finding (mirrors Linkagram.ts) ---

    function buildLinks(width, height) {
        const count = width * height;
        const links = [];
        for (let x = 0; x < count; x++) {
            const candidates = [
                x - width - 1, x - width, x - width + 1,
                x - 1,         x,         x + 1,
                x + width - 1, x + width, x + width + 1
            ];
            links[x] = candidates.filter((linkIndex, idx) => {
                return !(
                    linkIndex === x ||
                    linkIndex < 0 ||
                    linkIndex > count - 1 ||
                    (x % width === 0 && idx % 3 === 0) ||
                    ((x + 1) % width === 0 && (idx + 1) % 3 === 0) ||
                    (x < width - 1 && idx < 3) ||
                    (x > count - (width + 1) && idx > 5)
                );
            });
        }
        return links;
    }

    function findAllWords(letters, links, trie) {
        const allWords = new Set();
        const count = letters.length;
        const stack = [];
        for (let i = 0; i < count; i++) {
            stack.push([i, "", 0]);
        }
        while (stack.length > 0) {
            const [idx, word, visited] = stack.pop();
            const nextWord = word + letters[idx];
            const nextVisited = visited | (1 << idx);

            if (!isPrefix(trie, nextWord)) continue;
            if (isWord(trie, nextWord)) allWords.add(nextWord);

            const adj = links[idx];
            for (let j = 0; j < adj.length; j++) {
                const ni = adj[j];
                if (!(nextVisited & (1 << ni))) {
                    stack.push([ni, nextWord, nextVisited]);
                }
            }
        }
        return Array.from(allWords);
    }

    function wordCount(year, month, day, dictionary) {
        const letters = generateBoard(year, month, day);
        const links = buildLinks(4, 4);
        const trie = buildTrie(dictionary);
        return findAllWords(letters, links, trie).length;
    }
    """

    private static let context: JSContext = {
        let ctx = JSContext()!
        ctx.evaluateScript(boardJS)
        return ctx
    }()

    static func keyForDate(_ date: Date) -> String {
        let cal = Calendar.current
        let y = cal.component(.year, from: date)
        let m = cal.component(.month, from: date)
        let d = cal.component(.day, from: date)
        return String(format: "%d%02d%02d", y, m, d)
    }

    /// Generate the 4×4 letter grid for a given date.
    static func lettersForDate(_ date: Date) -> [String] {
        let cal = Calendar.current
        let y = cal.component(.year, from: date)
        let m = cal.component(.month, from: date)
        let d = cal.component(.day, from: date)

        guard let result = context
            .objectForKeyedSubscript("generateBoard")
            .call(withArguments: [y, m, d]),
              let array = result.toArray() as? [String] else {
            return Array(repeating: "?", count: 16)
        }
        return array
    }

    /// Generate today's 4×4 letter grid.
    static func lettersForToday() -> [String] {
        return lettersForDate(Date())
    }

    /// Count the number of findable words for a given date.
    /// Requires the dictionary to be available via SharedDataManager.
    static func wordCountForDate(_ date: Date) -> Int {
        guard let dictionary = SharedDataManager.shared.cachedDictionary() else {
            return 0
        }

        let cal = Calendar.current
        let y = cal.component(.year, from: date)
        let m = cal.component(.month, from: date)
        let d = cal.component(.day, from: date)

        guard let result = context
            .objectForKeyedSubscript("wordCount")
            .call(withArguments: [y, m, d, dictionary]),
              result.isNumber else {
            return 0
        }
        return Int(result.toInt32())
    }

    /// Count the number of findable words for today's puzzle.
    static func wordCountForToday() -> Int {
        return wordCountForDate(Date())
    }
}
