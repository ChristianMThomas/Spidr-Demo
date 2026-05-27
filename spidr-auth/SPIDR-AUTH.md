# spidr-auth — Spring Boot Auth Service

> Java 21 · Spring Boot 4.0.5 · Spring Security · Spring Data MongoDB · JavaMailSender · jjwt 0.11.5

---

## Overview

`spidr-auth` is a dedicated authentication microservice for the Spidr platform. It is responsible for all identity operations: registration, login, OTP verification, JWT issuance, and user management. All other Spidr services (`spidr-server`, `spidr-ai`) validate the JWTs this service issues.

**Port:** `8080`
**Database:** MongoDB — `users` collection (shared Atlas cluster with `spidr-server`)

---

## Project Structure

```
spidr-auth/src/main/java/com/spidr/spidr_auth/
│
├── config/
│   ├── ApplicationConfig.java          — UserDetailsService, PasswordEncoder, AuthenticationManager beans
│   ├── EmailConfiguration.java         — JavaMailSender bean wired from .env
│   ├── JwtAuthenticationFilter.java    — Intercepts every request, validates JWT, sets SecurityContext
│   └── SecurityConfiguration.java     — Filter chain, route permissions, CORS
│
├── controller/
│   ├── AuthController.java             — /auth/** endpoints (signup, login, verify, resend)
│   └── UserController.java            — /users/** endpoints (me, all users)
│
├── dto/
│   ├── RegisterUserDTO.java            — Request body for signup
│   ├── LoginUserDTO.java               — Request body for login
│   └── VerifyUserDTO.java              — Request body for OTP verification
│
├── model/
│   └── users.java                      — MongoDB document + UserDetails implementation
│
├── repository/
│   └── userRepository.java            — Spring Data MongoDB queries
│
├── responses/
│   └── LoginResponse.java             — JWT token response shape
│
├── service/
│   ├── AuthService.java               — Core auth logic (register, login, verify, resend)
│   ├── EmailService.java              — HTML email sending (verify, login OTP, password reset)
│   ├── JwtService.java                — Token generation, validation, claim extraction
│   └── UserService.java              — User management (get current user, update, delete)
│
└── SpidrAuthApplication.java          — Entry point (@EnableAsync)
```

---

## API Routes

### Auth — `/auth`
> All endpoints public — no JWT required

---

#### `POST /auth/signup`
Registers a new user account.

**Request body:**
```json
{
  "username": "chris",
  "email": "chris@example.com",
  "password": "mypassword1"
}
```

**Validation:**
- `username` — required, not blank
- `email` — required, valid email format
- `password` — required, minimum 8 characters

**Flow:**
1. Checks email and username are not already taken
2. Hashes password with BCrypt (strength 12)
3. Creates user with `enabled = false`
4. Generates 6-digit OTP, stores on user with 15-minute expiry
5. Sends verification email asynchronously

**Success response `200`:**
```json
{ "message": "Account created. Check your email for a verification code." }
```

**Error response `400`:**
```json
{ "error": "Email already in use" }
```

---

#### `POST /auth/login`
Authenticates credentials and sends a login OTP.

**Request body:**
```json
{
  "email": "chris@example.com",
  "password": "mypassword1"
}
```

**Flow:**
1. `AuthenticationManager` verifies email + password via `DaoAuthenticationProvider`
2. Checks account is verified (`enabled = true`)
3. Generates new 6-digit OTP, stores on user with 15-minute expiry
4. Sends login OTP email asynchronously
5. Returns message — no JWT yet

**Success response `200`:**
```json
{ "message": "Verification code sent to your email." }
```

**Error response `400`:**
```json
{ "error": "Account not verified. Please check your email." }
```

---

#### `POST /auth/verify`
Validates OTP and issues a JWT.

**Request body:**
```json
{
  "email": "chris@example.com",
  "verificationCode": "482910"
}
```

**Flow:**
1. Finds user by email
2. Checks OTP has not expired (`verificationExpiration > now`)
3. Checks submitted code matches stored code
4. Sets `enabled = true` (first time only), clears OTP fields
5. Generates and returns JWT

