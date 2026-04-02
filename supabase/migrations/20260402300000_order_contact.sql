-- Add contact person fields to orders table
-- contact_name: name of the specific person the team is chatting with
-- contact_phone: their WhatsApp/phone number

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS contact_name  TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT;
