# Samsung model reference pass

Reviewed 19–20 September 2026. This is a local reconstruction, not manufacturer CAD. The measured data are kept in `src/data/samsung-reference.ts`; the catalogue and actual Three.js meshes consume those values. No reference images are bundled or requested by the running website.

## Published body dimensions

All dimensions below are **width × height × thickness, in millimeters**. Foldable rows distinguish the folded body from the unfolded body. Samsung notes that unfolded thickness excludes the main-screen frame; camera bumps are modeled separately.

| Model | Body / folded | Unfolded | Samsung source |
| --- | --- | --- | --- |
| Galaxy S III | 70.6 × 136.6 × 8.6 | — | [Korean launch specification graphic][s3-spec] |
| Galaxy S6 edge | 70.1 × 142.1 × 7.0 | — | [S6/S6 edge announcement][s6] |
| Galaxy S8 | 68.1 × 148.9 × 8.0 | — | [India launch table][s8] |
| Galaxy S10 | 70.4 × 149.9 × 7.8 | — | [S10 announcement][s10] |
| Galaxy S20 Ultra | 76.0 × 166.9 × 8.8 | — | [S20 announcement][s20] |
| Galaxy S22 Ultra | 77.9 × 163.3 × 8.9 | — | [S22 Ultra announcement][s22] |
| Galaxy S24 Ultra | 79.0 × 162.3 × 8.6 | — | [S24 announcement][s24] |
| Galaxy S25 Ultra | 77.6 × 162.8 × 8.2 | — | [S25 announcement][s25] |
| Galaxy S26 | 71.7 × 149.6 × 7.2 | — | [S26 announcement][s26] |
| Galaxy S26+ | 75.8 × 158.4 × 7.3 | — | [S26 announcement][s26] |
| Galaxy S26 Ultra | 78.1 × 163.6 × 7.9 | — | [S26 announcement][s26] |
| Galaxy Z Fold7 | 72.8 × 158.4 × 8.9 | 143.2 × 158.4 × 4.2 | [Fold7 announcement][fold7] |
| Galaxy Z Flip7 | 75.2 × 85.5 × 13.7 | 75.2 × 166.7 × 6.5 | [Flip7 announcement][flip7] |
| Galaxy Z Fold8 | 81.9 × 123.9 × 9.7 | 161.4 × 123.9 × 4.5 | [2026 foldable announcement][z8] |
| Galaxy Z Fold8 Ultra | 72.8 × 158.4 × 8.9 | 143.2 × 158.4 × 4.1 | [2026 foldable announcement][z8] |
| Galaxy Z Flip8 | 75.4 × 85.7 × 13.1 | 75.4 × 166.9 × 6.1 | [2026 foldable announcement][z8] |

## Display measurements versus drawing assumptions

The active rectangle is calculated from its full-rectangle diagonal and aspect ratio. A diagonal is not the usable area after rounded corners and camera holes. The hinge divides the inner rectangle into two matching panels; the cover has its own rectangle rather than inheriting the lid's dimensions.

The Fold7, Flip7, Fold8, Fold8 Ultra, and Flip8 sources publish inner and cover resolutions. Those pixel ratios determine the drawing aspect, normalized to the published diagonal rather than treating rounded pixel-density figures as exact. S10's source explicitly gives 19:9. S22/S24/S25 Ultra and the S26 family use the published diagonal but retain **illustrative aspect inputs** where the cited press tables do not give pixel dimensions. Their derived display insets are therefore not claimed as manufacturer-measured bezel widths.

## Visible corrections

The [Fold8 rear-camera photograph][fold8-photo] puts two lenses and the flash in one vertical capsule; the flash is below the lower camera. The [Flip8 cover photograph][flip8-photo] places both lenses at the lower right when closed. The model's lenses and side keys are attached to the moving lid, preserving this arrangement through folding. Flip7 also has its own coral finish and its own body measurements, instead of inheriting Flip8's pink trim and dimensions.

The [S22 Ultra launch photograph][s22-photo] and [S26 photograph][s26-photo] distinguish the small laser-focus window from photographic lenses. The renderer now draws that window with a quiet, flat material. The four camera lenses remain, the flash sits between the two smaller circles, and modern Galaxy volume rockers sit above the side key. S10 keeps its upper-right selfie hole and left-side Bixby control.

Exterior cover glass and its black mask now sit within the foldable's thickness budget. The moving panel's colored backing and Flip camera plate sit behind that display, avoiding both occlusion and coplanar reflections. Flip camera and flash barrels contact the exterior glass instead of retaining a gap from the old raised plate. The complete closed body/display envelope matches the cited thickness for all five measured foldables. In the unfolded drawing, the explicit inner-display/frame layers add at most 0.2024 mm above the nominal thickness; this is a rendering allowance, not a manufacturer measurement of the screen frame.

When a closed Fold reshapes into a Flip, attachment transforms blend through the shell rather than swinging cameras and buttons around a phone-length lever arm. Actual folding of either finished model retains its rigid lid attachment. This cross-model reshape is an illustrative morph, not a mechanical conversion between real devices.

The Flip-to-S26 handoff retains two matching half-height panels until they form the slab. The inner image is partitioned at one shared texture coordinate, with equal texture scale on both panels. Only the internal bevel and frame seam blend away; the exterior corners remain rounded. The upper selfie cutout and lid attachments remain continuous, and the exterior display stays off after opening as its mask fades into the body finish. Unfolding and reshaping overlap with matching forward/reverse timing instead of stopping between separate stages.

## Limits of this pass

