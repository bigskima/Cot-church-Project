# Church Platform API Layer

Production backend principles:

- API-first architecture
- Supabase Edge Functions for business workflows
- PostgreSQL as source of truth
- Database-driven configuration
- No hardcoded organizations, roles, permissions, or business rules
- Authentication and authorization enforced server-side

Backend domains will be implemented as isolated modules:

- Identity
- Organizations
- Membership
- Roles and permissions
- Church operations
- Communication
- Events
- Finance
- Reporting
- Integrations
