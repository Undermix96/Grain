# Grain

A self-hosted personal website for publishing one's own photographs:
something between a photography portfolio, a gallery, and a social-style
feed.

> Status: project in the planning phase. This repository currently
> contains only the base files and the documentation of the decisions made
> so far. Code will be added in upcoming iterations — see the progress
> status in [AGENTS.md](./AGENTS.md#5-progress-status).

## What it is

- A gallery of one's own photographs, ordered chronologically.
- Dark, minimal, elegant design, meant to keep the photos in the spotlight.
- Fully responsive: mosaic grid on desktop, vertical feed on mobile.
- No accounts/login: public site, meant to be shared freely.
- Photos are added simply by copying them into a folder on the server:
  they are detected and processed automatically, with no restarts needed.
- Every photo is automatically resized into multiple versions and
  stripped of location (GPS) data before being served, including the
  full-resolution download.

## Photo directory structure

```
photos/
├── 2026-08-21-travel-sunset_over_the_lake.jpg
├── 2026-07-03-portraits-natural_light.jpg
└── 2026-05-12-photos-untitled.jpg
```

Filename convention: `YYYY-MM-DD-album-title.ext`

- **Date**: required, shown in the UI. If missing, the file's last
  modified date is used instead.
- **Album**: required in the filename, but not yet used in the UI (the
  current gallery is a single chronological feed). It is already
  extracted and available for future use (filters/categories).
- **Title**: optional, parsed but not yet displayed in the UI.

## Metadata shown

If present in the shot's EXIF data, the following are shown: camera, lens,
focal length, aperture, shutter speed, ISO.

Location (GPS) data is **never shown and never included** in any version
of the file served by the site, including the full-resolution download.

## Main features (planned)

- Single chronological gallery with infinite scroll
- Responsive layout: mosaic (desktop) / single-column feed (mobile)
- Fullscreen lightbox with keyboard navigation (desktop) and swipe (mobile)
- Automatic generation of thumbnails and optimized versions (WebP)
- Automatic detection of new/modified photos, no restarts required
- High-resolution download, always stripped of GPS data
- API rate limiting to protect the service from excessive load

## Tech stack (planned)

| Layer | Technology |
|---|---|
| Backend | Node.js 22 + Fastify |
| Image processing | sharp |
| Frontend | React 18 + Vite |
| State | Zustand |
| Data fetching | TanStack Query (infinite scroll) |
| Animations | Motion |
| Frontend serving | Nginx (Alpine) |
| Containers | Docker + Docker Compose |

## Deployment (planned)

The project is designed to run as a Docker stack on a personal server,
behind an already-existing reverse proxy (e.g. Traefik), following the
same build/deploy workflow already used in other projects by the
maintainer.

## Technical documentation

All architectural decisions, rationale, and guidelines for anyone (human
or AI agent) working on this repository are described in detail in
[AGENTS.md](./AGENTS.md).

## License

See [LICENSE](./LICENSE).
