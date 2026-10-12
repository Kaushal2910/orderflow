# OrderFlow — Event-Driven Theatre Booking

4 Spring Boot microservices (orders, inventory+shows, payments mock, notifications) behind a
Spring Cloud Gateway (JWT + retry), Kafka events, PostgreSQL (prod) / H2 (local), Redis holds
(prod) / in-memory TTL (local), JUnit idempotency tests, Docker files included.

UI is separate: `../ui` (Vite + Three.js 3D seat picker). It runs fully in mock mode with
zero backend, and talks to the gateway when `VITE_GATEWAY_URL` is set. No dead links —
every button is wired.

## Run without Docker (what you're doing now)

1. UI: `cd ../ui && npm install && npm run dev` → http://localhost:5173
2. Backend (needs Maven; wrapper coming, or run in GitHub Codespaces):
   `mvn -q -pl order-service -am test` runs the idempotency tests.
   Each service boots with H2 locally, no Kafka/Redis/Postgres required.

## Run full stack (optional, needs Docker)

`docker compose up --build` → gateway :8080, ui :5173.

Kafka topics: `order.created → inventory.reserved → payment.completed → notify.send`.
Idempotency: `POST /api/orders` requires `Idempotency-Key`; replays return the original order.
