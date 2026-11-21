# Muuve style study

Source: the builder's sibling project is `../Muuve` (capital M). Inspected read-only; no files there were changed. This is a style adaptation, not a copy of its identity.

| Element | Found values | Source file |
|---|---|---|
| Base palette | ink #0d0d0c, cream #fbf6ef, paper #fffdf9; muted ink opacity .56/.42; border .12; destructive #c8402f | ../Muuve/apps/web/app/globals.css :root |
| Sage | #e9ebe0, #dfe9d4, #3fb874, #1f7a49 | globals.css @theme |
| Lemon | #f2ecdf, #f4ebc6, #e9c22e, #7d6200 | globals.css @theme |
| Peach | #f8dcc7, #f9cba9, #f2772f, #a9441a | globals.css @theme |
| Rose | #f0e4e6, #ecd6e2, #c564c4, #873a86 | globals.css @theme |
| Dark mode | None defined. An ink card (#262624) is a contrasting surface, not a dark theme | globals.css; ../Muuve/apps/web/components/app/kit.tsx Card |
| Font | Inter Tight, Latin, display swap; system/-apple-system/Segoe UI fallback | ../Muuve/apps/web/app/layout.tsx Inter_Tight; globals.css @theme |
| Type | hero 172px/0.86, weight 500, tracking -.032em at 1440 frame; phone clamp(52px,15.5vw,88px). Section 40/64px, tracking -.035em; card title 22px/500; body 16/18px; labels 13px/500 | ../Muuve/apps/web/components/marketing/hero.module.css .headline/mobile; marketing/HowItWorksSection.tsx; app/kit.tsx |
| Spacing | 4px-based utility scale; app page 16/32px gutters, 16/28px top, 32/48px main gap; cards 20/24px; marketing desktop gutter 112px, mobile 16px | app/AppShell.tsx; app/kit.tsx; marketing/hero.module.css |
| Radius | cards 28px; inputs/notices 16px; sheets 32px; buttons/nav full pill; marketing CTAs 10px, nav CTA 7px | app/kit.tsx; ui/button.tsx; marketing/hero.module.css |
| Shadows | paper inset 0 1px 0 white/.9, 0 20px 40px -24px warm ink/.25; ink 0 24px 48px -24px ink/.6; glass white inner highlights and lemon glow | app/kit.tsx Card; globals.css .glass-lens |
| Buttons | ink/cream default, 1.4px outline, soft paper, lemon/sage accents; heights 36/44/56px, text 13/15/16px, icon 16/18/20px; press scale .96, 300ms spring | ../Muuve/apps/web/components/ui/button.tsx |
| Inputs | height 48px, paper/.8, ink/.1 border, radius 16px, padding 16px, font 16px; focus ink/.4 border | app/kit.tsx inputClass; ui/glass.css provides a separate glass onboarding variant |
| Cards/table rows | translucent paper and pastel gradients; rounded containers, hairline dividers, 13px muted labels and 15/16px values. No general table primitive; adapt the app's activity/list rows for Quaestor tables | app/kit.tsx; app/AppShell.tsx |
| Navigation | outlined identity pill; desktop paper/.7 nav capsule, glass-lens selected pill; horizontal scroll on narrow screens | app/AppShell.tsx; globals.css .glass-lens |
| Icons/assets | Lucide line icons, mostly 18/20px; four glossy, tinted hero webp icons and footer video; fine SVG fractal-noise grain at .18 opacity | app/TintedIcon.tsx; app/kit.tsx; marketing/hero.module.css; apps/web/public/hero and footer |
| Backdrop/motion | warm cream-to-lemon gradient, lemon/peach radial glows; ease-out (.22,1,.36,1); reduced-motion overrides | app/kit.tsx AppBackdrop; globals.css |

All colour literals in Quaestor's web source live in `apps/web/src/theme/`. Components use semantic tokens. Quaestor uses its own name and original Q monogram; no Muuve logo/wordmark was copied. Marketing headings are responsively adapted to the longer Quaestor tagline.

## Redistribution

Inter Tight is the same family, fetched unmodified from the official Google Fonts repository because Muuve uses Next's Google-font loader rather than a checked-in redistributable font file. Source: https://github.com/google/fonts/tree/main/ofl/intertight. The SIL OFL 1.1 allows bundling/embedding and redistribution with its copyright and licence; the complete original `OFL.txt` is shipped beside the font. No font renaming/subsetting/modification was performed.

The selected Lucide SVGs were rendered from Muuve's installed lucide-react 1.64.0. Its ISC licence permits copying/distribution while retaining notices; the package also includes Feather-derived MIT notices. Both are retained verbatim in `apps/web/public/icons/LICENSE`.

The glossy WebPs/video have no separate asset provenance/licence file in the inspected public directory. They are not copied. Quaestor recreates the pastel/soft-glow illustration language using its own CSS and licensed line icons. No unverified third-party asset is redistributed.
