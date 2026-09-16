# The data seam

`LeadsRepository` lives here (ADR-003, built in [F](../../../PLAN.md)). Nothing
outside this directory may import `@supabase/supabase-js` or write raw SQL — every read/write to
`leads` goes through the interface defined here.
