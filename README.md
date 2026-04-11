# Clinfy Person Microservice

Microservice for person basic data management, used as the source of truth for other microservices that require person information. It provides CRUD operations for persons and genders, Redis-backed caching, RabbitMQ-based event publishing via the outbox pattern, and inbound role-flag updates from external services.

## Tech Stack

| Category       | Technology                                         |
| -------------- | -------------------------------------------------- |
| Runtime        | Node.js 24                                         |
| Framework      | NestJS 11                                          |
| Language       | TypeScript 5.7                                     |
| Database       | PostgreSQL 18 (UUID v7 natively)                   |
| ORM            | TypeORM 0.3                                        |
| Cache          | Redis 5 (via `redis` npm client)                   |
| Message Broker | RabbitMQ (via `@nestjs/microservices` + `amqplib`) |
| Geocoding      | Geoapify API                                       |
| Auth           | External Auth Microservice (JWT + API key)         |
| Logging        | Winston + winston-daily-rotate-file                |
| Metrics        | Prometheus (`prom-client`)                         |
| Validation     | class-validator + class-transformer                |
| API Docs       | Swagger (`@nestjs/swagger`)                        |
| Testing        | Jest 30, Supertest, Testcontainers (PostgreSQL)    |
| CI/CD          | GitHub Actions, Heroku                             |

## Architecture Overview

The microservice follows the standard **NestJS modular architecture** with clear separation between controllers, services, and repositories. Key architectural patterns:

- **Outbox Pattern** -- Entity mutations (insert, update, delete) are intercepted by a TypeORM `EventSubscriber` that writes outbox records into a PostgreSQL table. A cron-based publisher polls for pending events every 10 seconds and emits them to RabbitMQ (`audit_queue`). Failed events are retried up to 5 times; after that they are marked `FAILED` with `retry_count` and `last_error` for manual review. Sent events are cleaned up daily at midnight.
- **Redis Caching** -- Person details are cached in Redis without TTLs. The cache lifecycle is managed via a reconciliation cron that runs every 12 hours: it syncs all persons from the database into Redis and prunes stale entries. On startup, the cache is warmed up by paginating through all persons.
- **Inbound RabbitMQ Consumer** -- Listens on `person_roles_queue` for `person.role_assigned` messages from external microservices (e.g. employee or patient services) and sets the corresponding `has_employee_profile` / `has_patient_profile` flags on the person.
- **Request Context** -- Uses `AsyncLocalStorage` to propagate the authenticated user (`AuthUser`) throughout the request lifecycle. The `created_by` JSONB column on entities captures who performed the action, and the outbox subscriber extracts `done_by_id` / `done_by_email` from this field.
- **Auth Guards** -- Two guard types: `AuthGuard` (Bearer token) and `ApiKeyGuard` (API key header), both consulting the external Auth Microservice for permission checks via an `EndpointKey` decorator.
- **Observability** -- Prometheus metrics exposed at `GET /metrics` (protected by API key guard), including HTTP request counters/histograms, dependency call durations, and outbox batch sizes. A global `HttpMetricsInterceptor` records all request metrics automatically.
- **Address Normalization** -- Addresses are normalized and geocoded through the Geoapify API before storage.

## Project Structure

