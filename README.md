# berkeley-esg

Hosted scripts for the Berkeley UAE /esg page (Webflow). Served through jsDelivr, pinned to a commit.

- `esg.js`: Lenis smooth scroll, milestone logo tiles, ESG Solutions pinned block, Matrix Model horizontal scroll (needs GSAP 3.12 + ScrollTrigger + Lenis loaded first).
- `esg-gl.js`: ES module. The four WebGL scenes (hero globe, Matrix, Impact in Numbers, CTA); loads three.js 0.169 and the files in `assets/`.

Source of truth: `esg/webflow/` in the Ubrik Berkeley project. Edit there, commit here, then update the pinned commit in the page code.