**Success response `200`:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "expiresIn": 86400000
}
```

**Error response `400`:**
```json
{ "error": "Verification code has expired. Please request a new one." }
```

---

#### `POST /auth/resend`
Resends a verification OTP to the user's email.

**Request body:**
```json
{ "email": "chris@example.com" }
```

**Flow:**
1. Finds user by email
2. Checks account is not already verified
3. Generates new OTP with fresh 15-minute expiry
4. Sends verification email asynchronously

**Success response `200`:**
```json
{ "message": "New verification code sent." }
```

---

### Users — `/users`
> All endpoints protected — valid JWT required in `Authorization: Bearer <token>` header

---

#### `GET /users/me`
Returns the currently authenticated user.

**Flow:**
Pulls the `users` object directly from `SecurityContextHolder` — no database call needed since `JwtAuthenticationFilter` already loaded the user.

**Success response `200`:**
```json
{
  "id": "661f4e...",
  "username": "chris",
  "email": "chris@example.com",
  "enabled": true,
  "verificationCode": null,
  "verificationExpiration": null
}
```

---

#### `GET /users/`
Returns all registered users.

**Success response `200`:**
```json
[
  { "id": "661f4e...", "username": "chris", "email": "chris@example.com", ... },
  { "id": "771a2b...", "username": "alex",  "email": "alex@example.com",  ... }
]
```

> Note: This endpoint should be restricted to admin users when roles are added.

---

## Security Architecture

### Request Flow
```
Incoming HTTP request
        ↓
JwtAuthenticationFilter
  ├── No Authorization header → skip, continue chain (public routes pass through)
  ├── Malformed token → skip, continue chain → 401 on protected routes
  └── Valid token → load user from MongoDB → set SecurityContext
        ↓
SecurityFilterChain route check
  ├── /auth/** → permitAll()
  └── everything else → requires authenticated SecurityContext
        ↓
Controller
```

### JWT Token
- **Algorithm:** HS256 (HMAC-SHA256)
- **Subject:** user email
- **Issued at:** time of OTP verification
- **Expiry:** configurable via `JWT_EXPIRATION` (default 24 hours)
- **Stored:** client stores in `localStorage` under `spidr_token`

### Password Hashing
BCrypt with strength 12 — matches the existing `spidr-server` Node.js backend so password hashes are compatible during migration.

### OTP
- 6-digit numeric code
- 15-minute expiry stored on the `users` document
- Cleared from the document after successful verification
- Sent async via Gmail SMTP so it never blocks the HTTP response

---

## Data Model — `users`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String` | MongoDB `_id` |
| `username` | `String` | Display name |
| `email` | `String` | Login identifier, unique |
| `password` | `String` | BCrypt hashed |
| `verificationCode` | `String` | Current OTP (null when not pending) |
| `verificationExpiration` | `LocalDateTime` | OTP expiry (null when not pending) |
| `enabled` | `boolean` | False until first OTP verified |

---

## Configuration — `.env`

| Key | Required | Description |
|-----|----------|-------------|
| `MONGO_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Base64 encoded 256-bit secret |
| `JWT_EXPIRATION` | — | Token lifetime in ms (default: `86400000`) |
| `SPRING_MAIL_HOST` | — | SMTP host (default: `smtp.gmail.com`) |
| `SPRING_MAIL_PORT` | — | SMTP port (default: `587`) |
| `SPRING_MAIL_USERNAME` | ✅ | Gmail address |
| `SPRING_MAIL_PASSWORD` | ✅ | Gmail App Password (16 chars) |

> Generate `JWT_SECRET`:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
> ```

---

## Running Locally

```bash
cd spidr-auth

# Fill in your values
cp .env .env.local

# Run with Maven
mvn spring-boot:run
```

Server starts on `http://localhost:8080`

---

## Planned

- Role-based access (`ADMIN`, `USER`) — lock down `GET /users/` to admins
- RS256 JWT signing (private/public key) — so `spidr-server` and `spidr-ai` verify tokens without the secret
- TOTP authenticator app support (Google Authenticator / Authy)
- Phone SMS OTP via Twilio as alternative to email
- `PATCH /users/me` — update username
- `POST /users/change-password` — change password with current password verification
- `DELETE /users/me` — delete account
