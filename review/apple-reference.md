# Apple model reference pass

Reviewed 20 September 2026. Source values live in `src/data/apple-reference.ts` and are applied to the actual catalogue. This is an original illustration, not manufacturer CAD.

## Body and display measurements

Body dimensions below are **width × height × thickness in millimeters**, excluding separate camera assemblies. Display values are **width pixels × height pixels / pixels per inch**. The rendered full rectangle uses resolution divided by published PPI; a marketed diagonal and rounded PPI need not agree to infinite precision. Viewable area is smaller after rounded corners and camera cutouts. No derived inset is claimed to be a measured bezel width.

| Model | Body / folded | Display | Apple technical specifications |
| --- | --- | --- | --- |
| iPhone (2007) | 61 × 115 × 11.6 | 320 × 480 / 163 | [Original](https://support.apple.com/en-us/112445) |
| iPhone 3GS | 62.1 × 115.5 × 12.3 | 320 × 480 / 163 | [3GS](https://support.apple.com/en-us/112307) |
| iPhone 4 | 58.6 × 115.2 × 9.3 | 640 × 960 / 326 | [4](https://support.apple.com/en-us/112562) |
| iPhone 5 | 58.6 × 123.8 × 7.6 | 640 × 1136 / 326 | [5](https://support.apple.com/en-us/112016) |
| iPhone 6 | 67 × 138.1 × 6.9 | 750 × 1334 / 326 | [6](https://support.apple.com/en-us/111954) |
| iPhone 7 Plus | 77.9 × 158.2 × 7.3 | 1080 × 1920 / 401 | [7 Plus](https://support.apple.com/en-us/111953) |
| iPhone X | 70.9 × 143.6 × 7.7 | 1125 × 2436 / 458 | [X](https://support.apple.com/en-us/111864) |
| iPhone 11 Pro | 71.4 × 144 × 8.1 | 1125 × 2436 / 458 | [11 Pro](https://support.apple.com/en-us/111879) |
| iPhone 12 | 71.5 × 146.7 × 7.4 | 1170 × 2532 / 460 | [12](https://support.apple.com/en-us/111876) |
| iPhone 14 Pro | 71.5 × 147.5 × 7.85 | 1179 × 2556 / 460 | [14 Pro](https://support.apple.com/en-us/111849) |
| iPhone 15 Pro | 70.6 × 146.6 × 8.25 | 1179 × 2556 / 460 | [15 Pro](https://support.apple.com/en-us/111829) |
| iPhone 16 Pro | 71.5 × 149.6 × 8.25 | 1206 × 2622 / 460 | [16 Pro](https://support.apple.com/en-us/121031) |
| iPhone 17 | 71.5 × 149.6 × 7.95 | 1206 × 2622 / 460 | [17](https://support.apple.com/en-us/125089) |
| iPhone Air | 74.7 × 156.2 × 5.64 | 1260 × 2736 / 460 | [Air](https://support.apple.com/en-us/125092) |
| iPhone 17 Pro | 71.9 × 150 × 8.75 | 1206 × 2622 / 460 | [17 Pro](https://support.apple.com/en-us/125090) |
| iPhone 17 Pro Max | 78 × 163.4 × 8.75 | 1320 × 2868 / 460 | [17 Pro Max](https://support.apple.com/en-us/125091) |
| iPhone 17e | 71.5 × 146.7 × 7.8 | 1170 × 2532 / 460 | [17e](https://support.apple.com/en-us/126470) |
| iPhone 18 Pro | 71.9 × 150 × 8.75 | 1206 × 2622 / 460 | [18 Pro](https://support.apple.com/en-us/148590) |
| iPhone 18 Pro Max | 78 × 163.4 × 8.75 | 1320 × 2868 / 460 | [18 Pro Max](https://support.apple.com/en-us/148591) |
| iPhone Duo | 84.1 × 117.8 × 11.3 | Outer: 1398 × 2034 / 460 | [Duo](https://www.apple.com/iphone-duo/specs/) |

Duo's open body is 164.6 × 117.8 × 5.2 mm. Its landscape inner rectangle is 2670 × 1878 pixels at 430 PPI. Inner and cover displays have independent dimensions, rather than inheriting the body aspect or stretching a single-panel screen across the hinge. The tiny inner display/frame rendering layers are separate from the nominal chassis thickness.

## Shape and hardware references

Apple's [model identification guide](https://support.apple.com/en-us/108044) supplies generation-specific descriptions and photos. The [original iPhone photograph](https://cdsassets.apple.com/live/7WUAS350/images/iphone/iphone-iphone-original-colors.jpg) shows flat front glass, a narrow chrome perimeter, rounded aluminum rear edges and a black lower plastic cap. The [3GS photograph](https://cdsassets.apple.com/live/7WUAS350/images/iphone/iphone-iphone3gs-colors.jpg) shows a more bulbous plastic rear; the [iPhone 4 photograph](https://cdsassets.apple.com/live/7WUAS350/images/iphone/iphone-iphone4-colors.jpg) shows the deliberately flat steel-and-glass construction. A rounded front outline is not the same feature as a curved depth profile.

The original and 3GS have a top sleep/wake button, left-side volume and silent controls, a Home button, one rear camera, no rear flash, and no selfie camera. Later phones retain their own camera, flash and front-control configurations. Source-linked camera counts distinguish physical cameras from crop/zoom modes and other sensors.

The renderer now uses depth profiles, with multiple contour rings, for the original/3GS and rounded 6–11 families. The 4/5 and later flat families retain their distinct flat central surfaces and rails. The rear skin follows the body, and the original's lower plastic cap is a material region on that skin, including its curved edges. The cap's approximately one-fifth height is a photographic proportion. Camera mounts and rear logos follow the surface instead of retaining a generic slab offset. Body profiles preserve the published maximum width, height and chassis depth.

The [iPhone 5 specification](https://support.apple.com/en-us/112016) and [identification photo](https://cdsassets.apple.com/live/7WUAS350/images/iphone/iphone-iphone5-colors.jpg) distinguish its Lightning connector and centered selfie camera above the earpiece. The renderer also distinguishes a single early volume rocker from the 4/5's circular volume keys. The Home symbol is an outline. [iPhone 16 Pro](https://support.apple.com/en-us/121031) and subsequent applicable models get separate Camera Control geometry. [17e's external-control list](https://support.apple.com/en-us/126470) omits Camera Control, so it is explicitly disabled rather than inherited from another model.

## Limits

All 20 Apple entries have source-linked body and display inputs. Precise enclosure curvature, corner radii, glass roll-off, optics, hardware positions, finishes and wallpapers remain illustrative photo-based approximations. Published overall dimensions do not determine those surfaces uniquely. The audit and numerical checks prevent generic slabs or inherited proportions from being presented as measured manufacturer geometry; they do not certify a CAD-accurate replica.
