# Interactive website

The public explorer is available at
[ai-face-by-illinois.github.io](https://ai-face-by-illinois.github.io/).
It provides image filters, norming summaries, individual rating distributions,
CSV export, original PNG downloads, and a read-only SQL workspace.

## Website address and repository

GitHub Pages serves the frontend from the
[AI-Face-By-Illinois/ai-face-by-illinois.github.io repository](https://github.com/AI-Face-By-Illinois/ai-face-by-illinois.github.io).
The organization name and repository name determine the public website address.
Updating the website's files does not change that address. Keep both names and
the Pages configuration in place when publishing future versions. Renaming a
maintainer's personal account does not rename this organization-owned website.

The address is intended to remain the project's public entry point. Continued
availability still depends on the organization retaining the repository and
GitHub Pages remaining enabled and available. Backend services can be replaced
without changing this public address.

The repository's research README, author attribution, citation, licensing,
release history, and existing release assets remain part of the distribution.
The interactive website supplements the original collection and documentation.

## Frontend and backend

Website files are kept in `docs/` so the repository homepage places the
database entry link close to the top. GitHub Pages publishes the `main` branch's
`/docs` folder. The website URL stays `https://ai-face-by-illinois.github.io/`;
`/docs` is a source folder, not part of the public website address. Keep the root
`README.md` as the entry page for the repository URL cited in the article.

GitHub Pages hosts the HTML, CSS, JavaScript, display images, SQLite dataset, and
bundled sql.js runtime. The browser loads the research database and runs its
queries locally in a dedicated worker. The distributed response identifiers are
sequential anonymous numbers; original survey identifiers and personal,
contact, location, and participant demographic fields are excluded.

The frontend calls the existing backend at
[child-ai-face-atlas.mighty-cup-0464.chatgpt.site](https://child-ai-face-atlas.mighty-cup-0464.chatgpt.site/)
for these functions:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/originals?id=IMAGE_ID` | Download one original PNG. |
| `GET /api/originals?ids=ID1,ID2,...` | Stream a ZIP of the selected original PNGs. |
| `GET /api/originals?...&check=1` | Check source availability before starting a download. |
| `GET /api/downloads` | Read the shared download total and its start date. |
| `POST /api/downloads` | Record an image or ZIP download request after preparation and browser handoff. |

GitHub Pages does not execute these backend endpoints or host the counter's
database. The backend uses a Worker and a separate persistent D1 database for
download events. The public API origin is configuration, not a credential;
backend credentials and deployment tokens must never be included in frontend
files. Cross-origin API access must allow the public website's origin.

## Original images and download integrity

The website displays optimized WebP previews for responsive browsing. Download
buttons retrieve the original PNG files from the
[OSF research collection](https://osf.io/vurm5/), preserving their bytes,
dimensions, transparency, and format. Downloads must never substitute previews
or convert a WebP file to a file merely named `.png`.

The backend manifest contains exactly 1,152 selected image IDs and pins their
source archives to reviewed revisions. File sizes, ZIP offsets, compression
methods, CRC32 values, and SHA-256 checksums identify the original content. All
1,152 downloaded PNGs have been checked against the supplied originals by
SHA-256, and their ZIP entries have passed CRC verification. The original PNG
files total 1,275,433,567 bytes.

ZIP downloads use bounded source reads and stream to the browser. They do not
assemble the entire collection in browser memory. Source storage links are
resolved during a request and refreshed before expiry. Downloaded ZIPs use
normalized `pictures/IMAGE_ID.png` filenames and include a checksum CSV and
research reference. Existing GitHub release archives and OSF remain separate
download routes; their original documentation and structure are retained.

## What the download count means

The homepage displays image download requests recorded by the shared backend:

- One single-image download counts once.
- One ZIP download counts once, regardless of how many images it contains.
- CSV exports, page views, source-availability checks, and verification scripts
  do not add image download events.
- A count is recorded after successful preparation and browser handoff. It does
  not confirm that the transfer finished or that a file was saved to disk.
- Repeated submissions of the same event ID are counted once. Separate download
  actions, including actions by the same person, can count separately.

The total is not a count of unique people, research uses, or citations. It does
not include historical downloads or downloads made directly through GitHub
releases or OSF. Any recorded preview-site downloads remain in the same total;
public launch does not start a separate counter. The `since` value identifies
the first recorded event. When reporting usage, state the metric and the date
of observation, for example, “X image download requests recorded through the
website as of [date].”

The event database stores a random request ID, event kind, number of images, and
server timestamp. It does not store names, email addresses, IP addresses, image
IDs, or browser fingerprints. Counter outages must be shown as unavailable,
rather than as a fabricated zero.

## Updates and future migration

Frontend updates are published to the same repository and Pages address. Keep
research attribution, references, licensing, and release assets intact. The
frontend and backend should be checked together before release: image filters,
CSV export, a single original PNG, and a filtered ZIP must continue to work.
Check original file hashes when changing any download implementation.

Ordinary deployments do not reset download counts while the backend retains
the same D1 database. Do not recreate that database to deploy a website update.
Use a local test database for counter tests; automated verification must not
send test events to the production counter.

The website currently depends on GitHub Pages for its frontend, the existing
Sites backend for API execution and counter persistence, and OSF for original
PNG content. If one component moves, keep the public website address and update
the affected configuration. Before migrating the backend, preserve its API
contract, export and verify the counter data, retain event IDs and timestamps,
and test cross-origin access from the public website. Move the frontend to the
new API only after original downloads and the existing counter total have been
verified. Retire the old backend after the new deployment is confirmed.

If original image storage changes, verify the complete 1,152-image ID set and
every original SHA-256 checksum before changing source revisions or offsets.
Keep the original research files and established collection references
available independently of the website deployment.
