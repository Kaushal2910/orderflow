# OrderFlow — Event-Driven Theatre Booking

Interactive 3D theatre seat booking (Three.js) + 4 Spring Boot microservices behind a
Spring Cloud Gateway, Kafka events, PostgreSQL/Redis in prod, JUnit idempotency tests.

## Folders (UI and backend are independent)

- `ui/` — Vite + Three.js + Tailwind-less custom CSS. Runs fully in **mock mode**
  (`npm install && npm run dev`), talks to gateway when `VITE_GATEWAY_URL` is set.
  No dead links: Home → Show → 3D Book → Checkout (mock pay) → Track → My Orders → Manage movies.
- `backend/` — `gateway-service` :8080 (JWT + retry) · `order-service` :8081 (idempotent
  `POST /api/orders` + JUnit) · `inventory-service` :8082 (Show CRUD + seat holds, 5-min TTL) ·
  `payment-service` :8083 (mock) · `notification-service` :8084 (Kafka consumer stub).
  Local runs on H2, no Docker needed. `docker-compose.yml` gives the prod stack
  (Postgres, Redis, Kafka) when you want it.

## Verified just now (no Docker)

- `ui`: `npm run build` clean.
- `order-service`: `IdempotencyTest` 2/2 pass (replay same key = 1 order).
- `inventory-service`: `HoldStoreTest` 2/2 pass (double-book rejected, consume → SOLD).
- Full `mvn compile` clean across all 6 modules.

## Movies

Manage page (`#/admin`) does easy CRUD now (localStorage), same shape as
`POST /api/shows` — add your real movies at last, UI + API both accept them.
