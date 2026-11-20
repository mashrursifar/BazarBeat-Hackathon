# Deployment & Cloud Infrastructure Guide — BazarBeat

This guide covers deployment setup, cloud configuration, and production infrastructure for BazarBeat on **Render**, **MongoDB Atlas**, and **Cloud Storage (Cloudinary or Cloudflare R2 / S3)**.

---

## 1. Production Architecture Overview (Single-Service Model)

Per Decision **D-37**, BazarBeat deploys as a **single service**:
- The Express server serves both:
  1. The REST API and real-time Server-Sent Events (SSE) live auction streams (`/api/v1/*`)
  2. The production-compiled React SPA frontend (`apps/web/dist`) with client route fallback
- **Single Origin**: Avoids CORS issues, cookie drop across different domains (`SameSite=Lax`), and proxy buffering of live event streams.
- **Stateless Server**: All persistent data lives in **MongoDB Atlas** and media files live in cloud storage (**Cloudinary** or S3-compatible **R2**).

---

## 2. Cloud Storage Providers

BazarBeat's storage adapter (`apps/api/src/modules/storage`) automatically selects the provider based on environment variables:

1. **Cloudinary** (`STORAGE_PROVIDER=cloud` with `CLOUDINARY_URL` or discrete keys): Uploads processed image buffers to Cloudinary via direct signed REST API. Zero egress fees and generous free tier.
2. **S3-Compatible (Cloudflare R2, AWS S3, Backblaze B2, MinIO)** (`STORAGE_PROVIDER=cloud` with `S3_BUCKET`, `S3_ACCESS_KEY_ID`, etc.): 10 GB free on R2 with zero egress fees.
3. **Local Disk** (`STORAGE_PROVIDER=local`): Default for local offline development.

---

## 3. Setting Up Cloudinary

If you are using Cloudinary for image uploads:

