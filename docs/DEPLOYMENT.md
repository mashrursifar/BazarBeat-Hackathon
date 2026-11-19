# Deployment & Cloud Infrastructure Guide — BazarBeat

This guide covers deployment setup, cloud configuration, and production infrastructure for BazarBeat.

---

## 1. Storage Architecture & Cloud Provider Setup

BazarBeat uses an S3-compatible storage adapter (`S3StorageProvider`), selectable via `STORAGE_PROVIDER=cloud`. It works with any S3-compatible object store (Cloudflare R2, AWS S3, Backblaze B2, MinIO, Wasabi, Supabase Storage).

The default local development provider (`STORAGE_PROVIDER=local`) saves images to disk under `UPLOAD_DIR` (`./uploads`). For production deployments where instances may be ephemeral or autoscaling, cloud storage prevents uploaded crop photos from vanishing on server restarts (addresses Decision D-40).

---

## 2. Setting Up a Free S3-Compatible Bucket (Recommended: Cloudflare R2)

Cloudflare R2 offers **10 GB of free storage per month** with **zero egress (bandwidth) fees**, making it ideal for hackathon demos, prototyping, and production hosting without cost risk.

### Step 1: Create a Cloudflare Account
1. Sign up for a free Cloudflare account at [dash.cloudflare.com](https://dash.cloudflare.com/).
2. Navigate to **R2 Object Storage** in the left-hand navigation menu.

### Step 2: Create an R2 Bucket
1. Click **Create bucket**.
2. Bucket name: `bazarbeat-uploads` (or any unique name).
3. Location: Select **Automatic** or your closest region.
4. Click **Create bucket**.

### Step 3: Enable Public Read Access
Photos uploaded by farmers must be publicly viewable by buyers on listing cards:
1. In your bucket dashboard, go to the **Settings** tab.
2. Scroll to **Public Access** -> **R2.dev subdomain**.
3. Click **Allow Access** and type `allow` to confirm.
4. Copy the generated public URL (e.g., `https://pub-xxxxxxxxxxxxxxxx.r2.dev`).
   *(Optional: You can also connect a custom domain like `cdn.bazarbeat.com` under "Custom Domains").*

### Step 4: Generate S3 API Credentials
1. In the R2 home page (outside the bucket), click **Manage R2 API Tokens** on the right side.
2. Click **Create API token**.
3. Configuration:
   - **Token name**: `bazarbeat-storage`
   - **Permissions**: **Object Read & Write**
   - **Bucket scope**: Select `bazarbeat-uploads` (or all buckets)
   - **TTL**: Forever (or as required)
4. Click **Create API Token**.
5. Copy the following credentials immediately (they will not be shown again):
   - **Access Key ID**
   - **Secret Access Key**
   - **Endpoint URL**: `https://<account-id>.r2.cloudflarestorage.com`

### Step 5: Configure Environment Variables
Set the following environment variables in your deployment host or `.env`:

```env
# Activate Cloud Storage Provider
STORAGE_PROVIDER=cloud

# S3 / R2 Connection Details
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_BUCKET=bazarbeat-uploads
S3_ACCESS_KEY_ID=<your-access-key-id>
S3_SECRET_ACCESS_KEY=<your-secret-access-key>
S3_REGION=auto
S3_PUBLIC_URL=https://pub-xxxxxxxxxxxxxxxx.r2.dev
S3_FORCE_PATH_STYLE=false
```

---

## 3. Alternative Free / Low-Cost Options

### Option B: Backblaze B2 (10 GB Free)
1. Sign up at [backblaze.com](https://www.backblaze.com/b2/cloud-storage.html) (10 GB free storage).
2. Create a Bucket with **Files in Bucket are Public**.
3. Create an Application Key with Read and Write permissions.
4. Environment variables:
   ```env
   STORAGE_PROVIDER=cloud
   S3_ENDPOINT=https://s3.<region>.backblazeb2.com
   S3_BUCKET=your-b2-bucket
   S3_ACCESS_KEY_ID=<keyID>
   S3_SECRET_ACCESS_KEY=<applicationKey>
   S3_REGION=<region>
   S3_PUBLIC_URL=https://f000.backblazeb2.com/file/your-b2-bucket
   S3_FORCE_PATH_STYLE=false
   ```

### Option C: Local MinIO (Free & Self-Hosted for Development)
To test S3-compatible cloud storage locally without external accounts:
1. Run MinIO via Docker:
   ```bash
   docker run -d -p 9000:9000 -p 9001:9001 --name minio \
     -e "MINIO_ROOT_USER=minioadmin" \
     -e "MINIO_ROOT_PASSWORD=minioadmin" \
     minio/minio server /data --console-address ":9001"
   ```
2. Open `http://localhost:9001`, create a bucket named `bazarbeat-uploads`, and set its Access Policy to `Public`.
3. Configure `.env`:
   ```env
   STORAGE_PROVIDER=cloud
   S3_ENDPOINT=http://127.0.0.1:9000
   S3_BUCKET=bazarbeat-uploads
   S3_ACCESS_KEY_ID=minioadmin
   S3_SECRET_ACCESS_KEY=minioadmin
   S3_REGION=auto
   S3_FORCE_PATH_STYLE=true
   S3_PUBLIC_URL=http://127.0.0.1:9000/bazarbeat-uploads
   ```

---

## 4. Seeding Sample Photos Under Active Provider

When `STORAGE_PROVIDER=cloud`, running the seed scripts uploads the sample photos directly to the configured bucket:

```bash
# Seed development listings and history using active storage provider
npm run seed:dev-listings
```

- Each sample crop image is loaded from `apps/api/src/seed/assets/samples/`.
- Processed by Sharp (EXIF stripped, resized, content hash computed).
- Stored through the active `StorageProvider` (`S3StorageProvider` for cloud, `LocalDiskStorageProvider` for local).
- Stored listings point directly to the cloud public URL (`https://pub-xxxx.r2.dev/crops/<uuid>.jpg`).

---

## 5. Security & Credential Hygiene

- **No Secrets in Logs or Responses**: The `S3StorageProvider` redacts `secretAccessKey` and error details so credentials never leak into server stdout, log streams, or API error responses.
- **Fail-Fast Boot Checks**: In production mode (`NODE_ENV=production`), server startup fails immediately if `STORAGE_PROVIDER=cloud` is set without valid credentials.
- **Deep Health Check**: `/api/v1/health?deep=true` reports the active storage provider (`local` or `cloud`) and its operational status without exposing bucket credentials.
