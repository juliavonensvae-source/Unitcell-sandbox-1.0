/* =====================================================================
   Short help descriptions, by key. The text itself is in text/05-add-menu.txt
   (descriptions) and text/04-lattices.txt (crystal systems).

   HELP maps a key to 1–2 sentences for a first-year university student,
   shown in the + Add menu, in object settings and in calculation cards.
   The "?" popovers and SEE MORE panels (formulas in KaTeX, symbols,
   derivations, worked examples) are built in src/help/topics/ from the
   text in text/help/ — see src/help/index.js for the topic format.
   ===================================================================== */

import { txt } from '../text.js';
export const HELP = {
  /* ---------- lattice & scene objects ---------- */
  'lattice-points': txt('descLatticePoints'),
  supercell: txt('descSupercell'),

  /* ---------- added objects ---------- */
  direction: txt('descDirection'),
  plane: txt('descPlane'),
  spacing: txt('descSpacing'),
  intercepts: txt('descIntercepts'),
  'direction-components': txt('descComponents'),
  interstitials: txt('descInterstitials'),
  'atom-fit': txt('descAtomFit'),

  /* ---------- calculations ---------- */
  'calc-volume': txt('descVolume'),
  'calc-points': txt('descPoints'),
  'calc-packing': txt('descPacking'),
  'calc-nn': txt('descNN'),
  'calc-dspacing': txt('descDSpacing'),
  'calc-bragg': txt('descBragg'),
  'calc-metric': txt('descMetric'),

  /* ---------- modes ---------- */
  advanced: txt('descAdvanced'),
};

/** Explanatory sentences shown under each crystal system in the lattice picker. */
export const SYSTEM_BLURBS = {
  cubic: txt('blurbCubic'),
  tetragonal: txt('blurbTetragonal'),
  orthorhombic: txt('blurbOrthorhombic'),
  hexagonal: txt('blurbHexagonal'),
  rhombohedral: txt('blurbRhombohedral'),
  monoclinic: txt('blurbMonoclinic'),
  triclinic: txt('blurbTriclinic'),
};
