# Challenge mode templates

Every question in Challenge mode gets its wording from the `.txt` files in this folder. You can change the wording, add more wordings, add your own hand-written questions, or turn question types off, all without touching the code. With `npm run dev` running, the page reloads by itself when you save a file.

```
challenge_templates/
  crystallography/            one folder per subject
    _subject.txt              the subject's name and the hints under Easy / Medium / Hard
    a-3d-bravais-lattices.txt one file per topic, listed in the order of the file names
    b-2d-bravais-lattices.txt
    …
```

Every topic file starts with a short guide to the format and lists the question types it can use, with their `{placeholders}`.

## The blocks in a topic file

```
[topic]
name: Planes (cubic)

[question]
type: intercepts-to-hkl
level: easy, medium
text: A plane cuts the axes at x = {x}, y = {y} and z = {z}. What are its Miller indices?
explain: Take the reciprocals: {recip}. {clear} The Miller indices are {answer}.

[fixed]
level: easy
text: How many Bravais lattices are there in three dimensions?
answer: 14
explain: 7 crystal systems, 14 lattices.

[words]
clear: Multiply by {factor} to clear the fractions: {cleared}.
```

- **[question]**: one wording of a question type that the program fills with random numbers. Copy a block to add another wording (one is picked at random each time). Delete a block, or put `#` in front of its lines, to stop that type from appearing. `level` is optional (leave it out for all levels).
- **[fixed]**: a question you write yourself. With `wrong: B | C | D` (exactly three) it is multiple choice. Without `wrong` the answer is typed: indices such as `(1 1 0)` or `[1 -1 0]`, or a number such as `14` or `2.34 Å` (a number with decimals may be 1 % off). `negative-ok: yes` also accepts indices with every sign flipped.
- **[words]**: short pieces of text the program puts into the questions (named in each file's list of types).
- `{name}` is filled in by the program: keep the spelling. `{answer}` works everywhere.
- `$...$` is a formula in LaTeX (KaTeX), e.g. `$d = a/\sqrt{h^2+k^2+l^2}$`. Don't put a `{name}` inside `$...$`.
- A line that starts with a space continues the line above it. Lines starting with `#` are comments.

## If something is wrong

`npm test` checks every file and tells you the file and line of a problem, such as an unknown key, a misspelt type, a missing word or a `{placeholder}` the type doesn't have. In the browser the same problems show as errors in the developer console, and the broken block is skipped.

## Adding a topic

- **Only hand-written questions:** add a new file to the subject's folder, e.g. `h-close-packing.txt`, with a `[topic]` block and some `[fixed]` blocks. It appears in the Topics list straight away. No code is needed.
- **Questions with random numbers:** these need a new question type in code. Add a file in `src/challenge/subjects/crystallography/` that exports `types` (copy one of the existing files as a starting point), list it in that folder's `index.js`, and then use the new type in a `[question]` block here. `npm test` will ask for a maths check for the new type in `tests/challenge.test.js`.

## Adding a subject

1. Make a new folder here, e.g. `challenge_templates/phase-diagrams/`, with a `_subject.txt` (copy the one in `crystallography/` and change the name and level hints) and at least one topic file.
2. That is enough for a subject with only hand-written questions: it appears in the Subject list.
3. For random-number questions, make a folder with **the same name** in `src/challenge/subjects/` (e.g. `src/challenge/subjects/phase-diagrams/index.js`) that exports `types`. It is found automatically; nothing else needs changing.

Nothing a student does in Challenge mode is saved anywhere, not even in the browser.
