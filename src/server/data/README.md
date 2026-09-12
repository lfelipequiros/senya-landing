# The data seam

`LeadsRepository` lives here (ADR-003, [01.4](../../../backlog/epic-01-foundation/01.4.md)). Nothing
outside this directory may import `@supabase/supabase-js` or write raw SQL — every read/write to
`leads` goes through the interface defined here.
