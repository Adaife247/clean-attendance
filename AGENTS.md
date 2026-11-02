# 🛠️ CampusCheck — AI Development Standards & Project Context

> **AI Instructions:** Read this document completely before writing any code. Adhere strictly to the architectural patterns, styling tokens, and output rules defined below.

---

## 1. Project Identity & Architecture
* **Project Name:** CampusCheck
* **Target Audience:** University students and lecturers (NUC compliance focus).
* **Primary Tech Stack:** Next.js 16 (App Router), Tailwind CSS v4, TypeScript, Supabase (Postgres), Upstash Redis, Sentry.
* **Authentication:** 
  * **Lecturers:** Supabase Auth (Email + Password).
  * **Students:** Custom JWT + WebAuthn (Passkeys) bound to device hardware.
* **Deployment Target:** Vercel.

---

## 2. Code & Output Standards
You must follow these strict engineering constraints for every response:

* **No Truncation / Placeholders:** Never use comments like `// TODO: implement later` or `// ... rest of your code`. Write full, production-ready files. If a file is too long, split it into logical parts and explicitly tell the user how to concatenate them.
* **Component Pattern:** Use functional, modular components. Keep them focused on a single responsibility.
* **Mobile-First Responsive:** Use layout frameworks (Flexbox/Grid) with a mobile-first approach. All interactive elements must have a minimum touch target of 44x44px.
* **TypeScript Rigour:** No implicit `any`. Define clear interfaces or types for all component props and API payloads.
* **UI Consistency:** 
  * **DO NOT** use raw browser `alert()` or `window.confirm()`. Use the custom `<ConfirmModal>` and `useToast()` components located in `components/`.
  * All data fetching from the client side must use the `getStudentHeaders()` or `getLecturerHeaders()` utility from `utils/api-client.ts`.

---

## 3. Design Tokens & Styling
Ensure all UI generation matches these visual specs:

* **Theme / Vibe:** Clean, institutional, modern.
* **Dark Mode:** Mandatory. Every UI component must have explicit `dark:` variants (e.g., `bg-white dark:bg-gray-900`, `text-gray-900 dark:text-white`).
* **Primary Color:** `brand-blue: #2563EB`
* **Backgrounds:** Light (`bg-gray-50`), Dark (`bg-gray-950`).
* **Cards / Surfaces:** Light (`bg-white border-gray-200`), Dark (`dark:bg-gray-900 dark:border-gray-800`).
* **Typography:** Geist Sans (UI body) and Geist Mono (code/number displays).
* **Spacing Scale:** Standardize on 4px/8px multiples (`p-4`, `p-6`, `gap-4`). Border radius should default to `rounded-xl` or `rounded-2xl` for cards, `rounded-3xl` for modals.

---

## 4. Repository Structure & Routing Map
Align your file generation with this directory outline:

```text
├── app/
│   ├── api/                 # Backend route handlers
│   │   ├── verify-attendance/ # The core GPS + Biometric check
│   │   ├── webauthn/        # Passkey generation & verification
│   │   └── onboard/         # Secure email saving
│   ├── dashboard/           # Lecturer views (Live Radar, Courses, Analytics)
│   ├── portal/              # Student views (Dashboard, Feed, Rep Desk)
│   ├── onboard/             # Student account creation wizard
│   ├── login/               # Lecturer login page
│   └── layout.tsx           # Root layout (Sentry + Font setup)
├── components/              # Shared UI Components
│   ├── StudentCheckIn.tsx   # The live check-in UI
│   ├── ConfirmModal.tsx     # Reusable modal
│   ├── Toast.tsx            # Notification toasts
│   └── ThemeToggle.tsx      # Dark/Light mode switcher
├── utils/                   # Utility functions
│   ├── supabase-admin.ts    # Service-role DB client (Server only)
│   ├── supabase.ts          # Anon-key DB client (Client side)
│   ├── student-auth.ts      # JWT generation and verification
│   ├── constants.ts         # Global magic numbers (geofence radius, etc.)
│   └── rate-limit.ts        # Upstash Redis limiter
└── types/                   # Global TypeScript interfaces