```
src/
  main.ts                       # Bootstrap: HTTP server + RabbitMQ microservice
  app.module.ts                 # Root module: imports, providers, middleware config
  app.controller.ts             # Health/status endpoint (GET /)
  app.service.ts                # Returns runtime status info
  config/
    env-validation.ts           # Environment variable validation (class-validator)
  entities/
    person.entity.ts            # Person entity (UUID v7 PK, address JSONB, role flags)
    gender.entity.ts            # Gender entity (code + display_name, unique constraints)
    outbox.entity.ts            # Outbox entity (status, retry_count, last_error, claimed_at)
    index.ts                    # Entity barrel export
  services/
    persons/
      persons.controller.ts     # REST endpoints for persons
      persons.service.ts        # Business logic, Redis caching, batch details
      persons.repository.ts     # TypeORM repository wrapper
      persons.consumer.ts       # RabbitMQ consumer for role-assignment events
      persons.exception.ts      # Person-specific exception codes
      persons.module.ts         # Persons feature module
      persons.controller.spec.ts
      persons.service.spec.ts
    genders/
      genders.controller.ts     # REST endpoints for genders
      genders.service.ts        # Gender CRUD business logic
      genders.repository.ts     # TypeORM repository wrapper
      genders.exception.ts      # Gender-specific exception codes
      genders.module.ts         # Genders feature module
      genders.controller.spec.ts
      genders.service.spec.ts
  clients/
    auth/
      auth-client.service.ts    # Calls external Auth Microservice (canDo, getMe, etc.)
      auth-client.interface.ts  # AuthUser interface
      auth-client.module.ts
    geoapify/
      geoapify.service.ts       # Address normalization via Geoapify API
      geoapify.interface.ts     # IGeoapify, GeoapifyResponse interfaces
      geoapify.exception.ts
      geoapify.module.ts
  cron/
    outbox-subscriber.service.ts          # TypeORM EventSubscriber -> writes outbox rows
    outbox-publisher.service.ts           # Polls outbox, publishes to RabbitMQ (every 10s)
    outbox-cleanup.service.ts             # Deletes SENT outbox rows (daily at midnight)
    persons-cache-reconciliation.service.ts # Redis <-> DB full reconciliation (every 12h)
  common/
    context/
      request-context.service.ts  # AsyncLocalStorage-based request context (AuthUser)
      request-context.middleware.ts (in middlewares/)
      request-context.module.ts
      request-context.constants.ts
    guards/
      auth.guard.ts             # Bearer token auth guard
      api-key.guard.ts          # API key auth guard
      auth.exception.ts
    decorators/
      endpoint-key.decorator.ts # Metadata decorator for permission endpoint keys
    validators/
      unique-personal-id.validator.ts
      unique-gender-code.validator.ts
      unique-gender-display_name.validator.ts
    filters/
      all-exceptions.filter.ts  # Global exception filter
    exceptions/
      base-service.exception.ts # Base exception class for services
    redis/
      redis.service.ts          # Redis client wrapper with metrics instrumentation
      redis.module.ts
    utils/
      extract-bearer-token.util.ts
      extract-api-key.util.ts
      find-errors-data.util.ts
      get-client-ip.util.ts
      logger-format.util.ts
      propagate-axios-error.ts
  interfaces/
    person.interface.ts         # IPerson (cached/detail representation)
    gender.interface.ts         # IGender
    dto/
      person.dto.ts             # CreatePersonDto, PatchPersonDto, AssignPersonRoleDto, etc.
      gender.dto.ts             # CreateGenderDto, PatchGenderDto
      address.dto.ts            # AddressDto
      pagination.dto.ts         # PaginationQueryDto, PaginatedResponseDto
  middlewares/
    request-context.middleware.ts # Resolves AuthUser via Auth service and sets context
  observability/
    metrics.service.ts          # Prometheus metrics definitions (prom-client)
    metrics.controller.ts       # GET /metrics endpoint
    http-metrics.interceptor.ts # Global interceptor for HTTP request metrics
    observability.module.ts
test/
  e2e/                          # End-to-end tests
  integration/                  # Integration tests (Testcontainers + PostgreSQL)
    genders.integration.spec.ts
    persons.service.integration.spec.ts
    jest-integration.json
```

## Prerequisites

- **Node.js** >= 24
- **PostgreSQL** >= 18 (must support `uuidv7()`)
- **Redis**
- **RabbitMQ**
- A running instance of the **Auth Microservice** (for authentication and authorization)
- A **Geoapify API key** (for address normalization/geocoding)

## Getting Started

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd Person-Microservice
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy `example.env` to `.env` and fill in the values:

   ```bash
   cp example.env .env
   ```

