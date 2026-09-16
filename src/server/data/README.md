# The data seam

`LeadsRepository` lives here (ADR-007, built in [F](../../../PLAN.md)). Nothing
outside this directory may hold Google Sheets API credentials or call the Sheets API directly — every
read/write to `leads` goes through the interface defined here.
