/**
 * Combina nome de produto + cor em um label único para exibição/integrações
 * (ex.: Bling, Tiny). Uso esperado: `formatProductWithColor({ product_name, color_name })`
 * → "ADDS Implant – Lilás" quando há cor; só "ADDS Implant" quando não há.
 *
 * Mantemos `product_name` no banco sem cor concatenada (cor mora em `color`/`color_name`).
 * Esta função é o ponto único onde a junção acontece.
 */
export function formatProductWithColor(item: {
  product_name: string;
  color_name?: string | null;
}): string {
  const colorName = item.color_name?.trim();
  if (!colorName) return item.product_name;
  return `${item.product_name} – ${colorName}`;
}
