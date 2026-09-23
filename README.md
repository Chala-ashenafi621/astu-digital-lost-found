# ASTU Lost & Found

Build the ASTU Digital Lost & Found System exactly to the approved plan. This is a real full-stack academic system, not a mockup. Enable Lovable Cloud first and implement incrementally, verifying each major stage before proceeding: (1) normalized PostgreSQL schema, authentication, secure ASTU-email-domain server-side registration validation, student/admin roles, database RLS/security policies, protected storage; create first admin securely during setup and ensure students cannot self-assign roles; (2) multiple-image lost/found reporting, public safe browsing/search/filter/detail pages, private user dashboards/profile/my items; (3) claims with written evidence and optional private safe evidence uploads, server-only admin approval/rejection, item status update, in-app notifications; (4) secure email notifications for claim decisions using backend secrets and verified custom domain prerequisites; (5) admin dashboard, management pages, statistics, immutable student-inaccessible audit logs for moderation/claim decisions/status and role changes. Never expose contacts, claims, evidence, secrets, or private data publicly. Validate MIME/file sizes and safe generated paths server-side. Explain major changes/security decisions and do not claim unimplemented functionality works.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://find-reunite-safe.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/50774da9-3bf6-4307-bd0d-5a2d15d74d0c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
