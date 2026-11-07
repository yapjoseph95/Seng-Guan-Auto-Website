# Vehicle management implementation

Approved scope: admin login, vehicle create/edit/delete, multiple photos with cover and order, draft/available/sold state, homepage featured flag. Keep production design and old-site backups.

Architecture: existing React/Vite website and Cloudflare Pages Functions under /api. D1 vehicles and photos tables; private R2 objects delivered through a public published-photo endpoint. A custom /admin login uses Supabase Auth email OTP via Resend. The server validates Supabase sessions and the administrator email allowlist. Mutations require same-origin requests. No credentials in source. Public API exposes published vehicles only.

Steps:
1. Create schema and API with validation, authorization, photo constraints and deletion safety.
2. Build bilingual-friendly responsive admin dashboard/editor with upload compression, photo ordering, publication states, errors and confirmations.
3. Connect front-end vehicle catalog and homepage to public data, retaining existing vehicles until initial migration is ready.
4. Provision D1/R2, import the existing public selection, bind resources and restrict admin access to the owner-confirmed email.
5. Check auth denial, CRUD, photo access, drafts visibility, uploads and build. Deploy and verify website/admin; provide login URL and operational notes.

Open dependency: owner-authorized administrator email.
