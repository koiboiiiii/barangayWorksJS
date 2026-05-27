# Data Flow Diagram (DFD) — BarangayWorksJS

Quick, simplified DFDs for documentation and implementation guidance. Render the Mermaid blocks with a Mermaid extension.

## Context (Level 0)
```mermaid
graph LR
  Citizen["Citizen / User"] --> System["BarangayWorks System"]
  Admin["Admin / Staff"] --> System
  System --> DB[("Data Stores")]
  System --> Mail[("Email Service")]
  System --> Logs[("Logs")]
```

## Level 1 (core processes)
```mermaid
graph LR
  Citizen -->|Submit form| Submit["Submit Form"]
  Admin -->|Manage| Manage["Manage Data"]
  Admin -->|Auth| Auth["Authenticate"]

  Submit --> DB["Store: Forms / Processes"]
  Manage --> DB
  Auth --> DB

  Manage -->|Notify| Mail["Email Service"]
  Submit -->|Create log| Logs["Logs"]
```

Notes: data stores are grouped for brevity — map to `controller/` modules when implementing.

Created: May 27, 2026
