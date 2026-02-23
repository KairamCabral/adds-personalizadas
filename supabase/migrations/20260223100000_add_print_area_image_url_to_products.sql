-- Adiciona campo para imagem da área de personalização do produto
-- Usado no editor DIY como fundo do preview em tempo real

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS print_area_image_url TEXT;

COMMENT ON COLUMN products.print_area_image_url IS
  'URL da imagem da área de personalização (usada como fundo no editor DIY)';
