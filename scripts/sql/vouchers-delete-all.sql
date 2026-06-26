-- Delete ALL gift vouchers (every email). Run ONLY after reviewing the output of
-- vouchers-list-all.sql. Nothing references the vouchers table, so this affects
-- the vouchers table alone — bookings, customers, reviews etc. are untouched.
DELETE FROM public.vouchers;
