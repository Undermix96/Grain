# AGENTS.md

This document describes the **Grain** project: what it is for, how it is
structured, which technical decisions have been made (and why), and how an
AI agent must behave when working on this repository.

It must be kept up to date: if a change alters an endpoint, a data
structure, or a design decision, this file (and `README.md`) must be
updated as part of the same change.

The entire project — code, comments, variable names, commit messages,
documentation — must be written in **English**, regardless of the language
used in conversation with the maintainer.

---

## 0. What this project is

**Grain** is a self-hosted personal website for publishing one's own
photographs: something between a photography portfolio, a gallery, and a
social-style feed.

Main characteristics:

- A single gallery, ordered chronologically (no active albums/categories
  for now, but the data structure already supports them — see §3).
- Dark, minimal, elegant design: photos are the focus, the interface stays
  understated.
- Fully responsive: masonry/bento grid on desktop, single-column vertical
  feed on mobile, similar to a social feed.
- No authentication: fully public site.
- Photos are read from a folder on the server's filesystem (no upload
  panel via the web interface, at least in this first version): files are
  added/modified directly in the folder and the site detects them
  automatically, with no need to restart any container (see §3).
- Every original photo is automatically resized and stripped of sensitive
  metadata (GPS) before being served in any form, including the
  full-resolution download (see §3).

---

## 1. Operating instructions for the AI agent

### 1.1 Plan before acting — explicit authorization required

**Never modify files without the user's explicit authorization.**

1. Analyze the request and identify all files involved
2. Present the plan: what changes, where, why
3. Wait for explicit confirmation before writing any file

### 1.2 Prefer surgical edits over refactoring

- Use `str_replace` for specific portions instead of rewriting the whole file
- Only rewrite an entire file if the change touches more than 60% of its content
- When rewriting a whole file, flag it and explain why

### 1.3 Mandatory review after every change

1. Re-read every modified block in the context of the full file
2. Actively look for syntax, logic, and consistency errors
3. Verify function, variable, and endpoint names across all touched files
4. If no errors are found, say so explicitly

### 1.4 Don't invent — ask or search

- Never invent plausible-sounding answers and present them as certain
- Ask the user if the doubt concerns a design/product decision
- Search online if the doubt concerns a verifiable technical fact

### 1.5 Critical files — maximum attention

| File | Risk |
|---|---|
| `backend/src/index.js` (or equivalent, split into modules) | Core logic: photo folder scanning, thumbnail/version generation, EXIF/GPS stripping, rate limiting. A bug here can result in unoptimized photos being served, new photos not being detected, or — more seriously — files being served with GPS data not removed. |
| EXIF/GPS stripping module | If this logic silently breaks, the site could distribute photos with sensitive location data. Treat as top priority in any change that touches it. |
| `docker-compose.yml` | Defines the network/volumes shared between backend and frontend; a mistake in the volumes (in particular the read-only source photos volume) can expose unintended files or break the pipeline. |
| `.env` | Holds sensitive configuration. Must never be committed with real values (only `.env.example`). |
| `build.sh` / Docker image build pipeline | A wrong tag or a push to the wrong channel impacts deployment. |
| Resized-versions cache (dedicated volume) | If the cache-invalidation logic (based on source file mtime/hash) breaks, stale or missing thumbnails may be served. |

### 1.6 Keep documentation in sync with the code

Whenever a change alters endpoints, data structures, or design decisions,
update the corresponding sections of this file and of `README.md`.

### 1.7 Commit messages

