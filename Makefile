.PHONY: dev up down build build-fe build-be fe be db logs clean

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
