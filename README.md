# M.O.R. Clean Mini‑App

A simple, branded web app for cleaners and customers. Built with **React + Vite + Tailwind**.

## What you can do
- Cleaner Portal: clock in/out, view jobs, check off tasks, attach photos (placeholder)
- Customer Portal: quick booking request form

---

## Easiest way to deploy (Vercel)

1) Create a free GitHub account (if you don't have one): https://github.com
2) Upload this folder to a new GitHub repo (e.g., `mor-clean-miniapp`).
3) Go to https://vercel.com — sign in with GitHub, click **Add New Project** → **Import** your repo.
4) Accept defaults. Build command: `npm run build` • Output: `dist/` (Vercel detects this automatically).
5) Click **Deploy**. You’ll get a URL like `https://mor-clean-miniapp.vercel.app`.

## Alternate: Netlify (from Git)

1) Create a free GitHub repo with this folder.
2) Go to https://app.netlify.com → **Add new site** → **Import an existing project**.
3) Select the repo. Set **Build command** to `npm run build` and **Publish directory** to `dist`.
4) Click **Deploy site**.

## Run on your computer (for testing)

1) Install Node.js LTS from https://nodejs.org/
2) Open a terminal in this folder and run:
   ```bash
   npm install
   npm run dev
   ```
3) Open the local link it prints (usually http://localhost:5173).

## Notes
- This does not include auth/logins or a database yet.
- Local data is saved in `localStorage` for demo purposes.
- To make it a full PWA (offline + install banner), we can add a manifest and service worker next.
