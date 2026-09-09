# Verification notes

- `npm test`: area conservation, watertight triangulation, seed reproducibility, impact-dependent cells, finite rigid simulation and floor clearance.
- Browser: inspect separated cuts; scrub to 1.18 seconds; reverse to time zero; regenerate 42 cells with seed 17 and moved impact; export OBJ; undo to the original 30 cells.
- Screenshots show actual interior cut geometry and a frame from the computed trajectory.
- Material choices are visual presets, and fragment-to-fragment collisions are outside this bounded implementation.
