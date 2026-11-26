# ewc-animations

GSAP + ScrollTrigger motion for the EWC Webflow site. Loaded from the site footer, pinned to a commit SHA.

```html
<script src="https://cdn.jsdelivr.net/gh/nomanwebflow/ewc-animations@<sha>/animations/gsap.min.js"></script>
```

Sections opt in with `data-animation-trigger="<name>"`. Build: `npx terser animations/gsap.js -c -m -o animations/gsap.min.js`.
