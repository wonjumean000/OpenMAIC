# Canvas LMS integration

Connects a school Canvas LMS (default: Korea University, lms.korea.ac.kr) so course text and course files can feed lesson generation. API reference: https://developerdocs.instructure.com/services/canvas

## Setup in the app

Settings > Canvas LMS

1. Pick lms.korea.ac.kr or mylms.korea.ac.kr (or enter another host).
2. Paste an access token (Canvas > Account > Settings > Approved Integrations > + New Access Token).
3. Save and verify. The server calls /api/v1/users/self first and stores the token only if Canvas accepts it.

The token is stored in HttpOnly cookies scoped to /api/canvas (30 days). Page scripts cannot read it and it is never shown again. Disconnect deletes the cookies.

## Setup through the server environment (optional)

```env
CANVAS_BASE_URL=https://lms.korea.ac.kr
CANVAS_ACCESS_TOKEN=your_token
# extra hosts users may save a token for (comma separated)
CANVAS_ALLOWED_HOSTS=
```

A token saved in the UI takes precedence over the environment.

## Security

- A saved token can only be used with an allowlisted host: lms.korea.ac.kr, mylms.korea.ac.kr, *.instructure.com, CANVAS_ALLOWED_HOSTS, or the host of CANVAS_BASE_URL.
- https is required for saved credentials. Every request passes the existing SSRF guard.
- API calls refuse redirects. File downloads follow Canvas's redirect to its file host by hand, validate every hop, and send the token to the Canvas origin only.
- All routes run behind withRequestOwner, so ACCESS_CODE and owner policies apply. PUT requires application/json.

## Routes

| Route | Purpose |
| --- | --- |
| GET /api/canvas/status | configured, connected, host, user name |
| PUT /api/canvas/settings | verify and save { baseUrl, token } |
| DELETE /api/canvas/settings | forget the saved token |
| GET /api/canvas/courses | active courses |
| GET /api/canvas/courses/:id/content?sections=syllabus,pages,assignments,modules | course text as Markdown |
| GET /api/canvas/courses/:id/files | course files |
| GET /api/canvas/files/:id/download | file bytes (200 MB cap), proxied by the server |

## File import

The settings panel downloads each selected file through the proxy route and uploads it to /api/materials (scope=library, falling back to the classic upload when the agent runtime is off). The normal MIME policy, size limits and quotas therefore apply, and unsupported types are reported per file.

## Not included yet

- Per-user OAuth2 (needs a stored refresh token and a Canvas Developer Key from the school).
- Files inside module items that live outside the course Files area.
- Wiring Canvas text into the home screen generator (today: copy or save as .md from the panel).
