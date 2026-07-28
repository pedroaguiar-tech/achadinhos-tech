import axios from 'axios';

export async function processarLinkGenerico(url: string, tagAmazon: string) {
  try {
    // Extrai o ID do item do Mercado Livre (ex: MLB46836439)
    const match = url.match(/MLB-?\d+/i);

    if (match) {
      const mlbId = match[0].replace('-', '').toUpperCase();
      
      // Chamada para a API pública oficial do Mercado Livre (não cai em CAPTCHA)
      const apiUrl = `https://api.mercadolivre.com/items/${mlbId}`;
      const response = await axios.get(apiUrl, { timeout: 10000 });
      const data = response.data;

      const titulo = data.title || 'Produto em Destaque';
      const preco = data.price || 0;
      const imagem = data.thumbnail ? data.thumbnail.replace('-I.jpg', '-O.jpg') : '';

      return {
        titulo: titulo,
        precoAtual: preco,
        linkAfiliado: url,
        loja: 'Mercado Livre',
        imagem: imagem
      };
    }

    // Se for um link de busca/ofertas ou sem ID explícito
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