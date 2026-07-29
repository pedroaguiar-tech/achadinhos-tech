import axios from 'axios';

export async function processarLinkGenerico(urlOriginal: string, tagAmazon: string) {
  let url = urlOriginal;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  };

  // Trata Shopee
  if (url.toLowerCase().includes('shopee.com.br') || url.toLowerCase().includes('shp.ee')) {
    return {
      titulo: 'Oferta Especial na Shopee',
      precoAtual: 0,
      linkAfiliado: urlOriginal,
      loja: 'Shopee'
    };
  }

  // Extrai nome limpo direto da URL
  let tituloFormatado = '';
  try {
    const urlPath = new URL(url).pathname;
    const partes = urlPath.split('/').filter(p => p.length > 0);
    if (partes.length > 0 && partes[0] !== 'p') {
      tituloFormatado = partes[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  } catch (e) {
    tituloFormatado = 'Produto em Destaque';
  }

  const matchId = url.match(/MLB-?(\d+)/i);

  if (matchId) {
    const mlbId = `MLB${matchId[1]}`;

    // Busca preço na API oficial do ML sem tomar bloqueio
    try {
      const resItem = await axios.get(`https://api.mercadolibre.com/items/${mlbId}`, { headers, timeout: 5000 });
      if (resItem.data && resItem.data.title) {
        return {
          titulo: resItem.data.title,
          precoAtual: resItem.data.price || 0,
          linkAfiliado: urlOriginal,
          loja: 'Mercado Livre'
        };
      }
    } catch (e) {}

    try {
      const resCat = await axios.get(`https://api.mercadolibre.com/products/${mlbId}`, { headers, timeout: 5000 });
      if (resCat.data) {
        return {
          titulo: resCat.data.name || tituloFormatado,
          precoAtual: resCat.data.buy_box_winner?.price || 0,
          linkAfiliado: urlOriginal,
          loja: 'Mercado Livre'
        };
      }
    } catch (e) {}
  }

  return {
    titulo: tituloFormatado || 'Oferta Especial no Mercado Livre',
    precoAtual: 0,
    linkAfiliado: urlOriginal,
    loja: 'Mercado Livre'
  };
}