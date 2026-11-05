/* CrystalMath — everything numerical lives under src/math and is re-exported here.
   No module in this folder touches the DOM or Three.js, so it all runs in tests. */
export * from './linalg.js';
export * from './lattice.js';
export * from './basis.js';
export * from './analysis.js';
export * from './indices.js';
export * from './planes.js';
export * from './intercepts.js';
export {
  boxRegion, hexPrismRegion, insideRegion, sitesInRegion, sitesNearRegion, shareOf, pointCount,
  clipLineToRegion,
  boxBetween, grownRegion, cellOrigin, originOf, clampCell, translateRegion, cellUnderRay,
  prismFieldRegion, prismOrigin, PRISM_STEPS, inRegion,
} from './cells.js';
export * from './interstitials.js';
export * from './ionic.js';
export * from './stacking.js';
export * from './defects.js';
export * from './dislocations.js';
export * from './slip.js';
