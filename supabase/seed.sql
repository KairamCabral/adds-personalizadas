-- ============================================
-- ADDS CRM — Seed Data
-- ============================================
-- O usuário MASTER é criado automaticamente pelo trigger on_auth_user_created
-- quando você cria o primeiro usuário no Supabase Auth.
--
-- Para criar o usuário MASTER:
-- 1. Vá no Supabase Dashboard → Authentication → Users
-- 2. Crie um usuário com e-mail: contato@adds.com.br
-- 3. O trigger criará o profile automaticamente
-- 4. Execute o UPDATE abaixo para promover a MASTER:

-- UPDATE profiles
-- SET role = 'MASTER', full_name = 'Admin ADDS'
-- WHERE email = 'contato@adds.com.br';

-- ============================================
-- Produtos iniciais
-- ============================================

INSERT INTO products (name, description, category, product_type, price, stock, is_active) VALUES
  ('ADDS Ultra', 'Escova dental personalizada ADDS Ultra', 'Escova Dental', 'personalizado', 12.90, 500, true),
  ('ADDS Implant', 'Escova dental para implantes ADDS Implant', 'Escova Dental', 'personalizado', 14.90, 300, true),
  ('Escova de Prótese', 'Escova especial para prótese dentária', 'Escova Dental', 'personalizado', 15.90, 200, true),
  ('Raspador de Língua', 'Raspador de língua ADDS', 'Acessório', 'personalizado', 8.90, 400, true),
  ('Irrigador Oral', 'Irrigador oral portátil ADDS', 'Irrigador', 'standard', 189.90, 100, true);
