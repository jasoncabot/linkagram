import sys
import random
from ortools.sat.python import cp_model

directions = [
    [1, 4, 5],
    [0, 2, 4, 5, 6],
    [1, 3, 5, 6, 7],
    [2, 6, 7],
    [0, 1, 5, 8, 9],
    [0, 1, 2, 4, 6, 8, 9, 10],
    [1, 2, 3, 5, 7, 9, 10, 11],
    [2, 3, 6, 10, 11],
    [4, 5, 9, 12, 13],
    [4, 5, 6, 8, 10, 12, 13, 14],
    [5, 6, 7, 9, 11, 13, 14, 15],
    [6, 7, 10, 14, 15],
    [8, 9, 13],
    [8, 9, 10, 12, 14],
    [9, 10, 11, 13, 15],
    [10, 11, 14]
]

def add_touching(model, a, b):
    # 00 01 02 03
    # 04 05 06 07
    # 08 09 10 11
    # 12 13 14 15

    # a b . .
    # . a b .
    # . . a b
    # . . . .
    l = model.NewBoolVar(f"{a}{b}_l")
    model.Add(b - 1 == a).OnlyEnforceIf(l)
    model.Add(b != 0).OnlyEnforceIf(l)
    model.Add(b != 4).OnlyEnforceIf(l)
    model.Add(b != 8).OnlyEnforceIf(l)
    model.Add(b != 12).OnlyEnforceIf(l)

    # b a . .
    # . b a .
    # . . b a
    # . . . .
    r = model.NewBoolVar(f"{a}{b}_r")
    model.Add(b + 1 == a).OnlyEnforceIf(r)
    model.Add(b != 3).OnlyEnforceIf(r)
    model.Add(b != 7).OnlyEnforceIf(r)
    model.Add(b != 11).OnlyEnforceIf(r)
    model.Add(b != 15).OnlyEnforceIf(r)

    # . a . .
    # . b a .
    # . . b a
    # . . . b
    u = model.NewBoolVar(f"{a}{b}_u")
    model.Add(b - 4 == a).OnlyEnforceIf(u)

    d = model.NewBoolVar(f"{a}{b}_d")
    model.Add(b + 4 == a).OnlyEnforceIf(d)

    ul = model.NewBoolVar(f"{a}{b}_ul")
    model.Add(b - 5 == a).OnlyEnforceIf(ul)
    model.Add(b != 0).OnlyEnforceIf(ul)
    model.Add(b != 1).OnlyEnforceIf(ul)
    model.Add(b != 2).OnlyEnforceIf(ul)
    model.Add(b != 3).OnlyEnforceIf(ul)
    model.Add(b != 4).OnlyEnforceIf(ul)
    model.Add(b != 8).OnlyEnforceIf(ul)
    model.Add(b != 12).OnlyEnforceIf(ul)

    ur = model.NewBoolVar(f"{a}{b}_ur")
    model.Add(b - 3 == a).OnlyEnforceIf(ur)
    model.Add(b != 3).OnlyEnforceIf(ur)
    model.Add(b != 7).OnlyEnforceIf(ur)
    model.Add(b != 11).OnlyEnforceIf(ur)
    model.Add(b != 15).OnlyEnforceIf(ur)
    model.Add(b != 0).OnlyEnforceIf(ur)
    model.Add(b != 1).OnlyEnforceIf(ur)
    model.Add(b != 2).OnlyEnforceIf(ur)
    model.Add(b != 4).OnlyEnforceIf(ur)
    model.Add(b != 8).OnlyEnforceIf(ur)

    dl = model.NewBoolVar(f"{a}{b}_dl")
    model.Add(b + 3 == a).OnlyEnforceIf(dl)
    model.Add(b != 0).OnlyEnforceIf(dl)
    model.Add(b != 4).OnlyEnforceIf(dl)
    model.Add(b != 8).OnlyEnforceIf(dl)
    model.Add(b != 12).OnlyEnforceIf(dl)
    model.Add(b != 13).OnlyEnforceIf(dl)
    model.Add(b != 14).OnlyEnforceIf(dl)
    model.Add(b != 15).OnlyEnforceIf(dl)
    model.Add(b != 11).OnlyEnforceIf(dl)
    model.Add(b != 7).OnlyEnforceIf(dl)

    dr = model.NewBoolVar(f"{a}{b}_dr")
    model.Add(b + 5 == a).OnlyEnforceIf(dr)
    model.Add(b != 3).OnlyEnforceIf(dr)
    model.Add(b != 7).OnlyEnforceIf(dr)
    model.Add(b != 11).OnlyEnforceIf(dr)
    model.Add(b != 15).OnlyEnforceIf(dr)
    model.Add(b != 12).OnlyEnforceIf(dr)
    model.Add(b != 13).OnlyEnforceIf(dr)
    model.Add(b != 14).OnlyEnforceIf(dr)
    model.Add(b != 8).OnlyEnforceIf(dr)
    model.Add(b != 4).OnlyEnforceIf(dr)
    
    model.AddBoolOr([l, r, u, d, ul, ur, dl, dr])


