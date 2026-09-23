# Ben & Dragon! - Owlbear Rodeo Extension

An Owlbear Rodeo extension for managing character sheets, stats, roll histories, initiative tracking, and homebrew systems, optimized for **Cloudflare Workers** & **Cloudflare Pages** backed by a **PostgreSQL** database.

---

## 🌟 Features & Cloud Architecture

- ⚡ **Cloudflare Workers & Pages**: Serverless edge deployment with Hono routing, low latency worldwide, and static asset serving.
- 🐘 **PostgreSQL Cloud Storage**: All character sheets, player assignments, initiative states, and roll histories are stored directly in PostgreSQL.
- 🔄 **Auto-Schema Migration**: Tables (`characters`, `app_state`, `roll_history`) are initialized automatically upon first connect.
- 🔌 **Universal Compatibility**: Works seamlessly with Neon, Supabase, Cloudflare Hyperdrive, Railway, Render, AWS RDS, or any PostgreSQL provider.
- 🛡️ **Anti-Caching & Real-Time Sync**: Guarantees zero stale browser cache while broadcasting updates across Owlbear Rodeo rooms in real-time.
- 📦 **1-Click Local & Legacy Migration**: Includes `npm run db:migrate` to instantly import existing JSON sheets to PostgreSQL.

---

## 🚀 Quick Start (Local Development)

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **(Optional) Configure Database**:
   Copy `.env.example` to `.env` and set your PostgreSQL connection string:
   ```env
   DATABASE_URL="postgres://user:password@hostname:5432/dbname?sslmode=require"
   ```
   *(If `DATABASE_URL` is omitted during local development, the app automatically falls back to local disk storage in `data/character-sheets.json`)*.

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

4. **Test Cloudflare Pages / Workers Functions locally**:
   ```bash
   npm run pages:dev
   ```

---

## ☁️ Deploying to Cloudflare

### Option 1: Cloudflare Workers with Static Assets (Wrangler CLI)

```bash
# 1. Build and deploy directly using Wrangler
npm run deploy

# Or run dry-run validation:
npm run check
```

### Option 2: Cloudflare Pages

```bash
# 1. Build and deploy to Cloudflare Pages
npm run pages:deploy
```

### Option 3: Cloudflare Dashboard

1. Go to the **Cloudflare Dashboard** → **Workers & Pages** → **Create application** → **Connect to Git**.
2. Select your repository.
3. Configure the **Build Settings**:
   - **Framework preset**: `Vite` (or None)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/`
4. Under **Settings** → **Environment variables**:
   - Add variable: `DATABASE_URL`
   - Value: `postgres://<username>:<password>@<host>:5432/<dbname>?sslmode=require`
5. Under **Settings** → **Functions** → **Compatibility flags**:
   - Ensure `nodejs_compat` is enabled (already defined in `wrangler.json` & `wrangler.toml`).
6. Click **Save and Deploy**.

---

## 🗄️ Database Management & Migrations

### Automatic Setup
The application automatically executes `CREATE TABLE IF NOT EXISTS` for all required tables on startup.

### Manual SQL Migration
If you prefer applying the SQL schema manually in your PostgreSQL console or SQL editor:
```sql
-- See schema.sql in root directory
\i schema.sql
```

### Migrating Existing Local Sheets to PostgreSQL
To migrate all sheets from `data/character-sheets.json` into your PostgreSQL database:
```bash
npm run db:migrate
```

---

## 📡 API Reference (Cloudflare Functions /api/*)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health, character count, and DB status |
| `GET` | `/api/character-sheets` | Fetch full state & character sheets from DB |
| `POST` | `/api/character-sheets` | Save/replace entire state |
| `POST` | `/api/sync` | Smart timestamp-based character merge |
| `GET` | `/api/characters/:id` | Get individual character by ID |
| `PUT` / `POST` | `/api/characters/:id` | Upsert individual character |
| `DELETE` | `/api/characters/:id` | Delete character and remove assignments |
| `GET` | `/api/export` | Export full backup JSON |
| `POST` | `/api/import` | Import full backup JSON into DB |
