# Church Platform — Deployment & Secrets Master Guide

This guide contains everything you need to configure API keys, set backend secrets, push database migrations, deploy Supabase Edge Functions, and host both the **Admin Portal** and **Mobile Web App** on Vercel.

---

## 📌 Target Supabase Project Reference
- **Project Ref:** `yqvkkgpffskszmmdwqxx`
- **Project URL:** `https://yqvkkgpffskszmmdwqxx.supabase.co`
- **Edge Functions Base URL:** `https://yqvkkgpffskszmmdwqxx.supabase.co/functions/v1`

---

## 🚀 Quick Step-by-Step Deployment Commands

### 1. Link Your Supabase Project
Run this command in the project root (`E:\Cot-church-Project`):
```bash
supabase link --project-ref yqvkkgpffskszmmdwqxx
```
*(Enter your database password when prompted).*

### 2. Push Database Migrations
To apply all database tables, policies, and permissions:
```bash
supabase db push
```

### 3. Deploy All Edge Functions
```bash
supabase functions deploy --no-verify-jwt
```

---

## 🔐 1. Backend Secrets (Set in Supabase)

These secrets are stored securely in Supabase Edge Functions and are **never exposed to client applications**.

### How to Set Them (Option A: CLI)
You can run this single command to set all your secrets at once:

```bash
supabase secrets set \
  ALLOWED_ORIGINS="https://admin.yourchurch.com,https://app.yourchurch.com,http://localhost:5173" \
  RATE_LIMIT_PEPPER="$(openssl rand -hex 32)" \
  PASSWORD_RECOVERY_REDIRECT_URL="https://cot-app-green.vercel.app/reset-password" \
  NOTIFICATION_WORKER_SECRET="$(openssl rand -hex 32)" \
  WORKFLOW_WORKER_SECRET="$(openssl rand -hex 32)" \
  PAYMENT_WEBHOOK_SECRET="$(openssl rand -hex 32)" \
  STREAMING_MUX_PRIMARY='{"tokenId":"YOUR_MUX_TOKEN_ID","tokenSecret":"YOUR_MUX_TOKEN_SECRET"}' \
  STREAMING_MUX_WEBHOOK_PRIMARY="YOUR_MUX_WEBHOOK_SECRET" \
  AI_OPENAI_PRIMARY="sk-proj-YOUR_OPENAI_KEY" \
  AI_GEMINI_PRIMARY="YOUR_GEMINI_KEY" \
  AI_ANTHROPIC_PRIMARY="sk-ant-YOUR_ANTHROPIC_KEY"
```

### How to Set Them (Option B: Supabase Dashboard)
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/yqvkkgpffskszmmdwqxx).
2. Click **Project Settings** (gear icon) → **Edge Functions** → **Secrets**.
3. Add each secret key and value below.

---

### Complete Secrets Breakdown:

| Secret Name | Where to Obtain | Format / Instructions |
| :--- | :--- | :--- |
| `ALLOWED_ORIGINS` | Your frontend domains | Comma-separated domains allowed for CORS (e.g. `https://your-admin.vercel.app,https://your-mobile.vercel.app`). |
| `RATE_LIMIT_PEPPER` | Terminal: `openssl rand -hex 32` | 64-character random hex string for hashing IP rate limits. |
| `PASSWORD_RECOVERY_REDIRECT_URL` | Your frontend URL | COT **app** reset route, never the Platform Administration site. Current connected production web target: `https://cot-app-green.vercel.app/reset-password`. Native app scheme: `churchos://reset-password`; use it only when your Supabase/Auth redirect configuration and mobile deep-link delivery are intentionally set up for the native flow. |

