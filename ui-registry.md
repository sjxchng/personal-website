### Portfolio Story Cards

File: index.html
Last updated: 2026-08-14

| Property         | Class / Value |
| ---------------- | ------------- |
| Background       | `--panel: rgba(255,207,143,0.055)` on hover |
| Border           | `1px solid transparent`; hover uses `--panel-border: rgba(255,207,143,0.18)` |
| Border radius    | `8px` |
| Text - primary   | `--ink`, Bricolage Grotesque, 600 weight |
| Text - secondary | `--ink-dim`, 15px, 1.55 line-height |
| Spacing          | Card padding `20px 22px`; entry gap `52px`; media/text gap `18px` |
| Hover state      | Subtle warm panel fill, warm border, `translateX(4px)`, corner arrow brightens and shifts |
| Shadow           | none |
| Accent usage     | `--accent` for camp labels, stats, and destination metadata |

**Pattern notes:**
Portfolio entries should feel like quiet expedition markers rather than heavy panels. Use image or logo marks at `58px` square, with `8px` radius. Card media should use `slide-logo` when a story can contain multiple affiliated logos/photos: children fill the full square with `object-fit: cover` and slide horizontally rather than fading in place. Apply `visual-mark` to non-school imagery so mixed brand colors and photos sit in the same muted frame. The Berkeley education entry is a simple vertical identity block: opaque Berkeley logo above regular role/org/GPA text, matching the rest of the portfolio typography instead of custom text wrapping. Clickable cards use the circular `↗` corner affordance.

### Trailhead And Guide

File: index.html
Last updated: 2026-08-14

| Property         | Class / Value |
| ---------------- | ------------- |
| Background       | Trailhead nature scene followed by full-screen firefly guide section |
| Border           | none for opening identity |
| Border radius    | none for opening identity |
| Text - primary   | Opening: `Siwoo Chung`; guide: `Click on my experience, projects, and activities to take a closer look.` |
| Text - secondary | Opening: `Berkeley Engineering` |
| Spacing          | Trailhead opening followed by long guide section before Education |
| Hover state      | none |
| Shadow           | none |
| Accent usage     | Firefly provides the guiding accent; highlighted guide phrase uses `--accent` |

**Pattern notes:**
The site starts with a normal opening identity section over the trailhead nature scene, then moves into the firefly guide beat before Education. Do not reintroduce the wooden signpost for the name/school; use regular HTML text: `Siwoo Chung` and `Berkeley Engineering`. Avoid the old firefly glitch: the firefly must start off-screen right, ease in slowly with its own timer, and not switch to the normal path until scrolling begins. Trailhead grass should use a deliberately dense instanced blade field, with high uniform coverage plus natural jitter/clumping so the ground reads as continuous dark grass, not sparse strokes. Current grass baseline is roughly `1020 x 680` instanced blades with taller, wider blades for a thicker foreground field. Mountains should be generated as closed heightfield terrain with all four edges tapering down naturally, sloped perimeter closure, and no hollow visible underside. Click-through firefly routes should use terrain-aware flyover curves with clearance above sampled mountain height so project and experience transitions never pass under ridge geometry. The summit contact section should cap the 3D camera near `VISUAL_SCROLL_MAX = 0.91` and use a `100vh` final section so the final view lands around the starry mountain composition rather than drifting into empty sky.

### Coursework And Skills Sections

File: index.html
Last updated: 2026-08-15

| Property         | Class / Value |
| ---------------- | ------------- |
| Background       | `course-card`: subtle warm/ink gradient; `skill-card`: translucent ink panel |
| Border           | `1px solid rgba(217,189,130,0.16)` |
| Border radius    | `8px` |
| Text - primary   | Bricolage Grotesque semibold for coursework names |
| Text - secondary | JetBrains Mono uppercase labels and skill names |
| Spacing          | Coursework grid `14px`; Skills grid `14px`; compact square skill tiles |
| Hover state      | none currently |
| Shadow           | Skill tiles use subtle inset frame |
| Accent usage     | Skill logos use Simple Icons in `--accent` gold; course area labels use `--accent` |

**Pattern notes:**
Coursework should mirror the resume source of truth and stay in compact category-forward tiles. Skills use compact logo tiles sourced from Simple Icons or verified CDN SVGs when reliable. SQL uses a generic inline database symbol rather than a product logo. If a colored third-party SVG is used, filter it into the muted gold system and test visibility against the dark mountain background. Keep the skills list concrete and portfolio-relevant: broad categories like AWS are fine, but avoid individual AWS service tiles and vague concept badges unless explicitly requested.

### Section HUD

File: js/app.js
Last updated: 2026-08-15

| Property         | Class / Value |
| ---------------- | ------------- |
| Source of truth  | `.camp` sections with `data-name` and `data-elev` |
| Bottom-right     | `#camp-val` displays active section label |
| Top-left         | `#elev-val` interpolates between active and next section elevations |
| Behavior         | Recomputed on setup and resize |

**Pattern notes:**
Do not maintain a separate hard-coded HUD label list when adding, removing, or reordering sections. Section metadata belongs in the section markup so content structure and navigation labels stay in sync.


### Story Destination Media

File: js/app.js / css/styles.css
Last updated: 2026-08-15

| Property         | Class / Value |
| ---------------- | ------------- |
| Background       | `dest-media-slider`: subtle warm/ink gradient |
| Border           | `1px solid rgba(217,189,130,0.16)` |
| Border radius    | `8px` |
| Text - primary   | Destination title uses existing `dest-title` typography |
| Text - secondary | Destination metadata uses existing `dest-org`, `dest-desc`, `dest-tags` |
| Spacing          | Destination media uses a large `560px x 260px` area with `30px` bottom margin |
| Hover state      | none |
| Shadow           | subtle inset frame only |
| Accent usage     | Existing destination metadata accent |

**Pattern notes:**
Story data keeps `logos` for main-page card thumbnails only and `photos` for clicked destination pages. Destination pages do not render logo slideshow boxes. Single experience logos render as a small `dest-logo-image` aligned with the detail text; photo stories show one photo media area only. Project photos go in `images/photos/projects/<project>/`; activity photos go in `images/photos/activities/<activity>/`. A single contained project screenshot still uses `dest-full-image` with no frame; multiple project/activity photos use one large `dest-media-slider` with a slow continuous marquee track that duplicates the image sequence so the right edge of one photo connects to the left edge of the next. Main-page card dimensions do not change. Musical Activities main-page logo thumbnail rotates UCB Symphony and FCS faster than destination photos.

### Destination Return Note

File: js/app.js / css/styles.css
Last updated: 2026-08-15

| Property         | Class / Value |
| ---------------- | ------------- |
| Background       | none |
| Border           | none |
| Border radius    | none |
| Text - primary   | `rgba(238,242,246,0.52)`, JetBrains Mono, 10.5px uppercase |
| Text - secondary | none |
| Spacing          | `22px` top margin |
| Hover state      | none |
| Shadow           | none |
| Accent usage     | Muted instructional text stays below the story links |

**Pattern notes:**
Destination overlays should keep the firefly as the return control. Use `.dest-return-note` as a quiet bottom instruction instead of adding a visible return button, so the detail view preserves the cinematic feel while making the mobile behavior discoverable.
