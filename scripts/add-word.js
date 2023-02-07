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

fs.writeFileSync(dictionaryPath, JSON.stringify(allWords, null, 0));
