# Entity Relationship Diagram (ERD) — Simplified

This file contains a compact ER diagram for the core entities used by BarangayWorksJS plus a short legend. Render the Mermaid block in VS Code (Mermaid preview) to view.

**Legend**
- PK = Primary Key
- FK = Foreign Key
- 1 = one, * = many

**Simplified ER Diagram**
```mermaid
erDiagram
    ADMINUSER {
        int id PK
        string name
        string email
    }

    PROCESS {
        int id PK
        string title
        int owner_id FK
    }

    FORMSUBMISSION {
        int id PK
        int process_id FK
        int submitted_by FK
        string status
    }

    SCHEDULE {
        int id PK
        int process_id FK
        datetime scheduled_at
    }

    LOG {
        int id PK
        int user_id FK
        string action
    }

    EMAILNOTIFICATION {
        int id PK
        int related_process_id FK
        string status
    }

    %% Relationships with cardinality
    ADMINUSER ||--o{ PROCESS : "creates (1..*)"
    PROCESS ||--o{ FORMSUBMISSION : "receives (1..*)"
    PROCESS ||--o{ SCHEDULE : "has (1..*)"
    ADMINUSER ||--o{ LOG : "performs (1..*)"
    PROCESS ||--o{ EMAILNOTIFICATION : "triggers (0..*)"
    FORMSUBMISSION }o--|| ADMINUSER : "submitted_by (1)"
```

Notes:
- The diagram focuses on primary flows: users create processes; processes have schedules and form submissions; actions are logged; emails are triggered by processes.
- Keep `controller/` module field names aligned with these entities when implementing or migrating to an RDBMS.

Created: May 27, 2026
