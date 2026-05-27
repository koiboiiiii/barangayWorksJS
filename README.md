# BarangayWorksJS

A lightweight web-based administration system for barangay operations. This repository contains the frontend static pages and a minimal Node.js backend for handling administrative processes, scheduling, user management, logs, and email notifications.

## Key Features
- Admin authentication and dashboard (static HTML/CSS pages)
- Admin user management and hierarchy (see `controller/adminusersquery`)
- Forms and record submission pages (`form.html`, `update.html`, `success.html`)
- Scheduling and calendar utilities (`schedule.html`)
- Permission management (`permissions.html`)
- Activity logs viewer (`logs.html`)
- Email notifications via `controller/mailer.js`
- Lightweight controllers and databases in `controller/`

## Project Structure (high level)
- `*.html`, `*.css` - frontend pages and styles
- `main.js` - shared frontend script
- `assets/` - images and static assets
- `controller/` - Node.js controllers and lightweight DB modules
  - `controller.js` - main backend entrypoint
  - `mailer.js` - email sending utilities
  - `adminusersquery`, `adminhierarchydb`, `processesdb`, `scheduledb` - data modules

## Running Locally
1. Ensure Node.js is installed (recommended: Node 16+).
2. Start the backend server (from project root):

```bash
node -e "require('./controller/controller').startServer()"
```

3. Open the frontend by opening `index.html` (or use a static file server/live-server for convenience).

Tip: The workspace includes a VS Code task `Start Backend Server` that runs the command above.

## Configuration
- Email settings and templates are in `controller/mailer.js` — update SMTP details there.
- Data modules are simple JS-based modules under `controller/`; back up files before editing.

## Development Notes
- This project uses static frontend files and a minimal Node.js backend. It is intended for small deployments or as a prototype.
- When modifying backend APIs, keep controller route names consistent with frontend JS expectations.

## Contact
For questions or to contribute, open an issue or contact the repository owner.

---
Created: May 27, 2026
