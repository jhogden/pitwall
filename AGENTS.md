# Repository Guidelines

## Project Structure & Module Organization
This monorepo has three services plus shared infra:
- `frontend/`: Next.js 14 + TypeScript UI (`src/app` routes, `src/components` reusable UI, `src/lib` API/helpers).
- `backend/`: Spring Boot API (`controller`, `service`, `repository`, `model`, `dto`, `mapper` under `src/main/java/com/pitwall`; tests under `src/test`).
- `data-services/`: Python ingestion jobs (`ingestion/`) and unit tests (`tests/`).
- Root: `Makefile`, `docker-compose.yml`, and docs.

## Build, Test, and Development Commands
Use root `Makefile` targets:
- `make dev`: start infra (`postgres`, `redis`, `backend`, `data-services`) and run frontend dev server.
- `make fe` / `make be`: run frontend or backend locally.
- `make up` / `make down`: start or stop core containers.
- `make test`: run backend + data-services tests.
- `make lint`: run frontend lint checks.

## Coding Style & Naming Conventions
- TypeScript/React: 2-space indentation, `PascalCase` component files (for example `FeedCard.tsx`), `camelCase` functions/variables.
- Java: standard Spring layering; classes use `PascalCase`, test classes end with `Test`.
- Python: PEP 8 style, `snake_case` modules/functions, tests named `test_*.py`.

## Testing Guidelines
- Backend uses JUnit 5, Spring test support, and Mockito.
- Data services use `unittest` with mocks/patches for external APIs.
- Add/update tests with each change, including edge and failure paths.
- Run `make test` before opening a PR.

## Commit & Pull Request Guidelines
Git history follows Conventional Commit-style prefixes (`feat:`, `fix:`, `test:`, `chore:`). Use:
- `type: imperative summary`.
- Keep commits small and scoped to one logical change.

PRs should include:
- What changed and why.
- Linked issue (if available).
- UI screenshots/GIFs for frontend changes.
- Notes on schema/config updates and verification (`make test`, `make lint`).

## Clean Code & Delivery Standards
- Default to SOLID:
  SRP for single-purpose modules, OCP via extension over modification, DIP via dependency injection, and small interfaces.
- Prefer composition over inheritance; avoid large “do-everything” classes.
- Use TDD for behavior changes:
  write a failing test, implement minimal code to pass, then refactor.
- Test behavior through public interfaces (not private methods), and keep tests fast, independent, and repeatable.
- Do not commit with failing tests. Run relevant suites first (`make test`, plus `make lint` for frontend).
- Keep commit subjects concise and specific; avoid vague messages like `WIP` or `fix stuff`.

## Security & Configuration
- Never commit secrets. Use environment variables (`JWT_SECRET`, DB credentials, API URLs).
- Default local values in `docker-compose.yml` and `backend/src/main/resources/application.yml` are for development only.
