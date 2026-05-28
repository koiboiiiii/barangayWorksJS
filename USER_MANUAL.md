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

**Barangay Worker (Admin) Guide**

- **Who this is for**: Barangay officials and staff who operate the dashboard to process forms, manage schedules, and respond to citizen requests. System Administrators create and assign login accounts to Barangay officials.

- **Login**: Open `adminlogin.html` and enter the credentials provided by your System Administrator. On first login change the temporary password immediately.

- **Dashboard** (`admindashboard.html`): your control panel.
  - **Create / Manage Process**: Use the dashboard to create processes (title, description, owner) and update status. Records are saved in `processesdb`.
  - **Schedules**: Add or modify schedules (time, recurrence, location). Schedules are stored in `scheduledb`.
  - **Forms**: Review submitted forms, update their status, add notes, and assign them to a process or staff member.
  - **Users & Hierarchy**: View the list of Barangay officials and the reporting hierarchy. Only System Administrators can create or delete admin accounts; request account changes through them.
  - **Permissions**: Check your access via `permissions.html`. Permission changes must be performed by a System Administrator.
  - **Logs**: Use `logs.html` to audit actions (who performed what and when).

- **Email Notifications**
  - The system sends emails for confirmations and notifications. SMTP settings are managed by the System Administrator in `controller/mailer.js`.

- **Recommended Practices for Barangay Workers**
  - Immediately change any temporary passwords and use strong passwords.
  - Report lost credentials to the System Administrator — they will revoke and reissue access.
  - Follow barangay data handling policies when exporting or sharing data.

**System Administrator — Account Assignment**

- **Role**: System Administrators are responsible for provisioning admin accounts, assigning roles to Barangay officials, and configuring system-level settings (email, backups).

- **Typical account assignment steps**:
  1. Create a new admin user via the admin UI or backend module (`adminusersquery`).
  2. Assign a role (`official`, `clerk`, `supervisor`) and a temporary password.
  3. Place the user within the reporting hierarchy using `adminhierarchydb`.
  4. Inform the official securely (do not send passwords via insecure email) and require a password change at first login.

- **Security & operations notes for SysAdmins**
  - Store credentials securely and rotate temporary passwords after issuance.
  
**System Administrator Onboarding Checklist**

- Prepare environment
  - Install Node.js on the server (recommended LTS). Ensure the server has firewall and HTTPS (TLS) configured.
  - Create a secure storage location for secrets (environment variables, .env file outside webroot, or a secrets manager).

- Initial system configuration
  - Configure SMTP credentials in `controller/mailer.js` or via environment variables and test sending a confirmation email.
  - Configure log rotation and ensure `logs` are written to a persistent location.

- Accounts & roles
  - Create initial admin accounts for key officials using `adminusersquery`.
  - Assign roles and reporting hierarchy (`adminhierarchydb`).
  - Generate temporary passwords and securely deliver them to recipients; require password change at first login.

- Data & backup
  - Take an initial backup/export of existing JS data modules.
  - Schedule regular backups and document restore steps.

- Validation & testing
  - Verify admin login and role-based access on `admindashboard.html`.
  - Submit a test form via `form.html` and confirm persistence, logging, and notification flows.
  - Verify that email notifications are delivered and logged.

- Documentation & handoff
  - Document contact points for system support and emergency access procedures.
  - Provide a short walkthrough to Barangay officials: how to login, change password, and report issues.


---

**Citizen Guide (your steps)**

- **Who you are**: a resident or visitor submitting requests, complaints, or applications to the barangay.

- **Open the form**: Use the link provided by the barangay or open `form.html` from the site.

- **How to submit**:
  1. Complete all required fields on the form. Be accurate with contact details so staff can follow up.
  2. Review your entries, then click Submit.
  3. After a successful submission you will see a confirmation page (`success.html`) and may receive an email confirmation if you provided an email address. Save any reference number shown.

- **What happens next**:
  - Barangay workers review your submission and may change its status (e.g., Received, In Progress, Completed).
  - If action is required, an assigned official will handle it and you may be notified by email.

- **If you have problems**:
  - If required fields are missing the form will indicate them — fill all required fields and resubmit.
  - If you see a server error, try again later and contact the barangay office with the error details and time.

- **Privacy & tips**:
  - Do not share passwords or personal login details.
  - If you need status updates and there is no online tracking, contact the barangay office and provide your reference number.

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