Sixteen of the seventeen Galaxy entries have body dimensions tied to the primary sources above. The S20 Ultra source specifies its 6.9-inch, 1440 × 3200 display rectangle and its quad-camera system including DepthVision. On 20 September the Korean S III launch article supplied the missing dimensions and 1280 × 720 display in its specification graphic and descriptive alternative text; the S6 edge and S8 launch tables supplied their body dimensions and pixel resolutions. Galaxy S (2010) alone retains its earlier approximate body dimensions because its original primary specification table could not be reliably retrieved. It is **not a newly verified official reconstruction**.

The S6 edge source explicitly describes a display curved on both sides. The S8 source describes a dual-edge display and rounded enclosure; these models should not inherit a modern flat Ultra profile. Exact bend radii and front-facing versus developed display width are not published in those tables and remain rendering approximations.

The renderer now supplies separate rear-housing and front-glass profiles for the curved Galaxy generations. The S6 edge/S8 display and its dark mask roll off together near the long edges while the center stays flat. The modern flat Ultra entries have no inherited display bend. The catalogue retains its resolution-derived projected rectangle: it does not claim the bent surface's developed width is an additional verified measurement. S6 edge's selfie camera is placed to the right of the earpiece.

Corner radii, lens diameters and positions, optical coatings, exact hinge mechanics, curved-display profiles, grille details, and finish colors remain illustrative. Procedural wallpapers and clocks evoke the interface rather than reproducing Samsung's screen artwork. The audit is kept in this file instead of adding specifications or explanatory panels to the minimal product UI.

## Regression coverage

`npm run test:fold-geometry` checks the actual meshes: complete closed/open body and display extents, per-layer thickness budgets, unobstructed exterior-glass ordering, separate inner/cover diagonals and ratios, thin glass clearance, noncoplanar metal/glass surfaces, camera count, passive focus windows, moving-lid camera/button attachment, and the existing rotation/perspective separation suite. The envelope includes both metal panels, the hinge, back glass, display masks, inner/cover screens, camera-hole masks, and the crease. Cameras, surface decals, controls, and antenna strips are separate details rather than part of that structural thickness measurement.

Both directions of Fold7/Flip7 and Fold8 Ultra/Flip8 morphs are sampled immediately before and after the hinge-axis switch. The checks cover world-coordinate camera, key, flash and cover-hole positions as well as all three dimensions of the exterior screen envelope. Another 101 samples per direction bound visible camera assemblies, backing plates and keys near the closed shell and check finite world/normal transforms, catching smooth but implausibly large attachment excursions. `npm run test:catalogue` covers navigation, metadata, and morph continuity. The production build type-checks the complete application.

[s10]: https://news.samsung.com/global/samsung-raises-the-bar-with-galaxy-s10-more-screen-cameras-and-choices
[s20]: https://news.samsung.com/my/introducing-the-samsung-galaxy-s20-change-the-way-you-experience-the-world
[s3]: https://news.samsung.com/global/samsung-introduces-the-galaxy-s-iii-the-smartphone-designed-for-humans-and-inspired-by-nature
[s3-spec]: https://news.samsung.com/kr/%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90-%EA%B0%A4%EB%9F%AD%EC%8B%9Cs%E2%85%A2-%EC%A0%84%EA%B2%A9-%EA%B3%B5%EA%B0%9C
[s6]: https://news.samsung.com/global/beautifully-crafted-from-metal-and-glass-samsung-galaxy-s6-and-galaxy-s6-edge-define-whats-next-in-mobility
[s8]: https://news.samsung.com/in/smartphones-without-limits-samsung-galaxy-s8-and-galaxy-s8-launched-in-india
[s22]: https://news.samsung.com/global/samsung-galaxy-s22-ultra-offers-the-ultimate-and-most-premium-s-series-experience-yet
[s24]: https://news.samsung.com/global/enter-the-new-era-of-mobile-ai-with-samsung-galaxy-s24-series
[s25]: https://news.samsung.com/global/samsung-galaxy-s25-series-sets-the-standard-of-ai-phone-as-a-true-ai-companion
[s26]: https://news.samsung.com/sg/samsung-unveils-galaxy-s26-series-the-most-intuitive-galaxy-ai-phone-yet
[fold7]: https://news.samsung.com/global/samsung-galaxy-z-fold7-raising-the-bar-for-smartphones
[flip7]: https://news.samsung.com/global/samsung-galaxy-z-flip7-a-pocket-sized-ai-powerhouse-with-a-new-edge-to-edge-flexwindow
[z8]: https://news.samsung.com/global/samsung-galaxy-z-fold8-ultra-fold8-and-flip8foldables-perfected-for-every-way-of-living
[s22-photo]: https://img.global.news.samsung.com/global/wp-content/uploads/2022/02/Galaxy_S22_Ultra_PR_main1F.jpg
[s26-photo]: https://img.global.news.samsung.com/sg/wp-content/uploads/2026/02/Galaxy-S26-Series-Full-1000x501.jpg
[fold8-photo]: https://img.global.news.samsung.com/global/wp-content/uploads/2026/07/22230405/Samsung-Mobile-Galaxy-Unpacked-July-2026-Galaxy-Z-Fold8-Ultra-Galaxy-Z-Fold8-Galaxy-Z-Flip8-Launch_main3_FINAL.jpg
[flip8-photo]: https://img.global.news.samsung.com/global/wp-content/uploads/2026/07/22221333/Samsung-Mobile-Galaxy-Unpacked-July-2026-Galaxy-Z-Fold8-Ultra-Galaxy-Z-Flip8-Launch_main8.jpg
