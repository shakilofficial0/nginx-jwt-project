# Nginx NJS JWT Image Auth

A production-ready Nginx setup using the official `nginx` Docker image with the `nginx-module-njs` package installed to protect image files behind JWT authentication. Requests to `/micro_images/{user_id}_images.png` are only served when the request carries a valid HS256 JWT signed with the configured secret and whose `user_id` claim matches the `{user_id}` segment in the URL.

***

## File Hierarchy

```
nginx-jwt-project/
├── Dockerfile                   # Builds official nginx + installs nginx-module-njs
├── docker-compose.yml           # Compose service definition with volume mounts
└── nginx/
    ├── nginx.conf               # Main nginx config — loads njs dynamic module
    ├── conf.d/
    │   └── default.conf         # Server block — protected route + auth subrequest
    └── njs/
        └── auth.js              # NJS script — JWT signature + user_id verification
```

> **Host path** `/var/www/html/images/` is mounted read-only into the container.  
> Image files must follow the naming convention `{user_id}_image.png` (singular `image`).

***

## How It Works

### Request Flow

```
Client Request
  GET /micro_images/42_images.png
  Authorization: Bearer <jwt>
         │
         ▼
┌─────────────────────────────────┐
│  Nginx: default.conf            │
│  location ~ _images\.png        │
│  auth_request /auth  ───────────┼──► Internal subrequest to /auth
│                                 │           │
│                                 │           ▼
│                                 │   NJS: auth.js → verifyJwt()
│                                 │   1. Extract token (header / query)
│                                 │   2. Verify HS256 signature
│                                 │   3. Check exp claim
│                                 │   4. Parse user_id from URL
│                                 │   5. Compare URL user_id == JWT user_id
│                                 │           │
│                         ┌───────┼───────────┘
│                         │       │
│              200 ◄──────┤       │  401 → missing / bad token
│              (pass)     │       │  403 → user_id mismatch
│                         │       │
│  alias /var/www/html/   │       │
│  images/${user_id}      │       │
│  _image.png             │       │
└─────────────────────────┘       │
         │                        │
         ▼                        ▼
  200 + image data        401 / 403 JSON error
```

### Key Components

| Component | Role |
|---|---|
| `Dockerfile` | Installs `nginx-module-njs` from the official Nginx apt repo on top of `nginx:1.27-bookworm` |
| `nginx.conf` | Loads `ngx_http_js_module.so` dynamic module, sets `js_path` and `js_import` |
| `default.conf` | Regex location captures `{user_id}`, fires `auth_request /auth`, then `alias`-serves the file |
| `auth.js` | Pure NJS — decodes JWT, verifies HMAC-SHA256 signature, validates `user_id` claim |

### JWT Verification Steps (auth.js)

1. **Extract token** — checks `Authorization: Bearer <token>` header first, then `?token=` query parameter.
2. **Split JWT** — splits into `header.payload.signature`; rejects anything that is not exactly 3 parts.
3. **Verify signature** — recomputes `HMAC-SHA256(secret, header + "." + payload)` and compares against the supplied signature using `base64url` encoding.
4. **Check expiry** — if the payload contains an `exp` claim, rejects the token if `Date.now() / 1000 > exp`.
5. **Extract URL user_id** — matches the regex `/^\/micro_images\/([^/]+)_images\.png$/` against `r.uri`.
6. **Compare claims** — stringifies both sides and rejects with `403` if they differ.
7. **Pass** — returns `200` so Nginx proceeds to serve the file.

***

## Configuration

### JWT Secret

The authentication settings are defined at the top of `nginx/njs/auth.js`:

```js
var JWT_SECRET = "i-hate-my-job-because-nginx-jwt-does-work";
var JWT_ALGORITHM = "HS256";
```

Supported HMAC algorithms in the script are `HS256`, `HS384`, and `HS512`. If `JWT_ALGORITHM` is set to anything else, the handler returns a server error until matching verification logic is implemented.

> Important: `RS256` is **not** handled by the current script. RSA verification is different from HMAC verification, and njs discussions around JWT examples note that HS* examples do not automatically apply to RS256 flows.

### URL Pattern

| URL | Disk path served |
|---|---|
| `/micro_images/42_images.png` | `/var/www/html/images/42_image.png` |
| `/micro_images/john_images.png` | `/var/www/html/images/john_image.png` |
| `/micro_images/usr_99_images.png` | `/var/www/html/images/usr_99_image.png` |

> Note: The URL uses `_images.png` (plural) but the file on disk uses `_image.png` (singular). The `alias` directive maps between them.

***

## Getting Started

### Prerequisites

