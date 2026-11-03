# CampusCheck

Geofenced campus attendance & verification system built for Nigerian universities. Designed to eliminate proxy attendance, enforce NUC compliance, and provide a seamless, native-like experience without the friction of an app store download.

## 🚀 Core Features

### Security & Anti-Proxy (The Fortress)
*   **Zero Proxy Guarantee:** Prevents students from checking in for absent friends using our "Check-in Trap" (one device cannot check in two students).
*   **WebAuthn Biometrics:** FaceID, TouchID, or PIN. Unphishable and cryptographically bound to the device.
*   **Device Binding:** Persistent hardware fingerprinting ensures one phone = one student. Clearing the cache, using Incognito, or switching browsers does not bypass the lock.
*   **Location Spoofing Detection:** Strict server-side geofencing combined with DeviceMotion cross-checks (detects if a phone is lying flat on a desk while a fake GPS app simulates walking).
*   **Forensic Audit Trail:** Every check-in attempt (success, failure, or blocked) is logged with an explicit reason code for disciplinary review.

### Lecturer Dashboard (Enterprise SaaS Feel)
*   **Live Radar:** Watch students check in in real-time with live velocity charts.
*   **Command Palette (⌘K):** Lightning-fast keyboard navigation across the entire dashboard.
*   **Security Flags:** A grouped, actionable dashboard that separates undeniable proxy attempts from ambiguous technical errors, preventing alert fatigue.
*   **Senate-Ready Exports:** Generate final gradebooks and NUC eligibility reports in one click.

### Student Portal (EdTech & Gamification)
*   **XP & Levels:** Students earn XP and level up (Rookie → Regular → Scholar → Legend) based on attendance streaks.
*   **Offline-First:** Biometrics and GPS are queued locally if the network drops and auto-synced when connection returns.
*   **Context-Aware Errors:** If a student is blocked, they get a clear, human-readable explanation and instructions on how to fix it (e.g., "Move closer to the hall", "Turn on Location").

## 🛠 Tech Stack
- **Framework:** Next.js 16 (App Router, Turbopack)
- **Database:** Supabase (PostgreSQL + RLS)
- **Auth:** WebAuthn (Passkeys) + Custom HS256 JWTs
- **Security:** Hardware Fingerprinting, Play Integrity (planned), Spoof Heuristics
- **Styling:** Tailwind CSS (WCAG 2.2 AA Compliant)
- **Analytics:** Recharts
- **Deployment:** Vercel

## 💻 Development & Deployment

1. Clone the repo and install dependencies:
   ```bash
   npm install