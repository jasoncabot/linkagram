interface TrieNode {
    value: string
    isLeaf: boolean
    children: { [key: string]: TrieNode }
}

const isWord = (trie: TrieNode, word: string) => {
    let node = trie;
    for (let i = 0; i < word.length; i++) {
        const letter = word.charAt(i);
        node = node.children[letter];

        if (!node) return false;
    }
    return node.isLeaf;
}

const isPrefix = (trie: TrieNode, word: string) => {
    let node = trie;
    for (let i = 0; i < word.length; i++) {
        const letter = word.charAt(i);
        node = node.children[letter];

        if (!node) return false;
    }
    return true;
}

const buildTrie: (words: string[]) => TrieNode = (words: string[]) => {

    let trie: TrieNode = {
        value: "",
        isLeaf: false,
        children: {}
    };

    words.forEach(word => {
        let current = trie;
        for (let i = 0; i < word.length; i++) {
            const letter = word.charAt(i);
            let newNode = current.children[letter];
            if (!newNode) {
                newNode = {
                    value: current.value + letter,
                    isLeaf: i == word.length - 1,
                    children: {}
                };
                current.children[letter] = newNode;
            }
            current = newNode;
        }
    });

    return trie;
}

export { buildTrie, isWord, isPrefix };
export type { TrieNode };