4. **Start infrastructure** (PostgreSQL, Redis, RabbitMQ)

   Ensure your PostgreSQL, Redis, and RabbitMQ instances are running and accessible with the URLs configured in `.env`.

5. **Run in development mode**

   ```bash
   npm run start:dev
   ```

   The server starts on the configured `PORT` (default: 3000).

## Environment Variables

| Variable               | Required | Description                                                    |
| ---------------------- | -------- | -------------------------------------------------------------- |
| `DATABASE_HOST`        | Yes      | PostgreSQL connection URL                                      |
| `RABBITMQ_URL`         | Yes      | RabbitMQ connection URL (e.g. `amqp://user:pass@host:5672`)    |
| `REDIS_URL`            | Yes      | Redis connection URL (e.g. `redis://localhost:6379`)           |
| `AUTH_SERVICE_URL`     | Yes      | Base URL of the external Auth Microservice                     |
| `AUTH_SERVICE_API_KEY` | Yes      | API key for authenticating with the Auth Microservice          |
| `GEOAPIFY_API_KEY`     | Yes      | API key for the Geoapify geocoding service                     |
| `PORT`                 | No       | HTTP port (default: `3000`)                                    |
| `METRICS_ENABLED`      | No       | Enable/disable the `/metrics` endpoint (`"true"` or `"false"`) |

## API Endpoints

All endpoints (except health and metrics) require authentication via the `AuthGuard` (Bearer token).

### Health

| Method | Path | Description             |
| ------ | ---- | ----------------------- |
| `GET`  | `/`  | Service status and info |

### Persons

| Method  | Path                        | Description                                 |
| ------- | --------------------------- | ------------------------------------------- |
| `POST`  | `/persons/new`              | Create a new person                         |
| `PATCH` | `/persons/edit/details/:id` | Update personal details (name, email, etc.) |
| `PATCH` | `/persons/edit/gender/:id`  | Update a person's gender                    |
| `PATCH` | `/persons/edit/dni/:id`     | Update a person's personal ID (DNI)         |
| `PATCH` | `/persons/edit/address/:id` | Update a person's address                   |
| `GET`   | `/persons/find/id/:id`      | Find a person by UUID                       |
| `GET`   | `/persons/find/dni/:dni`    | Find a person by personal ID (DNI)          |
| `GET`   | `/persons/all`              | List all persons (paginated)                |
| `GET`   | `/persons/details/:id`      | Get person details (Redis-cached, with age) |
| `POST`  | `/persons/details/batch`    | Get details for multiple persons (max 100)  |

### Genders

| Method   | Path                  | Description                          |
| -------- | --------------------- | ------------------------------------ |
| `POST`   | `/genders/create`     | Create a new gender                  |
| `PATCH`  | `/genders/edit/:id`   | Update a gender                      |
| `DELETE` | `/genders/delete/:id` | Delete a gender                      |
| `GET`    | `/genders/find/:id`   | Find a gender by UUID                |
| `GET`    | `/genders/all`        | List all genders (paginated)         |
| `GET`    | `/genders/details`    | Get all genders (lightweight format) |

### Metrics

| Method | Path       | Description                                     |
| ------ | ---------- | ----------------------------------------------- |
| `GET`  | `/metrics` | Prometheus metrics (protected by `ApiKeyGuard`) |

### RabbitMQ Consumer (Inbound)

| Queue                | Pattern                | Description                                                      |
| -------------------- | ---------------------- | ---------------------------------------------------------------- |
| `person_roles_queue` | `person.role_assigned` | Sets `has_employee_profile` or `has_patient_profile` on a person |

## Key Features

### Outbox Pattern for Event Publishing

Entity changes (create, update, delete) are captured by a TypeORM `EventSubscriber` that writes records to the `outbox` table within the same database transaction. A scheduled publisher polls every 10 seconds, claims pending/stale events with `SELECT ... FOR UPDATE SKIP LOCKED`, and emits them to the `audit_queue` on RabbitMQ. Key behaviors:

