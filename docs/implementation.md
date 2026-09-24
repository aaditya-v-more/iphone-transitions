# Shape — The Phone Design Archive

A minimal, local 3D archive of iPhone and Samsung Galaxy design. Formerly iPhone Transitions; the project and package are now **Shape** (`shape-phone-archive`). Scroll through 20 iPhone and 17 Galaxy milestones, switch brands, inspect either side, and fold or unfold supported models.

## Run locally

```sh
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Open http://127.0.0.1:5173/.

## Hosting

The public archive is mounted at `https://studio.aadityamore.com/shape/`.
`npm run build:vercel` packages its assets and sitemap under `vercel-dist/shape/`.
Studio routing and the collection listing are maintained in the `resume` repository.
The independent Vercel project follows this repository's `main` branch. Only the
standalone upstream root redirects to Studio; `/shape/` stays available for its rewrite.

## Controls

- Scroll, use the timeline, or press Left/Right to change models. Home/End jump to the first/last model.
- **All models** opens the model picker. **Apple / Samsung** starts the selected brand's timeline.
- Drag to rotate on desktop, or use the rotation button on any device.
- **Front / Back / Both sides** changes the view. **Fold / Unfold** operates the folding display.
- Book folds take shape before opening. Clamshell transitions overlap unfolding and reshaping, preserving two aligned panels and a continuous image as the hinge seam disappears. Scrolling backward retraces the movement.
- Both views share the same hinge position. Fold controls remember each model's pose while you explore its brand, and clamshells have a dedicated outer display.
- The play button starts a guided journey; scrolling or touching the screen stops it.

## Validation

```sh
npm run build
npm run test:catalogue
npm run test:fold-geometry
npm run test:flip-slab
npm run test:manufacturer-specs
npm run test:body-profiles
npm run test:hinge-controls
```

The catalogue checks cover model metadata, camera bounds, chronological ordering, navigation hold points, continuous interpolation, and the requested current models. Browser checks cover desktop/mobile layout, brand switching, model selection, display modes, folding, and dialog navigation. Earlier review artifacts and the original SVG-focused test suite are retained in the working directory; their selectors describe the previous interface.

## Implementation

React + Motion drive scroll and the UI. Three.js renders a single persistent scene. Rounded meshes keep a fixed topology while dimensions and materials interpolate; camera optics, metal edges, ports, and folding panels are modeled geometry. Wallpapers are generated locally. There are no runtime asset downloads, analytics, or remote APIs.

The scene is loaded separately from the interface, caps pixel density, pauses when the tab is hidden, and disposes its resources on unmount. Reduced-motion preferences disable inertia and idle movement. An SVG illustration keeps navigation usable if WebGL is unavailable.

The fold geometry checks exercise actual Three.js meshes at intermediate hinge angles, checking lid direction, closed-screen clearance, attached cameras, continuous wallpaper alignment, and the closed silhouette when changing hinge axes.

The local development page at `/review/transition-lab.html` pauses the production scene at selected transition positions for visual review. It is not part of the production entry or the public viewer. Flip/slab transitions keep the cover display within its panel, turn it off while unfolding, fade its black mask into the rear finish, and retain the selfie cutout and attached controls throughout. Their easing has continuous acceleration at stage boundaries, and the forward/reverse paths match.

`test:flip-slab` checks the actual half-panel meshes, the shader's texture mapping, attachment trajectories, reverse paths, and the handoff to each held device. It covers Flip7 and Flip8 against S26 and S26 Ultra with closed, partly open, and open starting poses.

`test:manufacturer-specs` checks the Apple reference coverage, actual rendered body/display dimensions, physical rear-camera count and absence of modern front-camera/flash hardware on the original and 3GS. The fold suite also checks Duo against its own Apple dimensions and independent display rectangles.

`test:body-profiles` checks the rendered historical enclosures, their attachments, and curved-to-flat morphs. Enclosure profiles preserve the original iPhone's rounded aluminum back, the more bulbous 3GS, the flatter iPhone 4/5, and the rounded 6–11 families. Rear caps are shaded on the same surface rather than attached as floating rectangles. The original and 3GS have a top sleep/wake key, a left volume rocker and silent switch, and a circular Home button with an outlined square. The iPhone 4/5 have round volume keys; iPhone 5 has the narrower Lightning opening and its selfie camera above the earpiece. Supported modern iPhones have their separate Camera Control; 17e does not inherit it.

The selected curved-screen Galaxy generations have flat central glass and curved long edges on both the display mask and illuminated screen. Glass, body, and rear-profile parameters interpolate together. Exact curve radii remain photographic estimates, not additional manufacturer measurements.

The [hinge and control review](../review/hinge-controls.md) documents continuous spine appearance, exterior hinge clearance during opening, rounded side-facing buttons, centered Galaxy controls, and Duo's leaf-mounted top volume controls. `test:hinge-controls` exercises intermediate geometry, reversibility and actual button silhouettes; fine hardware dimensions remain illustrative.

## Photo reference and display materials

The iPhone Air refinement uses [Apple's front/edge photograph](https://www.apple.com/v/iphone-air/i/images/overview/camera/hero_camera__b3wz3l2dh0wi_large.jpg), [rear camera photograph](https://www.apple.com/v/iphone-air/i/images/overview/camera/camera__gl56mvovq6qi_large.jpg), and [technical specifications](https://www.apple.com/iphone-air/specs/), reviewed on 19 September 2026. Its body uses 74.7 × 156.2 × 5.64 mm. The active display rectangle is derived from 1260 × 2736 pixels at 460 ppi; the resulting inset includes the frame and black border. Corner, camera-plateau, and optical details remain illustrative photo matches, not CAD measurements. Reference photographs are not bundled or fetched at runtime.

Black glass and the metallic rim have independent materials. Environment textures are explicitly bound to each material because Three.js otherwise replaces their reflection intensity with the scene-wide setting. This removes the gray reflection wash from the display border without flattening the metal, camera lenses, or model transitions. The mesh checks also cover Air's display proportions and ownership of the shared environment texture.

## Product data

The [Apple reference audit](../review/apple-reference.md) records source-linked body and display inputs for all twenty iPhone entries, including independent folded/open dimensions and display rectangles for Duo. The [Samsung reference audit](../review/samsung-reference.md) records sourced dimensions for sixteen Galaxy models. The original Galaxy S retains approximate body dimensions pending a retrievable primary specification source. Exact curvature, corner radii and optics remain photo-based artwork; these limits are documented without adding clutter to the viewer.

The catalogue represents selected design milestones, not every released SKU. Models are original, simplified reconstructions rather than manufacturer CAD assets; finishes, subtle geometry, and screen artwork are illustrative.

Current lineups were checked on 19 September 2026 against [Apple's iPhone lineup](https://www.apple.com/iphone/), [iPhone 18 Pro specifications](https://www.apple.com/iphone-18-pro/specs/), [iPhone Duo specifications](https://www.apple.com/iphone-duo/specs/), [Samsung's S26 announcement](https://news.samsung.com/sg/samsung-unveils-galaxy-s26-series-the-most-intuitive-galaxy-ai-phone-yet), and [Samsung's Fold8 / Flip8 announcement](https://news.samsung.com/global/samsung-galaxy-z-fold8-ultra-fold8-and-flip8foldables-perfected-for-every-way-of-living). The iPhone Duo entry is marked as announced, with availability from October 23, 2026.
