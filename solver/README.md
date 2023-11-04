# Linkagram Generator

I wanted a way to occasionally generate a linkagram, so I made this.

You can provide a set of words you want to add to a Linkagram grid and it will (if possible) generate the grid for you.

If there are blank spaces after it has placed all the letters in a grid, then it will automatically fill them in with random letters. The random letters will be drawn from the most frequent words provided, otherwise just a simple random sample.

## How to Run

Install dependencies and run the script.

This generates a board with a single word `test` and prints the solution

```
python3 -m venv venv
source venv/bin/activate
pip3 install -r requirements.txt
python3 ortools_solver.py test
```

## How does it work?

I use [Google OR-Tools](https://developers.google.com/optimization) library to generate and solve a set of constraints and print the solution.