- **Retry logic**: Up to 5 retries per event. After exhaustion, status is set to `FAILED` with `retry_count` and `last_error` preserved for manual review.
- **Stale recovery**: Events stuck in `PROCESSING` for more than 60 seconds are reclaimed automatically.
- **Cleanup**: A daily midnight cron deletes all `SENT` outbox records in batches of 1000.

### Redis Caching Strategy

Person details (`IPerson` with computed `age`) are cached in Redis with no TTL expiration. Cache lifecycle is managed entirely by application logic:

- **Warm-up on startup**: All persons are loaded into Redis when the module initializes.
- **Write-through**: On create/update, the cache is invalidated and immediately re-populated.
- **Reconciliation cron** (every 12 hours): Performs a full DB-to-Redis sync and prunes stale entries that no longer exist in the database.
- **Batch support**: `getBatchPersonDetails` uses `MGET` for cache hits and falls back to the database for misses, loading them into cache via a Redis `MULTI` pipeline.

### Request Context and Audit Trail

The `RequestContextMiddleware` runs on every request and uses `AsyncLocalStorage` to propagate the authenticated user. The `created_by` JSONB column on entities records who performed the action, and the outbox subscriber populates `done_by_id` and `done_by_email` from this field in the event payload.

### Inbound Role-Flag Updates

External microservices publish `person.role_assigned` messages to `person_roles_queue`. The `PersonsConsumer` processes these messages and sets `has_employee_profile` or `has_patient_profile` on the corresponding person entity. If the person is not found, the message is discarded with a warning log.

### Observability

Prometheus metrics are collected automatically via a global `HttpMetricsInterceptor` and exposed at `GET /metrics` (API key protected). Metrics include:

- `person_http_requests_total` -- Total HTTP requests by method, route, and status code
- `person_http_request_duration_seconds` -- Request duration histogram
- `person_dependency_duration_seconds` -- External dependency call durations (Redis, Auth service, etc.)
- `person_dependency_errors_total` -- Dependency error counter
- `person_outbox_batch_size` -- Pending outbox events per batch
- Default Node.js process metrics (prefixed with `person_`)

### Structured Logging

Winston is configured with daily rotating log files:

- `logs/error-YYYY-MM-DD.log` -- Error-level logs (5 MB max, 14-day retention)
- `logs/combined-YYYY-MM-DD.log` -- All logs (10 MB max, 30-day retention)

## Testing

The project includes three levels of testing:

### Unit Tests

Located alongside source files (`*.spec.ts` in `src/services/`):

```bash
npm run test
```

### Integration Tests

Located in `test/integration/`, using **Testcontainers** to spin up real PostgreSQL instances:

```bash
npm run test:integration
```

### End-to-End Tests

Located in `test/e2e/`:

```bash
npm run test:e2e
```

### Coverage

```bash
npm run test:cov
```

## Scripts

| Script                     | Description                                  |
| -------------------------- | -------------------------------------------- |
| `npm run start`            | Start the application                        |
| `npm run start:dev`        | Start in watch mode (development)            |
| `npm run start:debug`      | Start in debug mode with watch               |
| `npm run start:prod`       | Start from compiled output (`dist/src/main`) |
| `npm run build`            | Compile TypeScript via Nest CLI              |
| `npm run format`           | Format code with Prettier                    |
| `npm run lint`             | Lint and auto-fix with ESLint                |
| `npm run test`             | Run unit + integration tests                 |
| `npm run test:watch`       | Run tests in watch mode                      |
| `npm run test:cov`         | Run tests with coverage report               |
| `npm run test:debug`       | Run tests with Node.js inspector             |
| `npm run test:e2e`         | Run end-to-end tests                         |
| `npm run test:integration` | Run integration tests                        |

## CI/CD

The project includes GitHub Actions workflows in `.github/workflows/`:

- **`auto_test.yml`** -- Runs automated tests on push/PR
- **`deploy_heroku.yml`** -- Deploys to Heroku (uses `Procfile`: `web: npm run start:prod`)

## License

UNLICENSED -- Private project.