Every change must be accompanied by a commit message written in
**English**, following the
[Conventional Commits](https://www.conventionalcommits.org/) format
(`type: short summary` + an explanatory body for non-trivial changes).

### 1.8 Always use up-to-date best practices

At the time of every change, apply the current best practices for the
language, tool, or service involved — not the ones that were valid when
the code was first written.

In practice:
- If an API, library, or feature is deprecated, flag it and propose the
  current alternative before writing code.
- If safer, more readable, or more idiomatic patterns exist compared to
  what is already in the file, prefer them in new code.
- If in doubt about what counts as "up to date", search online before
  proceeding (see §1.4).

### 1.9 Propagate discoveries from isolated debugging into the real files

When a test or debug session (even in a separate/sandboxed environment,
not the target host) reveals a missing dependency, a missing system
package, or the need for a workaround to make something work, **that
discovery must be applied immediately to the project files** (Dockerfile,
package.json, etc.) — not just worked around locally to make the test pass.

Rule of thumb: any time a debug session involves running something like
`apt-get install`, `npm install`, or any other workaround to make
something work that wasn't already accounted for in the project, ask
"does this also need to be added to the Dockerfile/package.json/etc.?" —
and if so, do it in the same session, don't postpone it.

---

## 2. Architecture

Two Docker containers, no separate orchestrator:

```
┌─────────────────────────────┐      ┌──────────────────────┐
│ backend                      │      │ frontend               │
│ (Node.js + Fastify)          │◀────▶│ (React + Vite, served │
│ scans photo folder → extracts│ HTTP │  via Nginx)            │
│ metadata (date/album/EXIF)   │      │                        │
│ → generates thumbnail/medium/│      │ Gallery, lightbox,     │
│   full versions, GPS-stripped│      │ infinite scroll        │
│ → disk cache → REST API      │      │                        │
└─────────────────────────────┘      └──────────────────────┘
```

- **backend**: sole owner of the logic. Mounts the source photos folder
  read-only, and a dedicated volume read/write for the cache of resized/
  cleaned versions. Never serves the original source file directly.
- **frontend**: only consumes the backend's API, no direct access to the
  photos filesystem.

---

## 3. Technical decisions made and rationale

| Area | Decision | Rationale |
|---|---|---|
| Photo source | Folder on the server's filesystem, read by the backend | No need for an upload panel for personal use; just copy files into the folder. |
| Detecting new/modified photos | Periodic scan with a short cache (not a file watcher) + `POST /api/refresh` endpoint to force an immediate update | Approach already validated in the previous project (RedditVault); simpler and more robust than a file watcher, sufficient for non-"live" use. No container restart needed in either case. |
| Thumbnail cache invalidation | Based on the source file's mtime/hash | If the file changes, the cached resized version is automatically regenerated on the next scan. |
| File naming convention | `YYYY-MM-DD-album-title.ext` | The date is always shown in the UI; the album is already extracted and available in the data even though the frontend doesn't use it yet; the title is parsed but not displayed for now. If the date is missing from the filename, fall back to the file's mtime. |
| Albums/categories | Supported in filename parsing and in the data structure from the start, not yet exposed/filterable in the UI | Avoids a refactor when they get activated in the future. |
| EXIF metadata shown | Camera, lens, focal length, aperture, shutter speed, ISO (when present) | Data that enriches the presentation of the shot without being sensitive. |
| GPS/location data | Never shown in the UI, never present in any served version of the file (thumbnail, medium, full) | Sensitive data; must be removed regardless of the channel through which the file leaves the server, including the "original" download. |
| Image pipeline | Automatic generation of 3 versions per photo: thumbnail (grid), medium (viewing), full (download, still GPS-stripped) | Serving the raw camera file would be too heavy and would risk exposing sensitive metadata. |
| Served image format | WebP with fallback | Reduced size, broad support in modern browsers. |
| Color space / profile handling | `thumbnail` and `medium` are converted to sRGB (sharp's default when metadata is stripped); `full` (the download version) keeps the source file's original ICC color profile via `sharp`'s `.keepIccProfile()`, independent from EXIF/GPS stripping | Ensures accurate, consistent colors in the browser for on-site viewing, while letting a photographer working in a wide-gamut profile (Adobe RGB, ProPhoto RGB) download a file that preserves their original color profile — without reintroducing GPS or other EXIF data, which are stripped through a completely separate mechanism. |
| Image processing library | `sharp` | Performant, natively supports resizing and EXIF metadata manipulation/removal, no problematic native dependencies in Docker. |
| Original-version download | Allowed, but always the GPS-stripped "full" version, never the raw source file | The user can save the photo at high resolution without exposing the shot's location data. |
| Authentication | None, fully public site | Explicit choice for this project; the architecture (API separated from the frontend) remains compatible with adding an auth layer in the future without a refactor. |
| API rate limiting | `@fastify/rate-limit`, general per-IP limit on read APIs, stricter limit on expensive endpoints (image generation, manual refresh) | Docker-level limits (cpu/mem) protect the host but don't prevent the service from becoming unusable under load or abuse; an application-level rate limit is a complementary, non-redundant protection. |
| Design/mood | Dark, minimal, elegant, near-black palette, light gray text, a single understated accent color (desaturated sage/petrol green) used only for hover/active/focus states | Photos remain the focus; a single consistent accent avoids competing with the colors in the shots. |
| Gallery layout | Responsive masonry/bento: mosaic grid on desktop, single-column vertical feed on mobile | Consistent with 2026 trends for photography portfolios; each photo gets space proportional to its importance/orientation. |
| Lightbox | Fullscreen, arrow/keyboard navigation on desktop, swipe on mobile | Expected navigation standard for a photo gallery. |
| Content organization | Single chronological gallery for now | Explicit initial choice; data structure already ready for albums/categories in the future (see above). |
| Backend stack | Node.js 22 + Fastify | Reuse of a stack already proven in the previous project (RedditVault): lightweight, performant, good support for REST APIs and static files. |
| Frontend stack | React 18 + Vite, Zustand (state), TanStack Query (fetching/infinite scroll), Motion (animations/micro-interactions) | Same proven stack from the previous project, adapted from a Reddit-style board to a photo gallery. |
| Deployment | Docker + Docker Compose, healthcheck on the backend, ready to run behind a reverse proxy (e.g. Traefik) already present on the host | Consistent with the self-hosted infrastructure already in use by the maintainer. |
| Source hosting | GitHub repository | The project will be version-controlled and published on GitHub. |
| Project language | English throughout: code, comments, variable names, documentation, commit messages | Standard practice for a project intended to be open-source-ready and maintainable, independent of the language spoken in conversation with the maintainer. |

---

## 4. Repository structure (planned)

```
grain/
├── AGENTS.md                          # this file
├── README.md
├── LICENSE
├── .gitignore
├── .gitattributes
├── .env.example
├── docker-compose.yml                 # deployment: pulls pre-built images
├── docker-compose.build.yml           # builds and tags both images locally
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js                   # Fastify server, API routes, rate limiting
│       ├── config.js                  # environment variable configuration
│       ├── filename.js                # filename parsing (date/album/title)
│       ├── exif.js                    # display EXIF extraction (never GPS)
│       ├── imagePipeline.js           # thumbnail/medium/full generation, GPS stripping
│       └── scanner.js                 # photo folder scanning with TTL cache
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── nginx.conf
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx                    # entry point, QueryClientProvider setup
        ├── App.jsx
        ├── index.css                   # theme variables, dark minimal styles
        ├── api/
        │   └── photos.js                # backend API client
        ├── hooks/
        │   ├── usePhotos.js             # TanStack Query infinite query
        │   └── useInfiniteScrollTrigger.js
        ├── stores/
        │   └── lightboxStore.js         # Zustand: lightbox open/close state
        └── components/
            ├── Header.jsx
            ├── Gallery.jsx              # responsive masonry grid
            ├── PhotoCard.jsx
            └── Lightbox.jsx             # fullscreen viewer
```

Note: this structure is planned based on the decisions made so far; it will
be created, and adjusted if needed, during implementation.

---

## 5. Progress status

- [x] Architectural and technical decisions defined (this document)
- [x] Base repository structure (`.gitignore`, `LICENSE`, `README.md`, `.env.example`)
- [x] `backend/src/filename.js` — filename parsing (date/album/title), with fallbacks
- [x] `backend/src/imagePipeline.js` — thumbnail/medium/full generation with `sharp`, GPS/EXIF stripping, sRGB conversion for displayed versions, ICC profile preservation for the download version
- [x] `backend/src/exif.js` — display EXIF extraction (camera, lens, focal length, aperture, shutter speed, ISO); GPS is never parsed
- [x] `backend/src/scanner.js` — folder scanning with TTL cache, filename + EXIF enrichment, manual refresh support
- [x] `backend/src/index.js` — Fastify server: `GET /api/photos` (paginated), `GET /api/photos/:id/:version`, `POST /api/refresh`, `GET /api/health`, rate limiting (general + heavy endpoints)
- [x] `backend/package.json` — dependencies (Fastify 5, sharp, exifr, @fastify/rate-limit, @fastify/cors)
- [x] Manual end-to-end backend test (photo listing, image serving for all versions, 404/400 handling, refresh, rate limiting) — passed
- [x] `backend/Dockerfile`
- [x] Frontend scaffold: Vite + React (JavaScript, `@vitejs/plugin-react-swc`), dark minimal theme with a single sage/petrol accent color
- [x] `frontend/src/components/Gallery.jsx` — responsive CSS multi-column masonry (single column on mobile, up to 4 columns on desktop), infinite scroll via `IntersectionObserver`
- [x] `frontend/src/components/PhotoCard.jsx`, `Header.jsx` — grid item and sticky minimal header
- [x] `frontend/src/components/Lightbox.jsx` — fullscreen viewer with keyboard navigation (arrows/Escape), swipe navigation on touch devices, EXIF display, download of the GPS-stripped "full" version, animated with `motion`
- [x] `frontend/src/stores/lightboxStore.js` (Zustand), `frontend/src/hooks/usePhotos.js` (TanStack Query infinite query)
- [x] `frontend/Dockerfile`, `frontend/nginx.conf` — multi-stage build served by Nginx, proxies `/api/` to the backend container
- [x] Frontend build verified (`vite build`, no errors); dev server verified end-to-end against a running backend instance (API proxying and image serving confirmed via HTTP requests). Full in-browser interaction (click/keyboard/swipe on the rendered page) could not be verified in this environment due to no network access for downloading a headless browser — worth a manual smoke test by the maintainer before relying on it.
- [x] `docker-compose.yml` — deployment: pulls pre-built images, mounts read-only photos volume and read/write cache volume, Traefik + homepage labels, backend healthcheck gating frontend startup
- [x] `docker-compose.build.yml` — builds and tags both images locally
- [x] `.env.example` updated with `CACHE_PATH` and `SCAN_CACHE_TTL_MS`, now covering every variable referenced by `docker-compose.yml`
- [x] YAML syntax of both compose files validated
- [ ] End-to-end test of the full Dockerized stack (`docker compose up`) — not runnable in this sandboxed environment (no Docker daemon available); recommended as a manual check by the maintainer before first production deploy
