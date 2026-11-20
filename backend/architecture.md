# Church Platform Backend Architecture

## Principles

- API first architecture
- Supabase Edge Functions as API layer
- PostgreSQL as source of truth
- Mobile applications consume APIs only
- No business rules hardcoded in clients

## Identity

Users register with:
- mobile number
- email address

Authentication supports both identifiers through Supabase Auth. Profile and organization membership are managed separately.

## Core Services

- Identity Service
- Organization Service
- Membership Service
- Permission Service
- Audit Service
- Notification Service
- Workflow Service
