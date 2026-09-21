---
name: "source-command-dev"
description: "Start the full Spidr stack locally — spidr-auth (Spring Boot :8080), spidr-server (Node.js :4000), and spidr-client (Vite :5173) — all in background processes. Call with /dev whenever you need a live local environment for testing."
---

# source-command-dev

Use this skill when the user asks to run the migrated source command `dev`.

## Command Template

# Start Spidr Local Dev Stack

Start all three Spidr services in parallel as background processes. Do not install anything — dependencies are already present.

## Step 1 — Launch all three services in parallel (background)

Run these three Bash commands **simultaneously** (all in the same message, all with `run_in_background: true`):

**spidr-auth** (Spring Boot — Auth microservice on :8080):
```bash
cd C:/dev/spidr-app/spidr-auth && JAVA_HOME="C:/Users/momli/.vscode/extensions/redhat.java-1.54.0-win32-x64/jre/21.0.10-win32-x86_64" ./mvnw spring-boot:run -DskipTests
```

**spidr-server** (Node.js / Express / Socket.io — Core API on :4000):
```bash
cd C:/dev/spidr-app/spidr-server && node src/index.js
```

**spidr-client** (Vite — React frontend on :5173):
```bash
cd C:/dev/spidr-app/spidr-client && npm run dev
```

## Step 2 — Report to the user

Once all three background processes are launched, immediately tell the user:

```
Spidr dev stack starting:

  Auth service   →  http://localhost:8080   (Spring Boot — takes ~15s to boot)
  API server     →  http://localhost:4000   (Node.js / nodemon)
  Frontend       →  http://localhost:5173   (Vite HMR)

All three are running in the background. Open http://localhost:5173 to use the app.
Note: wait ~15 seconds for Spring Boot before trying to log in or register.
```

## Notes

- The Vite dev server uses `.env.development` which already points to `localhost:4000` (API) and `localhost:8080` (auth) — no env changes needed.
- Spring Boot falls back to a built-in dev JWT secret if `JWT_SECRET` is not set — auth will work locally without extra config.
- spidr-server reads `.env` from `spidr-server/.env` — if it doesn't exist, remind the user to copy `.env.example` to `.env`.
- Do NOT run `npm install` or `mvn install` — skip straight to the run commands.
- If a port is already in use, tell the user which process to kill (e.g. `npx kill-port 4000`).
