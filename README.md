# My Personal Website

## Live Site

[personal-website-five-tau-53.vercel.app](https://personal-website-five-tau-53.vercel.app/)

This is an interactive portfolio site I built for myself with a cinematic 3D mountain journey. It combines a static HTML/CSS content layer with a Three.js scene, scroll-driven camera movement, a firefly guide, and clickable detail views for experience, projects, and activities.

## Features

- Scroll-driven 3D mountain environment with day/night atmosphere
- Trailhead intro with visible name and Berkeley Engineering identity
- Dense animated grass, terrain, mountains, stars, and firefly effects
- Section-based portfolio content:
  - Education
  - Coursework
  - Skills
  - Guide message
  - Experience
  - Projects
  - Beyond the summit
  - Contact
- Clickable cards for deeper project, experience, and activity details
- Sliding square media thumbnails for activity cards, with full-frame logo/photo treatment
- Photo-only destination media; logos stay on main-page cards
- Resume-aligned coursework and skills
- Monochrome skill logo grid with verified external SVG sources and fallback handling
- Terrain-aware firefly travel paths for detail-page transitions

## Key Files

- `index.html` contains the portfolio sections, content cards, skill grid, and destination/detail containers.
- `css/styles.css` controls the page layout, typography, responsive behavior, cards, detail views, and visual polish.
- `js/app.js` builds the Three.js scene, camera path, mountains, firefly, HUD labels, detail navigation, and story data.
- `images/logos/` stores local organization, school, and activity logos.
- `images/covers/` stores project screenshots and cover images.
- `images/photos/` stores non-logo photos for story destination slides.
- `ui-registry.md` records visual patterns and implementation notes so future edits stay consistent.

## Project Structure

```text
.
├── index.html
├── css/
│   └── styles.css
├── js/
│   └── app.js
├── images/
│   ├── covers/
│   ├── logos/
│   └── photos/
│       ├── activities/
│       └── projects/
├── README.md
└── ui-registry.md
```

## Content Notes

Current project order:

- Personal Website
- DrumVoice

Current Beyond the summit order:

- YHWH Apparel
- Eta Kappa Nu
- TAUG Journal
- Musical Activities

`Musical Activities` consolidates percussion, UC Berkeley Symphony Orchestra, FCS A Cappella, Crossroads Christian Fellowship worship music, and high-school honor ensemble milestones into one narrative destination. Its visible logo rotation now uses UC Berkeley Symphony Orchestra and FCS A Cappella, with organization photos handled separately in `images/photos/activities/music/`.

Story detail media uses `photos` only; detail pages do not show logo slideshow boxes. Logos stay in `images/logos/` for main-page cards. Add real photos under `images/photos/projects/<project-name>/` or `images/photos/activities/<activity-name>/`, then add those paths to the matching story `photos` array. One media item stays still; multiple media items slide continuously and slowly.

## Local Preview

From the project root:

```sh
python3 -m http.server 4173
```

If that port is busy, use another port such as `4174` and open `http://localhost:4174/index.html`.

For a quick static check, load the local preview and test:

- scroll progression and heads-up display labels
- clickable experience/project/activity cards
- return-from-detail firefly interaction
- mobile text fit
- skill logo visibility
