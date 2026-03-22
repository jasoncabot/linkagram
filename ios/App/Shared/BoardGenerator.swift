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
}
