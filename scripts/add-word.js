const fs = require('fs');
const path = require('path')

if (process.argv.length != 3) {
    console.log("run with word as parameter");
    return;
}

const word = (process.argv[2] || "").trim().toLowerCase();

const dictionaryPath = path.join(__dirname, "../public/data/small.json");
const data = fs.readFileSync(dictionaryPath, "utf-8");

// stupidly inefficienct - I wish JS had array.binarySearch(...) that returned the index to insert at
const allWords = JSON.parse(data);
if (allWords.indexOf(word) >= 0 || word.length === 0) {
    console.log("nothing to do");
    return;
}
allWords.push(word);
allWords.sort();

// pretty-printed (one word per line) so adding words is a clean one-line diff;
// the build step compacts this back to a single line for distribution
fs.writeFileSync(dictionaryPath, JSON.stringify(allWords, null, 2) + "\n");
