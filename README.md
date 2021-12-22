# Linkagram 

Make words by connecting letters. Each game is unique and you must find all the words.

![image](https://user-images.githubusercontent.com/93598/147012844-d522e113-8372-4a1f-bffa-a2d6f1034e82.png)


## Config

You can change a few things by specifying URL parameters.


| Query Parameter  | Description | Default Value |
| ------------- | ------------- | -------------|
| id  | Seed for random number generator. Two games of the same size, words, letters and id will be identical  | `Math.random() * 10000` |
| width | Number of letter columns to generate | 4 |
| height | Number of letter rows to generate | 4 |

## Running locally

```
git clone ...
yarn dev
```

## How it's written

Typescript for the code, Bulma for the style. Pure DOM manipulation for the components

## How it works

1. When you load the page, a dictionary of available words and letter frequencies of the english language is loaded
2. The correct number of letter tiles are generated, with links between them to form a graph of letters
3. A `Trie` is built to find all words that can be made on this particular board
4. Each complete word entered by the user is checked to see if it's valid or not, or whether it's already been discovered in this game

