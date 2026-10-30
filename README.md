# CampusCheck

Geofenced campus attendance & verification system.

## Tech Stack
- **Framework:** Next.js 16 (App Router, Turbopack)
- **Database:** Supabase (PostgreSQL + RLS)
- **Auth:** WebAuthn (Passkeys) + JWTs
- **Rate Limiting:** Upstash Redis
- **Error Tracking:** Sentry
- **Styling:** Tailwind CSS

## Development & Deployment

This project is configured to deploy directly to Vercel. 

1. Clone the repo and install dependencies:
   ```bash
   npm install