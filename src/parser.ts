import axios from 'axios';
import * as cheerio from 'cheerio';

export async function processarLinkGenerico(urlOriginal: string, tagAmazon: string) {
  let url = urlOriginal;
  const headersNavegador = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept-Language': 'pt-BR,pt;q=0.9',
  };

  try {
    const resRedir = await axios.get(urlOriginal, { headers: headersNavegador, maxRedirects: 5, timeout: 5000 });
    if (resRedir.request?.res?.responseUrl) {
      url = resRedir.request.res.responseUrl;
    }
  } catch (e) {}

  // SHOPEE
  if (url.toLowerCase().includes('shopee.com.br') || url.toLowerCase().includes('shp.ee')) {
    try {
      const response = await axios.get(url, { headers: headersNavegador, timeout: 8000 });
      const $ = cheerio.load(response.data);

      let titulo = $('meta[property="og:title"]').attr('content') || $('title').text().trim() || 'Produto Shopee';
      titulo = titulo.replace(/\s*\|\s*Shopee Brasil.*/i, '').trim();

      const imagem = $('meta[property="og:image"]').attr('content') || '';
      const precoMeta = $('meta[property="product:price:amount"]').attr('content') || $('meta[property="og:price:amount"]').attr('content');
      let preco = precoMeta ? parseFloat(precoMeta) : 0;

      return {
        titulo: titulo,
        precoAtual: isNaN(preco) ? 0 : preco,
        linkAfiliado: urlOriginal,
        loja: 'Shopee',
        imagem: imagem
      };
    } catch (error) {
      return { titulo: 'Oferta Especial na Shopee', precoAtual: 0, linkAfiliado: urlOriginal, loja: 'Shopee', imagem: '' };
    }
  }

  // MERCADO LIVRE
  const matchId = url.match(/MLB-?(\d+)/i);
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

  if (matchId) {
    const mlbId = `MLB${matchId[1]}`;

    try {
      const resItem = await axios.get(`https://api.mercadolibre.com/items/${mlbId}`, { timeout: 4000 });
      if (resItem.data && resItem.data.title) {
        const data = resItem.data;
        const img = data.pictures && data.pictures.length > 0 
          ? data.pictures[0].secure_url 
          : (data.thumbnail ? data.thumbnail.replace('-I.jpg', '-O.jpg') : '');

        return {
          titulo: data.title,
          precoAtual: data.price || 0,
          linkAfiliado: urlOriginal,
          loja: 'Mercado Livre',
          imagem: img
        };
      }
    } catch (e) {}
  }

  return {
    titulo: tituloFormatado || 'Oferta Especial no Mercado Livre',
    precoAtual: 0,
    linkAfiliado: urlOriginal,
    loja: 'Mercado Livre',
    imagem: ''
  };
}