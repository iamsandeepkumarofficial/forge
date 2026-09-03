import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseRouteScanLines } from "./appRoutes.js";

describe("parseRouteScanLines", () => {
  it("reads express, decorator, flask, and next files", () => {
    const routes = parseRouteScanLines(
      [
        `src/index.ts:40:app.get("/health", handler)`,
        `src/users.ts:12:router.post('/users', create)`,
        `src/users.ts:20:@Get("/users/:id")`,
        `app.py:8:@app.route("/login", methods=["POST"])`,
        `./app/api/locale/route.ts`,
        `./pages/api/ping.ts`
      ].join("\n")
    );
    assert.deepEqual(
      routes.map((r) => `${r.method} ${r.path}`),
      [
        "GET /api/locale",
        "GET /api/ping",
        "GET /health",
        "POST /login",
        "POST /users",
        "GET /users/:id"
      ]
    );
  });

  it("expands router mounts and chained .route() methods", () => {
    const routes = parseRouteScanLines(
      [
        `src/routes/index.ts:11:app.use('/', routes);`,
        `src/routes/index.ts:12:app.use('/api/v1', routes);`,
        `src/app.ts:103:// app.use('/v1', routes);`,
        `src/routes/index.ts:13:app.use('/v1/auth', authLimiter);`,
        `src/routes/test/index.ts:6:router.get('/buzz', handler)`,
        `src/routes/test/index.ts:10:router.get('/', handler)`,
        `src/routes/auth/index.ts:8:router.route('/login').post(login).get(form)`
      ].join("\n")
    );
    assert.deepEqual(
      routes.map((r) => `${r.method} ${r.path}`),
      [
        "GET /",
        "GET /api/v1",
        "GET /api/v1/buzz",
        "GET /api/v1/login",
        "POST /api/v1/login",
        "GET /buzz",
        "GET /login",
        "POST /login"
      ]
    );
  });
});