1. Log into your [Cloudinary Console](https://cloudinary.com/).
2. On the Dashboard, find your **Product Environment Credentials**:
   - **Cloud Name**
   - **API Key**
   - **API Secret**
   - **API Environment variable**: `cloudinary://<api_key>:<api_secret>@<cloud_name>`
3. Configure your deployment with either the single `CLOUDINARY_URL` or the three individual variables:
   ```env
   STORAGE_PROVIDER=cloud
   CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
   ```
   *(Alternatively: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`)*

---

## 4. Setting Up MongoDB Atlas

1. Create a free shared cluster (M0) on [MongoDB Atlas](https://www.mongodb.com/atlas).
2. **Database Access**: Under *Security -> Database Access*, create a database user with read and write permissions (e.g. `bazarbeat-admin`).
3. **Network Access**: Under *Security -> Network Access*, add IP address `0.0.0.0/0` (Allow Access from Anywhere). This is required because cloud hosting platforms like Render assign dynamic outbound IPs to web services.
4. **Connection String**: Click **Connect** -> **Drivers** (Node.js) and copy the connection string:
   ```
   mongodb+srv://<username>:<password>@<cluster>.mongodb.net/BazarBeat?retryWrites=true&w=majority
   ```

---

## 5. Seeding MongoDB Atlas from your Local Machine

Before deploying (or whenever resetting the demo data), populate your Atlas cluster with the 5 crops, demo farmers, demo buyers, and active listings with real sample photos uploaded to your cloud storage:

```bash
# Set your Atlas URI and Cloudinary credentials, then run:
MONGODB_URI="mongodb+srv://<username>:<password>@<cluster>.mongodb.net/BazarBeat?retryWrites=true&w=majority" \
STORAGE_PROVIDER=cloud \
CLOUDINARY_URL="cloudinary://<api_key>:<api_secret>@<cloud_name>" \
npm run seed:dev-listings
```

On Windows PowerShell:
```powershell
$env:MONGODB_URI="mongodb+srv://<username>:<password>@<cluster>.mongodb.net/BazarBeat?retryWrites=true&w=majority"
$env:STORAGE_PROVIDER="cloud"
$env:CLOUDINARY_URL="cloudinary://<api_key>:<api_secret>@<cloud_name>"
npm run seed:dev-listings
```

The script will:
- Insert the 5 crops into Atlas.
- Create 12 farmers and 8 buyers (including demo accounts).
- Strip EXIF data and resize sample images, upload them to Cloudinary, and save HTTPS image URLs to Atlas.
- Verify inventory ledger reconciliation across all crops.

---

## 6. Deploying to Render

You can deploy to Render either using the multi-stage `Dockerfile` (recommended) or as a native Node Web Service.

### Option A: Deploy via Docker (Recommended)
1. In the [Render Dashboard](https://dashboard.render.com/), click **New +** -> **Web Service**.
2. Connect your Git repository.
3. Select **Docker** as the Runtime (Render automatically detects the repository root `Dockerfile`).
4. Select your Region (e.g., Oregon or Frankfurt).
5. Instance Type: **Free** (or Starter).
6. Under **Advanced**, set **Health Check Path** to: `/api/v1/health`
7. Add the Environment Variables from the table below.
8. Click **Deploy Web Service**.

### Option B: Deploy via Native Node Environment
If you prefer Render's native Node environment:
- **Runtime**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start`
- **Health Check Path**: `/api/v1/health`

---

## 7. Complete Environment Variables Table for Render

| Variable | Recommended / Required Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production security checks and optimization |
| `SERVE_WEB` | `true` | Serves the built React SPA frontend from Express |
| `TRUST_PROXY` | `true` | Allows rate-limiter and logger to read `X-Forwarded-For` from Render proxy |
| `PORT` | `10000` | Port for Express (Render injects `PORT` automatically) |
| `MONGODB_URI` | `mongodb+srv://...` | Your MongoDB Atlas connection string |
| `COOKIE_DOMAIN` | `<your-app>.onrender.com` | Cookie domain matching your Render URL |
| `CORS_ORIGINS` | `https://<your-app>.onrender.com` | Allowed CORS origins (matches the single origin) |
| `STORAGE_PROVIDER` | `cloud` | Enables cloud storage adapter |
| `CLOUDINARY_URL` | `cloudinary://<key>:<secret>@<cloud>` | Your Cloudinary credentials |
| `JWT_ACCESS_SECRET` | *(Random 32+ character string)* | Secret for auth access tokens (must not be default) |
| `JWT_REFRESH_SECRET` | *(Random 32+ character distinct string)* | Secret for auth refresh tokens (must differ from access) |
| `AI_GRADING_PROVIDER` | `mock` | Grading provider (`mock` or `gemini`) |
| `AI_PRICE_PROVIDER` | `mock` | Price guidance provider (`mock` or `baseline`) |
| `GEMINI_API_KEY` | *(Secret from Google AI Studio)* | Required when `AI_GRADING_PROVIDER=gemini` |
| `RATE_LIMIT_AUTH_PER_MIN` | `60` | Relaxed auth rate limit to avoid venue IP lockout (Decision D-41) |
| `DEMO_MODE` | `false` | `true` enables shortened 2-minute auction timers |

---

## 8. Rollback Procedure on Render

If a newly deployed commit introduces an issue or fails the smoke test:
1. Go to your Web Service in the [Render Dashboard](https://dashboard.render.com/).
2. Click the **Deploys** tab in the left sidebar.
3. Locate the previous working deploy (marked with green checkmark).
4. Click the three dots `...` on that deploy row and select **Rollback to this deploy**.
5. Render immediately stops the current build and spins up the previous working container within ~30 seconds.

---

## 9. Keep-Warm Setup (Preventing Cold Starts)

Render free instances spin down after 15 minutes of inactivity. When asleep, incoming requests take 30–50 seconds to wake up, and auction close timers pause during sleep.

To keep the instance awake during hackathon demos and rehearsals:
1. Sign up for a free uptime monitor such as [UptimeRobot](https://uptimerobot.com/) or [cron-job.org](https://cron-job.org/).
2. Create an **HTTP monitor**:
   - **URL**: `https://<your-app>.onrender.com/api/v1/health`
   - **Interval**: Every **10 minutes**
   - **Expected Status**: `200`
3. This guarantees the service stays warm in memory and the auction scheduler continues ticking.

---

## 10. Running the Production Smoke Test

Once your Render app is live, verify the entire deployment end-to-end with the Playwright smoke suite:

```bash
# Run against the public live URL:
BASE_URL=https://<your-app>.onrender.com npm run test:smoke
```

On Windows PowerShell:
```powershell
$env:BASE_URL="https://<your-app>.onrender.com"
npm run test:smoke
```

The smoke suite verifies:
1. `GET /api/v1/health?deep=true`: Confirms database connectivity, query latency, and operational storage.
2. Landing page loads branding, navigation, and links.
3. Demo farmer (`01700000001` / `farmerpassword123`) can log in and view the farmer dashboard.
4. Demo buyer (`01712345678` / `buyerpassword123`) can log in and access the marketplace.
5. Marketplace listing cards render with valid photos without broken images.
6. A listing detail page opens showing price, timer, and grade badge.
7. Real-time Server-Sent Events (SSE) live auction stream connects and receives the initial `snapshot`.

---

## 11. Preflight Verification Suite (`npm run preflight -- --url <base-url>`)

Task 9.5 provides an automated preflight suite that runs against any target deployment or local instance to verify operational readiness before hackathon rehearsals and reviewer demos.

### Running Preflight

```bash
# Against a deployed instance:
npm run preflight -- --url https://<your-app>.onrender.com

# Against a local development / staging instance:
npm run preflight -- --url http://localhost:4000
```

On Windows PowerShell:
```powershell
npm run preflight -- --url https://<your-app>.onrender.com
```

### Verification Checks

The suite executes 8 checks, printing a clear `[PASS]` or `[FAIL]` status for each:
1. **health (deep)**: Confirms `GET /api/v1/health?deep=true` reports overall status `ok`, build version `GIT_SHA`, and uptime.
2. **AI service reachable and warm**: Validates AI provider operational status and responsiveness.
3. **database latency**: Confirms MongoDB Atlas connection is healthy and measures query roundtrip latency in ms.
4. **storage write and read**: Uploads a real produce sample photo to verify storage writes (Cloudinary / S3 / local disk) and fetches the stored URL over HTTP to verify storage reads. If credentials (such as `CLOUDINARY_URL` or S3 keys) are wrong, the check fails with a clear, readable error message.
5. **the demo badge state**: Verifies `GET /api/v1/config` has `demoMode: true` so the "Demo mode: timers are shortened" badge renders on the UI.
6. **logins for both demo roles**: Signs in demo farmer (`01700000001` / `farmerpassword123`) and demo buyer (`01712345678` / `buyerpassword123`), verifying session cookies.
7. **scheduler alive (a short auction actually closes)**: Publishes a fast demo listing with a real sample photo, places a competitive buyer bid above floor price, waits for `endsAt` expiration, and verifies the background scheduler automatically triggers closing and transitions status to `CLOSED_SOLD`.
8. **a full mini journey & cleanup**: Validates that an order was generated from the closed auction with matching buyer, farmer, and total amounts, followed by automated cleanup (cancelling the test order) to avoid polluting demo state.

### Exit Codes
- Exits with code `0` if and only if all 8 checks pass.
- Exits with non-zero exit code (`1`) on any failure.

---

## 12. Security & Credential Hygiene

- **No Secrets in Logs or Responses**: The storage providers and database clients redact secrets, passwords, and tokens from all log streams and API error payloads.
- **Fail-Fast Boot Checks**: In production mode (`NODE_ENV=production`), server startup fails immediately if secrets are weak, missing, or use local placeholders.
- **Deep Health Check**: `/api/v1/health?deep=true` reports provider health and database latency without exposing connection strings or API keys.
