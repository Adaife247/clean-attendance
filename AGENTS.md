
This is the AI developer rulebook. It has been strictly updated to enforce the new 8px spacing grid, Accessibility (A11y) standards, and the new component architecture.

```markdown
# 🛠️ CampusCheck — AI Development Standards & Project Context

> **AI Instructions:** Read this document completely before writing any code. Adhere strictly to the architectural patterns, styling tokens, and security rules defined below.

---

## 1. Project Identity & Architecture
* **Project Name:** CampusCheck
* **Target Audience:** University students and lecturers (NUC compliance focus).
* **Primary Tech Stack:** Next.js 16 (App Router), Tailwind CSS v4, TypeScript, Supabase (Postgres), Upstash Redis, Sentry.
* **Authentication:** 
  * **Lecturers:** Supabase Auth (Email + Password).
  * **Students:** Custom JWT + WebAuthn (Passkeys) bound to device hardware (Canvas/WebGL fingerprints).
* **Deployment Target:** Vercel.

---

## 2. Code & Output Standards
You must follow these strict engineering constraints for every response:

* **No Truncation / Placeholders:** Never use comments like `// TODO: implement later`. Write full, production-ready files.
* **Component Pattern:** Use functional, modular components. Keep them focused on a single responsibility (e.g., `DashboardTab`, `FeedTab`, `RepDeskTab`).
* **Mobile-First Responsive:** All interactive elements must have a minimum touch target of 44x44px.
* **TypeScript Rigour:** No implicit `any`. Define clear interfaces for all component props and API payloads.
* **UI Consistency:** 
  * **DO NOT** use raw browser `alert()` or `window.confirm()`. Use the custom `<ConfirmModal>` and `useToast()` components.
  * All data fetching from the client side must use `getStudentHeaders()` or `getLecturerHeaders()` from `utils/api-client.ts`.
  * **Accessibility (WCAG 2.2 AA):** 
    * All toasts must use `role="status"` (info/success) or `role="alert"` (error).
    * Modals must trap focus and support `Escape` to close.
    * Never remove focus outlines. Use `focus-visible:ring-2`.

---

## 3. Design Tokens & Styling
Ensure all UI generation matches these visual specs:

* **Theme / Vibe:** Clean, institutional, modern. "Quiet Chrome" (minimal borders, rely on spacing/typography for hierarchy).
* **Spacing Grid:** Use multiples of **8px** (or 4px for tight elements). E.g., `p-2`, `p-4`, `gap-4`, `py-6`. Avoid arbitrary values like `p-5` or `gap-1.5` unless necessary.
* **Dark Mode:** Mandatory. Every component must have explicit `dark:` variants (e.g., `bg-white dark:bg-gray-900`).
* **Primary Color:** `brand-blue: #2563EB`
* **Surfaces:** Light (`bg-white`, `bg-gray-50`), Dark (`bg-gray-900`, `bg-gray-950`).
* **Typography:** Geist Sans (UI body) and Geist Mono (code/number displays). Use `tracking-tight` for large headings.

---

## 4. Repository Structure & Routing Map

```text
├── app/
│   ├── api/                 # Backend route handlers
│   │   ├── verify-attendance/ # Core GPS + Biometric + Anti-Proxy check
│   │   ├── webauthn/        # Passkey generation & verification
│   │   └── lecturer/        # Dashboard data fetching (flags, etc.)
│   ├── dashboard/           # Lecturer views (Live Radar, Courses, Analytics)
│   ├── portal/              # Student views (Dashboard, Feed, Rep Desk)
│   ├── onboard/             # Student account creation wizard
│   ├── login/               # Lecturer login page
├── components/              
│   ├── CommandPalette.tsx   # Global ⌘K search for lecturers
│   ├── ConfirmModal.tsx     # Accessible modal
│   ├── Toast.tsx            # Accessible notifications
│   ├── student-hub/         # Modularized student tabs (Dashboard, Feed, Rep)
│   └── lecturer/            # Modularized lecturer components (FlagReview)
├── utils/                   
│   ├── supabase-admin.ts    # Service-role DB client (Server only)
│   ├── student-auth.ts      # JWT generation and verification
│   ├── flag-reasons.ts      # Central taxonomy for all security flags
│   └── rate-limit.ts        # Upstash Redis limiter
└── types/                   # Global TypeScript interfaces