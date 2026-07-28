export function validarUrlOferta(url: string): { valido: boolean; motivo?: string } {
  if (!url) {
    return { valido: false, motivo: 'URL vazia.' };
  }

  const urlMinuscula = url.toLowerCase();

  const dominiosValidos = [
    'mercadolivre.com.br',
    'mercadolibre.com',
    'meli.la',
    'shopee.com.br',
    'shp.ee'
  ];

  const ehValido = dominiosValidos.some((dominio) => urlMinuscula.includes(dominio));

  if (!ehValido) {
    return {
      valido: false,
      motivo: 'Loja não suportada. Envie links do Mercado Livre ou da Shopee.',
    };
  }

  return { valido: true };
}