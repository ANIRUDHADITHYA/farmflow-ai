-- Clear all data from tables in reverse dependency order
TRUNCATE TABLE chat_messages CASCADE;
TRUNCATE TABLE chat_sessions CASCADE;
TRUNCATE TABLE treatments CASCADE;
TRUNCATE TABLE ledger_entries CASCADE;
TRUNCATE TABLE reminders CASCADE;
TRUNCATE TABLE invoices CASCADE;
TRUNCATE TABLE inventory CASCADE;
TRUNCATE TABLE animals CASCADE;
TRUNCATE TABLE users CASCADE;