> **Password recovery boundary:** account recovery is a COT member-app flow. Do not point `PASSWORD_RECOVERY_REDIRECT_URL` at `cot-admin` or any Platform Administration URL. The destination must render the app's `/reset-password` route that consumes the Supabase recovery session and completes the password update.
| `NOTIFICATION_WORKER_SECRET` | Terminal: `openssl rand -hex 32` | Secret key authenticating internal notification dispatch workers. |
| `WORKFLOW_WORKER_SECRET` | Terminal: `openssl rand -hex 32` | Secret key authenticating internal background workflow jobs. |
| `PAYMENT_WEBHOOK_SECRET` | Stripe / Paystack Webhook settings OR `openssl rand -hex 32` | HMAC SHA-256 secret for verifying inbound payment notifications. |
| `STREAMING_MUX_PRIMARY` | [Mux Dashboard](https://dashboard.mux.com/) → **Settings** → **Access Tokens** | JSON string: `{"tokenId":"YOUR_TOKEN_ID","tokenSecret":"YOUR_TOKEN_SECRET"}` with *Mux Video: Full Access*. |
| `STREAMING_MUX_WEBHOOK_PRIMARY` | [Mux Dashboard](https://dashboard.mux.com/) → **Settings** → **Webhooks** | The Webhook Secret generated when creating a webhook in Mux. |
| `STREAMING_MUX_SIGNING_PRIMARY` *(Optional)* | [Mux Dashboard](https://dashboard.mux.com/) → **Settings** → **Signing Keys** | JSON string: `{"keyId":"...","privateKeyPem":"-----BEGIN PRIVATE KEY-----\n..."}` for signed streams. |
| `AI_OPENAI_PRIMARY` | [OpenAI Platform](https://platform.openai.com/api-keys) | API key starting with `sk-proj-...` |
| `AI_GEMINI_PRIMARY` | [Google AI Studio](https://aistudio.google.com/app/apikey) | String API key |
| `AI_ANTHROPIC_PRIMARY` | [Anthropic Console](https://console.anthropic.com/settings/keys) | API key starting with `sk-ant-...` |

---

## 🌐 2. Web Deployments on Vercel

Deploy both applications as **2 separate projects** from your single GitHub repository.

### Project 1: Admin Portal
- **Import Repo** in [Vercel Dashboard](https://vercel.com/new).
- **Root Directory:** `apps/admin`
- **Framework Preset:** `Vite`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Environment Variables:**
  - `VITE_API_URL` = `https://yqvkkgpffskszmmdwqxx.supabase.co/functions/v1`

---

### Project 2: Mobile Web App (Expo Web SPA)
- **Import Repo** again in Vercel for a second project.
- **Root Directory:** `apps/mobile`
- **Framework Preset:** `Other`
- **Build Command:** `npm run build:web`
- **Output Directory:** `dist`
- **Environment Variables:**
  - `EXPO_PUBLIC_API_URL` = `https://yqvkkgpffskszmmdwqxx.supabase.co/functions/v1`
  - `EXPO_PUBLIC_ORGANIZATION_ID` = `<UUID of your church organization>` *(Found in your `organizations` table in Supabase)*
  - `EXPO_PUBLIC_PAYMENT_PROVIDER` = `stripe` *(or `paystack`, `manual`)*

---

## 🔗 3. Webhook Endpoints to Configure in External Platforms

Configure these in your third-party provider dashboards so they can trigger events in Supabase:

| Platform | Location in Dashboard | Target URL to Enter |
| :--- | :--- | :--- |
| **Mux Video** | [Mux Webhooks](https://dashboard.mux.com/settings/webhooks) | `https://yqvkkgpffskszmmdwqxx.supabase.co/functions/v1/streaming-webhook` |
| **Payment Gateway** | Stripe / Paystack Webhook settings | `https://yqvkkgpffskszmmdwqxx.supabase.co/functions/v1/payment-events` |

---

## 🛠 Useful Local Commands

- Run full test suite & invariant checks: `npm run check`
- Typecheck Admin: `npm run admin:typecheck`
- Typecheck Mobile: `npm run mobile:typecheck`
- Test Admin build locally: `npm run admin:build`
- Test Mobile Web export locally: `npm run mobile:build:web`
