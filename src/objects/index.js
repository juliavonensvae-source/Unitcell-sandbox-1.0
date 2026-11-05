/* Registers every object type. Add new type modules here. */
import './scene-objects.js';
import './direction.js';
import './plane.js';
import './calculations.js';
import './angle.js';
import './spacing.js';
import './intercepts.js';
import './components.js';
import './interstitials.js';
import './atom-fit.js';
import './ionic.js';
import './stacking.js';
import './flat-objects.js';
import './crystal.js';
import './point-defects.js';
import './point-defect-commands.js';
import './dislocations.js';
import './burgers.js';
import './slip.js';
import './vacancy-conc.js';
import { txt } from '../text.js';

export { getType, menuEntries } from './registry.js';

/* Categories of the + Add menu, in display order. `dims`: the views (3D / 2D) that show the category;
   `mode`: 'defects' for Defects mode (the rest belong to Crystal Structures). */
export const CATEGORIES = [
  { id: 'directions', title: txt('catDirections'), icon: 'arrow', blurb: txt('catDirectionsBlurb'), dims: ['3d', '2d'] },
  { id: 'vectors', title: txt('catVectors'), icon: 'arrow', blurb: txt('catVectorsBlurb'), dims: ['2d'] },
  { id: 'lines', title: txt('catLines'), icon: 'plane', blurb: txt('catLinesBlurb'), dims: ['2d'] },
  { id: 'planes', title: txt('catPlanes'), icon: 'plane', blurb: txt('catPlanesBlurb'), dims: ['3d'] },
  { id: 'intercepts', title: txt('catIntercepts'), icon: 'intercept', blurb: txt('catInterceptsBlurb'), dims: ['3d'] },
  { id: 'interstitials', title: txt('catSites'), icon: 'void', blurb: txt('catSitesBlurb'), dims: ['3d'] },
  { id: 'ionic', title: txt('catIonic'), icon: 'ions', blurb: txt('catIonicBlurb'), dims: ['3d'] },
  { id: 'stacking', title: txt('catStacking'), icon: 'layers', blurb: txt('catStackingBlurb'), dims: ['3d'] },
  { id: 'calculations', title: txt('catCalculations'), icon: 'calc', blurb: txt('catCalculationsBlurb'), dims: ['3d'] },
  { id: 'point-defects', title: txt('catPointDefects'), icon: 'void', blurb: txt('catPointDefectsBlurb'), dims: ['3d'], mode: 'defects' },
  { id: 'line-defects', title: txt('catLineDefects'), icon: 'edge', blurb: txt('catLineDefectsBlurb'), dims: ['3d'], mode: 'defects' },
  { id: 'slip', title: txt('catSlip'), icon: 'layers', blurb: txt('catSlipBlurb'), dims: ['3d'], mode: 'defects' },
  { id: 'defect-calcs', title: txt('catCalculations'), icon: 'calc', blurb: txt('catDefectCalcsBlurb'), dims: ['3d'], mode: 'defects' },
];
