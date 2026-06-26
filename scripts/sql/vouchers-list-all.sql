-- Locate ALL gift vouchers (every email). Run this FIRST in the Supabase
-- dashboard -> SQL Editor to see exactly what's in scope before deleting.
-- Read-only; touches the vouchers table only.
SELECT * FROM public.vouchers ORDER BY created_at DESC;
