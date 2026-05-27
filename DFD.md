# Data Flow Diagram (DFD) — BarangayWorksJS

This document provides a context-level (Level 0) and a Level 1 Data Flow Diagram for the BarangayWorksJS application. The diagrams are written in Mermaid so you can preview or export them in VS Code with a Mermaid extension.

## Context-level DFD (Level 0)
Shows external entities, the system as a single process, and major data stores/services.

```mermaid
graph LR
  Citizen["Citizen / User"] -->|Submit form, Request info| System["BarangayWorks System"]
  Admin["Admin / Staff"] -->|Manage data, View dashboard| System
  System -->|Store/Read| DB_Admin[("AdminUser DB")]
  System -->|Store/Read| DB_Processes[("Processes DB")]
  System -->|Send email notifications| MailServer[("Email Service")]
  System -->|Log events| DB_Logs[("Logs DB")]

  classDef external fill:#f9f,stroke:#333,stroke-width:1px;
  class Citizen,Admin external;
``` 

## Level 1 DFD
Decomposes the system into main processes and shows data flows between processes and data stores.

```mermaid
graph LR
  %% Processes
  P1((Authenticate
  User))
  P2((Manage
  Processes))
  P3((Scheduling))
  P4((Form
  Submission))
  P5((Email
  Notification))
  P6((Logging))

  %% External
  Citizen["Citizen / User"]
  Admin["Admin / Staff"]

  %% Data stores
  DB_Admin[("AdminUser DB")]
  DB_Process[("Processes DB")]
  DB_Schedule[("Schedule DB")]
  DB_Forms[("Form Submissions DB")]
  DB_Logs[("Logs DB")]
  MailSrv[("Email Service / Queue")]

  %% Flows: external -> processes
  Citizen -->|Submit form data| P4
  Citizen -->|Request info| P2
  Admin -->|Login / Admin actions| P1
  Admin -->|Manage processes| P2

  %% Processes -> Data stores
  P1 -->|Validate user| DB_Admin
  P2 -->|Create/Update processes| DB_Process
  P2 -->|Read processes| DB_Process
  P3 -->|Create schedules| DB_Schedule
  P3 -->|Read schedules| DB_Schedule
  P4 -->|Persist submission| DB_Forms
  P4 -->|Trigger process| P2
  P4 -->|Log submission| P6
  P5 -->|Queue email| MailSrv
  P5 -->|Log email send| P6
  P6 -->|Write logs| DB_Logs

  %% Inter-process flows
  P2 -->|Notify| P5
  P3 -->|Notify participants| P5
  P2 -->|Read admin info| P1

  %% Admin / Citizen read flows
  Admin -->|View logs| P6
  Admin -->|View forms/processes| P2

  %% Mail service external
  MailSrv -->|Deliver email| MailSrv

``` 

## How to use
- Open `DFD.md` in VS Code and use a Mermaid preview extension to render diagrams.
- Use the Level 1 diagram as a guide when implementing controllers and data flows.

Created: May 27, 2026
