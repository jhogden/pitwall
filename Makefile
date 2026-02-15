.PHONY: dev up down build build-fe build-be fe be db logs clean test test-be test-data ingest-once ingest-backfill-wec ingest-backfill-imsa ingest-backfill-f1-tires ingest-backfill-f1-track-maps

# ── Full stack ────────────────────────────────────────────
dev: up fe                ## Start infra + frontend dev server

up:                       ## Start postgres, redis, backend, data-services
	docker compose up -d postgres redis backend data-services

down:                     ## Stop everything
	docker compose down

build:                    ## Rebuild all Docker images
	docker compose build

# ── Frontend ──────────────────────────────────────────────
fe:                       ## Frontend dev server (next dev)
	cd frontend && npm run dev

build-fe:                 ## Rebuild frontend Docker image
	docker compose build frontend

lint:                     ## Lint frontend
	cd frontend && npm run lint

# ── Backend ───────────────────────────────────────────────
be:                       ## Backend dev server (Spring Boot)
	cd backend && ./mvnw spring-boot:run

build-be:                 ## Rebuild backend Docker image
	docker compose build backend

# ── Tests ────────────────────────────────────────────────
test: test-be test-data   ## Run all tests

test-be:                  ## Run backend tests
	cd backend && ./mvnw test -q

test-data:                ## Run data-services tests
	docker compose run --rm --no-deps data-services python -m unittest discover -s tests

# ── Data Ingestion ───────────────────────────────────────
ingest-once:              ## Run one-shot data-services initial sync now
	docker compose run --rm --no-deps -e RUN_ONCE=1 data-services python -m ingestion.main

ingest-backfill-wec:      ## Backfill WEC calendars (use YEARS=2012-2025)
	@test -n "$(YEARS)" || (echo "YEARS is required. Example: make ingest-backfill-wec YEARS=2012-2025" && exit 1)
	@echo "$(YEARS)" | grep -Eq '^[0-9]{4}-[0-9]{4}$$' || (echo "Invalid YEARS format. Expected START-END (e.g. 2012-2025)" && exit 1)
	docker compose run --rm --no-deps -e RUN_ONCE=1 -e SKIP_INITIAL_SYNC=1 -e WEC_HISTORICAL_SYNC=$(YEARS) data-services python -m ingestion.main

ingest-backfill-imsa:     ## Backfill IMSA calendars (use YEARS=2014-2025)
	@test -n "$(YEARS)" || (echo "YEARS is required. Example: make ingest-backfill-imsa YEARS=2014-2025" && exit 1)
	@echo "$(YEARS)" | grep -Eq '^[0-9]{4}-[0-9]{4}$$' || (echo "Invalid YEARS format. Expected START-END (e.g. 2014-2025)" && exit 1)
	docker compose run --rm --no-deps -e RUN_ONCE=1 -e SKIP_INITIAL_SYNC=1 -e IMSA_HISTORICAL_SYNC=$(YEARS) data-services python -m ingestion.main

ingest-backfill-f1-tires: ## Backfill F1 tire stints (FastF1, use YEARS=2018-2026)
	@test -n "$(YEARS)" || (echo "YEARS is required. Example: make ingest-backfill-f1-tires YEARS=2018-2026" && exit 1)
	@echo "$(YEARS)" | grep -Eq '^[0-9]{4}-[0-9]{4}$$' || (echo "Invalid YEARS format. Expected START-END (e.g. 2018-2026)" && exit 1)
	docker compose run --rm --no-deps -e RUN_ONCE=1 -e SKIP_INITIAL_SYNC=1 -e F1_TIRE_STINT_SYNC=$(YEARS) data-services python -m ingestion.main

ingest-backfill-f1-track-maps: ## Backfill F1 track map URLs from OpenF1 (use YEARS=2018-2026)
	@test -n "$(YEARS)" || (echo "YEARS is required. Example: make ingest-backfill-f1-track-maps YEARS=2018-2026" && exit 1)
	@echo "$(YEARS)" | grep -Eq '^[0-9]{4}-[0-9]{4}$$' || (echo "Invalid YEARS format. Expected START-END (e.g. 2018-2026)" && exit 1)
	docker compose run --rm --no-deps -e RUN_ONCE=1 -e SKIP_INITIAL_SYNC=1 -e F1_TRACK_MAP_SYNC=$(YEARS) data-services python -m ingestion.main

# ── Database ──────────────────────────────────────────────
db:                       ## Start just postgres
	docker compose up -d postgres

psql:                     ## Connect to postgres
	docker exec -it pitwall-postgres psql -U pitwall

# ── Logs ──────────────────────────────────────────────────
logs:                     ## Tail all container logs
	docker compose logs -f

logs-be:                  ## Tail backend logs
	docker compose logs -f backend

# ── Cleanup ───────────────────────────────────────────────
clean:                    ## Stop containers and remove volumes
	docker compose down -v

help:                     ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'
