# Hinge and control review — 21 September 2026

## Hinge

The former spine was an opaque full-height block enabled at a 1% fold-weight threshold. Its depth was interpolated between open and closed thicknesses, which let it cross the opening between the displays at intermediate angles.

The replacement is a fixed-topology exterior cover connecting the rear edges of the leaves. Its section bulges away from both inner displays and retracts as the leaves open. Its closed overhang preserves the manufacturer-derived folded envelope. Geometry and opacity grow continuously with fold weight. Reverse book-to-slab choreography retraces the forward transition, including manually chosen hinge positions. Changing between book and clamshell axes smoothly retracts and reforms the cover.

This is illustrative hinge motion, not a reconstruction of the manufacturer's internal mechanism. [Apple's open-body image](https://www.apple.com/v/iphone-duo/b/images/specs/dimensions_open__eguzpsjq732a_large.jpg) and [closed-body image](https://www.apple.com/v/iphone-duo/b/images/specs/dimensions_close__c30blze63ey6_large.jpg) were inspected alongside the [Duo specifications](https://www.apple.com/iphone-duo/specs/).

## Controls

Side buttons now round the visible side-facing Y/Z silhouette. Previously their X/Y outline was rounded while the face visible from the side remained rectangular. Long buttons and Camera Control have rounded end caps; iPhone 4/5 retain circular volume keys. Top sleep/wake controls round their top-facing surface.

The generic frontward displacement driven by rear-housing curvature has been removed from later devices. S8, S10 and other Galaxy controls are centered in the body's thickness. Original iPhone/3GS keep their explicit front-rim placement. Button widths, lengths and cap radii remain illustrative, not published engineering dimensions.

Apple's [iPhone 18 Pro control diagram](https://www.apple.com/v/iphone-18-pro/b/images/specs/external_connectors__fkne9b4ixsyi_large.jpg), [iPhone 4 photograph](https://cdsassets.apple.com/live/7WUAS350/images/iphone/iphone-iphone4-colors.jpg), and [iPhone 5 control diagram](https://cdsassets.apple.com/live/SZLF0YNV/images/sp/112016_sp655_iphone5_connectors.jpg) provide generation-specific references. [Duo's diagram](https://www.apple.com/v/iphone-duo/b/images/specs/external_connectors__fjf6vf5ap02m_large.jpg) and control list show top volume controls, a side button and Camera Control. Duo now has top volume pairs attached to the respective leaves, enabled Camera Control, and no inherited Action button.

Samsung's [S8 launch description](https://news.samsung.com/in/smartphones-without-limits-samsung-galaxy-s8-and-galaxy-s8-launched-in-india) describes symmetrical sides, a dual-edge display and a separate Bixby button. The [S8 support page](https://www.samsung.com/uk/support/model/SM-G950FZKABTU/) was retrieved, but its linked manual could not be fetched during this pass. The [S24 announcement](https://news.samsung.com/global/enter-the-new-era-of-mobile-ai-with-samsung-galaxy-s24-series) and [support page](https://www.samsung.com/uk/support/model/SM-S928BZKHEUB/) also do not supply button cap radii or precise depth coordinates. Samsung depth centering and cap geometry are therefore explicit rendering estimates, not newly verified manufacturer measurements.

## Regression checks

`npm run test:hinge-controls` tests the actual mesh vertices against both panel opening boundaries at 81 hinge angles for every foldable. It samples the former appearance threshold, verifies continuous geometry/opacity and forward/reverse book transitions, and raycasts side controls to distinguish rounded caps from rectangular extrusions. Duo top controls are checked in their host leaf's coordinates throughout folding. Existing tests continue to cover published complete folded/open dimensions, camera attachments, rotation separation, legacy curved bodies and Flip/slab handoffs.
