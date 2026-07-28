import axios from 'axios';

export async function processarLinkGenerico(url: string, tagAmazon: string) {
  try {
    // Extrai o ID numérico do produto no Mercado Livre (ex: MLB58503383)
    const match = url.match(/MLB-?\d+/i);

    if (match) {
      const mlbId = match[0].replace('-', '').toUpperCase();
      
      // Endereço oficial da API com 'b': api.mercadolibre.com
      const apiUrl = `https://api.mercadolibre.com/items/${mlbId}`;
      const response = await axios.get(apiUrl, { timeout: 10000 });
      const data = response.data;

      const titulo = data.title || 'Produto em Destaque';
      const preco = data.price || 0;
      
      // Pega a imagem principal em alta resolução
      const imagem = data.pictures && data.pictures.length > 0 
        ? data.pictures[0].secure_url 
        : (data.thumbnail ? data.thumbnail.replace('-I.jpg', '-O.jpg') : '');

      return {
        titulo: titulo,
        precoAtual: preco,
        linkAfiliado: url,
        loja: 'Mercado Livre',
        imagem: imagem
      };
    }

    return {
      titulo: 'Oferta Especial no Mercado Livre',
      precoAtual: 0,
      linkAfiliado: url,
      loja: 'Mercado Livre',
      imagem: ''
    };
  } catch (error) {
    console.error('⚠️ Erro ao consultar API pública do Mercado Livre:', error);
    return {
      titulo: 'Confira esta promoção no Mercado Livre',
      precoAtual: 0,
      linkAfiliado: url,
      loja: 'Mercado Livre',
      imagem: ''
    };
  }
}