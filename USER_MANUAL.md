# User Manual — BarangayWorksJS

This manual describes how Admin Users and Citizen Users interact with the BarangayWorksJS system, how to run the project locally, and common troubleshooting steps.

---

**Quick Start**
- Install Node.js (recommended v16+).
- From the project root, start the backend:

```bash
node -e "require('./controller/controller').startServer()"
```

- Open the frontend pages in a browser (e.g., `index.html`, `adminlogin.html`, `form.html`). For best API compatibility, serve files using a static server or VS Code Live Server.

---

**Admin User Guide**

- **Login**: open `adminlogin.html`, enter admin credentials. Backend validates against admin store in `controller/` modules.

- **Dashboard** (`admindashboard.html`): central hub to view dashboards, processes, schedules, users, and logs.
  - **Create / Manage Process**: Use dashboard controls to create processes (title, description, owner). Processes are stored in `processesdb`.
  - **Schedules**: Create schedules for a process (date/time, recurrence, location). Schedules are stored in `scheduledb`.
  - **Forms**: View incoming form submissions, change status, and assign to processes.
  - **Users & Hierarchy**: Add/edit admin users and define reporting relationships (use `adminusersquery` and `adminhierarchydb`).
  - **Permissions**: Grant/revoke resource access via the permissions UI (`permissions.html`).
  - **Logs**: View audit logs in `logs.html` to trace actions (view, create, update, delete).

- **Email Notifications**
  - Config: update SMTP settings in `controller/mailer.js`.
  - Behavior: processes and schedules may trigger email notifications; logs record email send attempts.

- **Recommended Admin Practices**
  - Use strong passwords and limit admin accounts. Ensure backend runs under HTTPS in production.
  - Regularly export/backup data from the `controller/` modules before making structural changes.

---

**Citizen User Guide**

- **Accessing Forms**: Open `form.html` (or links provided by the barangay site). Forms collect process-specific data.

- **Submitting a Form**
  1. Fill required fields and submit. The frontend sends the data to the backend persistence process.
  2. On success the frontend shows `success.html` (or a success message). The backend persists the submission to the forms store and logs the event.
  3. If configured, the system triggers email or other notifications to the responsible admin.

- **Checking Status**: Citizens typically receive status updates via email or through an admin-facing portal; there is no dedicated citizen dashboard in this prototype.

---

**Developer / Run Instructions**

- Start backend (project root):

```bash
node -e "require('./controller/controller').startServer()"
```

- VS Code Task: use the workspace task `Start Backend Server` to run the same command.
- Configuration files and modules are under `controller/`:
  - `controller.js` — backend entrypoint and server setup
  - `mailer.js` — SMTP config and email helpers
  - `adminusersquery`, `adminhierarchydb`, `processesdb`, `scheduledb` — lightweight data modules

---

**Configuration & Deployment Notes**
- **Email**: edit SMTP host / port / auth in `controller/mailer.js`. Use environment variables in production.
- **Database**: current modules are lightweight JS-based; for production migrate to a relational DB (SQLite/Postgres) and map `data`/`meta` fields to JSON columns when available.
- **HTTPS**: use TLS in production and configure reverse proxy (NGINX, Caddy) to serve static frontend and proxy API calls.

---

**Troubleshooting**
- Backend doesn't start: ensure Node.js is installed and run the start command from the project root. Check console logs for stack traces.
- Emails not sending: verify SMTP config in `controller/mailer.js` and check network/firewall settings.
- Forms failing to save: inspect console and backend logs; validate JSON payloads and required fields.

---

**Security Checklist**
- Hash and salt passwords (bcrypt) before storing. Do not store plaintext passwords.
- Validate and sanitize all user inputs on server-side.
- Limit admin UI access and use role-based checks in backend controllers.
- Rotate SMTP and sensitive credentials; store in environment variables or a secrets manager.

---

**FAQ**
- Q: Can Citizens edit submissions after sending? A: Not in this prototype — edits must be handled by admins.
- Q: How to back up data? A: Export JS data modules or migrate to an RDBMS and use native backup tools.

---

If you'd like, I can: add step-by-step screenshots, convert the manual into `README.md`, or generate a short onboarding checklist for new admins.
