export interface ResultadoValidacao {
  valido: boolean;
  motivo?: string;
}

export function validarUrlOferta(url: string): ResultadoValidacao {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Dominios aceitos (Brasil e Europa)
    const dominiosPermitidos = [
      'amazon.com',
      'amazon.com.br',
      'amazon.es',
      'amazon.pt',
      'amazon.de',
      'amazon.fr',
      'amazon.it',
      'amazon.co.uk',
      'amzn.eu',
      'amzn.to',
      'shopee.com.br',
      'shopee.pt',
      'shp.ee',
      'mercadolivre.com.br',
      'mercadolibre.com'
    ];

    const eValido = dominiosPermitidos.some(dominio => hostname.includes(dominio));

    if (!eValido) {
      return {
        valido: false,
        motivo: 'Loja não suportada no momento. Envie links da Amazon (BR/EU), Shopee ou Mercado Livre.',
      };
    }

    return { valido: true };
  } catch (error) {
    return {
      valido: false,
      motivo: 'O formato do link enviado é inválido.',
    };
  }
}