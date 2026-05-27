# Data Flow Diagram (DFD) — Flowcharts

Replaced the DFD diagrams with flowcharts (context-level and Level 1 process flow). Render the Mermaid blocks with a Mermaid extension.

## Context Flowchart
```mermaid
flowchart TD
  User["Citizen / User"] -->|Submits forms| System["BarangayWorks System"]
  Admin["Admin / Staff"] -->|Admin actions| System
  System -->|Read/Write| Data["Data Stores"]
  System -->|Send| Email["Email Service"]
  System -->|Log| Logs["Logs"]
```

## Level 1 Flowchart (core processes)
```mermaid
flowchart TD
  subgraph External
    U["Citizen"]
    A["Admin"]
  end

  U -->|Submit form| Validate["Validate"]
  Validate -->|OK| Persist["Persist Submission"]
  Validate -->|Error| Reject["Return Error"]

  Persist --> Notify["Trigger Notifications"]
  Notify --> Email
  Persist --> Log["Create Log Entry"]

  A -->|Login| Auth["Authenticate"]
  A -->|Manage data| Manage["Create/Update Process"]
  Manage -->|Schedule| Schedule["Create Schedule"]
  Manage --> Notify

  Persist --> Data
  Manage --> Data
  Auth --> Data
  Log --> Logs
```

Notes: these flowcharts show process steps and decision points (use alongside `ERD.md` for data modeling).

Created: May 28, 2026