def generate_grid(words):
    model = cp_model.CpModel()

    # create a minimum set of unique letters for all words
    # for example if there are two p's in the word happy, there will be a p and a p2
    letters = set()
    for word in words:
        for letter in word:
            for i in range(word.count(letter)):
                letters.add(letter + str(i+1))

    # if there are more than 16, then we can't possibly fit them all in the grid so exit with an error
    if len(letters) > 16:
        print("Too many letters to fit in the grid")
        exit(1)

    # if there are fewer than 16 letters, find, in descending order of frequency, the letters that appear in the most words
    # and add them to the set of letters
    if len(letters) < 16:
        letter_count = {}
        for word in words:
            for letter in word:
                if letter in letter_count:
                    letter_count[letter] += 1
                else:
                    letter_count[letter] = 1

        for letter in sorted(letter_count, key=letter_count.get, reverse=True):
            letters.add(letter)

            if len(letters) == 16:
                break
    
    # if there are still less than 16 letters, add random letters until there are 16
    if len(letters) < 16:
        while len(letters) < 16:
            letters.add(chr(random.randint(97, 122)))

    # Create 16 variables representing the distinct set of letters (if there are 2 a's, there is an a and an a2)
    # Each letter can appaer at a single index (position 0 to 15) but we don't know which index that is yet

    # Create an IntVar in the model for each letter
    model_vars = {}
    for letter in letters:
        model_vars[letter] = model.NewIntVar(0, 15, letter)

    # add constraints to the model
    # Every model_var should be assigned to a different index
    model.AddAllDifferent(model_vars.values())

    # print the keys of model_vars
    print(model_vars.keys())#

    # add constraints for each word
    for word in words:
        wordLetters = set()
        # go through the word, two letters at a time
        for i in range(len(word)-1):
            d1 = 1
            value1 = word[i] + str(d1)
            while value1 in wordLetters:
                value1 = word[i] + str(d1)
                d1 += 1
            
            wordLetters.add(value1)

            d2 = 1
            value2 = word[i+1] + str(d2)
            while value2 in wordLetters:
                value2 = word[i+1] + str(d2)
                d2 += 1

            print (value1, value2)

            # get the two variables representing the letters
            var1 = model_vars[value1]
            var2 = model_vars[value2]

            # add a constraint that the two letters must be adjacent
            add_touching(model, var1, var2)

    # Create a solver and solve the model.
    solver = cp_model.CpSolver()
    status = solver.Solve(model)

    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        final_grid = [" " for _ in range(16)]

        for key in model_vars:
            final_grid[solver.Value(model_vars[key])] = key[0]

        print(final_grid)
        return final_grid
    else:
        return None
    # just find the first solution that solves the constraints
    first_solution = problem.getSolution()
    return first_solution

if __name__ == "__main__":
    # Read the list of words from arguments passed to the script
    words = sys.argv[1:]

    solution = generate_grid(words)

    if solution:
        # convert the solution to a grid
        grid = [solution[i][0] for i in range(16)]
        # print out the grid as a 4x4 ascii style grid with a table outline
        for i in range(4):
            print("+---+---+---+---+")
            print("| {} | {} | {} | {} |".format(*grid[i*4:i*4+4]))
        print("+---+---+---+---+")

    else:
        print("No valid solution found.")