- Docker ≥ 24
- Docker Compose ≥ 2.x
- Host directory `/var/www/html/images/` with image files named `{user_id}_image.png`

### Build and Run

```bash
# Clone / copy project files, then:
docker compose up --build -d

# Verify nginx config inside container
docker exec nginx_jwt nginx -t

# Tail logs
docker compose logs -f
```

### Stopping

```bash
docker compose down
```

***

## Generating a Test JWT

Use Python to generate a signed HS256 token locally:

```python
import hmac, hashlib, base64, json, time

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

secret  = "shakilofficial0"
header  = b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
payload = b64url(json.dumps({
    "user_id": "42",
    "exp": int(time.time()) + 3600   # expires in 1 hour
}).encode())

signing_input = f"{header}.{payload}"
signature = b64url(
    hmac.new(secret.encode(), signing_input.encode(), hashlib.sha256).digest()
)

token = f"{signing_input}.{signature}"
print(token)
```

Run it:

```bash
python3 gen_token.py
# eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiNDIiLCJleHAiOjE3...
```

***

## Testing

### 1. Valid Request (Authorization header)

```bash
TOKEN=$(python3 gen_token.py)

curl -i \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost/micro_images/42_images.png
```

**Expected:**
```
HTTP/1.1 200 OK
Content-Type: image/png
...
<binary image data>
```

***

### 2. Valid Request (Query parameter)

```bash
curl -i \
  "http://localhost/micro_images/42_images.png?token=$TOKEN"
```

**Expected:** `200 OK` with image body.

***

### 3. Missing Token

```bash
curl -i http://localhost/micro_images/42_images.png
```

**Expected:**
```
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{"error":"Unauthorized","message":"Missing or invalid JWT token"}
```

***

### 4. Invalid / Tampered Token

```bash
curl -i \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoiNDIifQ.INVALIDSIG" \
  http://localhost/micro_images/42_images.png
```

**Expected:**
```
HTTP/1.1 401 Unauthorized

{"error":"Unauthorized","message":"Missing or invalid JWT token"}
```

***

### 5. user_id Mismatch (token says 42, URL says 99)

Generate a token for user `42`, then request user `99`:

```bash
curl -i \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost/micro_images/99_images.png
```

**Expected:**
```
HTTP/1.1 403 Forbidden
Content-Type: application/json

{"error":"Forbidden","message":"Token user_id does not match resource user_id"}
```

***

### 6. Expired Token

Generate a token with `exp` in the past:

```python
payload = b64url(json.dumps({"user_id": "42", "exp": 1000000000}).encode())
```

```bash
curl -i \
  -H "Authorization: Bearer $EXPIRED_TOKEN" \
  http://localhost/micro_images/42_images.png
```

**Expected:**
```
HTTP/1.1 401 Unauthorized

{"error":"Unauthorized","message":"Missing or invalid JWT token"}
```

***

### 7. File Not Found (valid token, no file on disk)

```bash
curl -i \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost/micro_images/999_images.png
```

**Expected:**
```
HTTP/1.1 404 Not Found
```

***

## Response Reference

| Scenario | HTTP Status | Body |
|---|---|---|
| Valid JWT + user_id match + file exists | `200 OK` | Binary PNG |
| Valid JWT + user_id match + file missing | `404 Not Found` | Nginx default 404 |
| No token provided | `401 Unauthorized` | `{"error":"Unauthorized","message":"Missing or invalid JWT token"}` |
| Malformed JWT (wrong parts) | `401 Unauthorized` | `{"error":"Unauthorized","message":"Missing or invalid JWT token"}` |
| Bad signature | `401 Unauthorized` | `{"error":"Unauthorized","message":"Missing or invalid JWT token"}` |
| Expired token (`exp` claim) | `401 Unauthorized` | `{"error":"Unauthorized","message":"Missing or invalid JWT token"}` |
| user_id mismatch | `403 Forbidden` | `{"error":"Forbidden","message":"Token user_id does not match resource user_id"}` |
| Non-GET method | `405 Method Not Allowed` | Nginx default 405 |

***

## Security Notes

- The `location = /auth` block is marked `internal` — it cannot be accessed directly by external clients.
- Images volume is mounted **read-only** (`:ro`) — the container cannot modify host files.
- Only `GET` is allowed on the image endpoint via `limit_except GET { deny all; }`.
- For production, replace the hardcoded `JWT_SECRET` with a secrets manager or Docker secret.
- Add HTTPS (Let's Encrypt / Certbot sidecar) before exposing this service publicly.
- Consider adding `add_header Cache-Control "private, no-store";` to prevent downstream caching of protected images.
