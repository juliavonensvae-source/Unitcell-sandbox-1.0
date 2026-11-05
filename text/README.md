# Interface text

Every word the app shows lives in the `.txt` files in this folder. Change the wording here; no code needs to change.

```
startTitle: Unit Cell <span>Explorer</span>
helpVolumeNow: On screen: $V = {volume}\,\text{Å}^3$
```

Each line is **name: text**. Open the files in any editor (VS Code, Notepad) and save them as UTF-8. With `npm run dev` running, the page reloads by itself when you save.

## Where to find things

The files follow the screen: `01-start` → `02-modes` → `03-workspace` (top bar, panel, canvas, toolbar, Add cells drawer, ⋯ menu) → `04-lattices` (picker, crystal systems, lattice names, Lattice card) → `05-add-menu` → `06-input-bar` → `07`–`15` one per kind of object card → `16-defects` (all of Defects mode: top bar, Atoms, every defect card, its messages and formulas) → `17-stacking` (the close-packed stacking card) → `18-close-packed-planes` (Defects mode: slip on close-packed planes) → `19-challenge` (Challenge mode: setup, test, results, review) → `20-messages` (toasts and every error). `00-shared.txt` holds text that appears in several places. The help topics are in `help/`, one heading per topic, in the order Popover → SEE MORE: Derivation → SEE MORE: Your lattice. Pictures and 3D highlight captions are in `help/08-pictures.txt`; the Defects topics and their pictures are in `help/09-defects.txt`, and those on close-packed planes and Shockley partials in `help/11-close-packed-planes.txt`.

To find a sentence, search the folder for a few words you see on screen.

## Change freely

- **The text after `name: `**: wording, punctuation, spelling. Keep it on one line (turn on word wrap to read long lines).
- **HTML inside the text**: `<b>bold</b>`, `<i>italic</i>`, `<br>` (new line), `<a href="https://…">link</a>`, `<sub>1</sub>`, `<code>p1</code>`, `<kbd>Esc</kbd>`. Keep each tag paired (`<br>` stands alone). `&amp;` shows as &.
- **Headings** (lines starting with `#`) and **blank lines**: they are only there to help you find things.
- **Which file an entry is in**: you can move a line to another file or reorder lines.

## Do not touch

- **Entry names** (the part before the colon). The code asks for text by name.
- **Placeholders** in curly braces, like `{volume}` or `{name}`: the program fills them in. You can move them within the sentence, but keep their spelling. When in doubt, leave anything in `{ }` as it is: formulas and notation such as `{hkl}` use braces too.
- **Markers** in square brackets, like `[diagram: …]`: they show where the program draws a picture or a 3D highlight. The pictures themselves are in the code.
- **Formula syntax**: text between `$…$`, and entries whose names end in `Tex` or start with `formula`, are LaTeX for KaTeX (`\frac{a}{b}`, `\mathbf a`, `^2`). You can change a formula, but it must stay valid LaTeX.

## If something breaks

`npm test` checks every file: a line that isn't `name: text`, a name used twice or a missing name fails the tests and says which file and line. A lost `{placeholder}` fails the tests that show that text. In the browser the same problems show as errors in the console, and a missing entry shows its name instead of the text.

## Not in this folder

- What you type in the input bar (command names like `Angle`, `Spacing`, the site words `oct`, `tet`, `cub`, structure names like `NaCl`) and the examples of it (`Angle(d1, p1)`, `[1 1 0]`): they are the input language, so they stay in the code.
- Numbers, indices with overbars and other notation the program builds from the values on screen.
- The names of the self-check tests (shown only in the browser console with `npm run dev`), in `src/verification/cases.js`.
- The page title, description and "needs JavaScript" line in `index.html`, shown before the app has loaded.
- The Challenge mode questions and their solutions: they are in `challenge_templates/` (see its README.md).
