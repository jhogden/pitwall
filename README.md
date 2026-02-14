# Pitwall

Motorsport calendar, results, and live event tracking.

## Stack

- **Frontend:** Next.js 14, React 18, Tailwind CSS
- **Backend:** Spring Boot, PostgreSQL, Redis
- **Data Services:** Python

## Prerequisites

- Docker & Docker Compose
- Node.js (for frontend dev server)
- Java 17+ (for backend dev server, or just use Docker)

## Configuration

Keep all API keys and runtime config in a root `.env` file.

```bash
cp .env.example .env
```

Fill in values in `.env` (not committed). Key entries include:
- `YOUTUBE_API_KEY` for highlights ingestion
- `JWT_SECRET` for backend auth config
- `NEXT_PUBLIC_API_URL` for frontend API target

## Quick Start

```bash
make dev    # starts infra + frontend dev server
```

## Make Commands

### Full Stack

| Command | Description |
|---------|-------------|
| `make dev` | Start infra + frontend dev server |
| `make up` | Start postgres, redis, backend, data-services |
| `make down` | Stop everything |
| `make build` | Rebuild all Docker images |

### Frontend

| Command | Description |
|---------|-------------|
| `make fe` | Frontend dev server (next dev) |
| `make build-fe` | Rebuild frontend Docker image |
| `make lint` | Lint frontend |

### Backend

| Command | Description |
|---------|-------------|
| `make be` | Backend dev server (Spring Boot) |
| `make build-be` | Rebuild backend Docker image |

### Tests

| Command | Description |
|---------|-------------|
| `make test` | Run all tests (backend + data-services) |
| `make test-be` | Run backend tests (Maven/JUnit) |
| `make test-data` | Run data-services tests (Python/unittest in Docker) |

### Data Ingestion

| Command | Description |
|---------|-------------|
| `make ingest-once` | Run a one-time data-services sync immediately |
| `make ingest-backfill-wec YEARS=2012-2025` | Backfill WEC historical calendars |
| `make ingest-backfill-imsa YEARS=2014-2025` | Backfill IMSA historical calendars |

### Database

| Command | Description |
|---------|-------------|
| `make db` | Start just postgres |
| `make psql` | Connect to postgres |

### Logs

| Command | Description |
|---------|-------------|
| `make logs` | Tail all container logs |
| `make logs-be` | Tail backend logs |

### Cleanup

| Command | Description |
|---------|-------------|
| `make clean` | Stop containers and remove volumes |
| `make help` | List all commands |

## Dev Workflow

1. `make db` — start postgres (leave running)
2. `make be` — terminal 1: backend with hot reload
3. `make fe` — terminal 2: frontend with hot reload
4. Edit code, browser auto-refreshes

Use `make build` only when dependencies change or before deploying. For day-to-day dev, `make fe` / `make be` give you instant hot reload.

## YouTube Highlights Feed

Set `YOUTUBE_API_KEY` in `.env`, then start data-services:

```bash
docker compose up -d data-services
docker compose exec -T data-services python -c "from ingestion.youtube_highlights_ingestion import YoutubeHighlightsIngestion; print(YoutubeHighlightsIngestion().sync_recent_highlights(days=7, max_per_series=5))"
```

Query highlights from backend:

- All: `GET /api/feed/highlights`
- Per series: `GET /api/feed/highlights?series=wec`
- Per event: `GET /api/feed/highlights?event=2025-24-hours-of-le-mans`
