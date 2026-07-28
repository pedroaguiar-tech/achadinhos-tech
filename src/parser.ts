import axios from 'axios';
import * as cheerio from 'cheerio';

export async function processarLinkGenerico(urlOriginal: string, tagAmazon: string) {
  let url = urlOriginal;
  const headersNavegador = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept-Language': 'pt-BR,pt;q=0.9',
  };

  // Resolve redirecionamento de links encurtados (meli.la ou shp.ee)
  try {
    const resRedir = await axios.get(urlOriginal, {
      headers: headersNavegador,
      maxRedirects: 5,
      timeout: 6000,
    });
    if (resRedir.request?.res?.responseUrl) {
      url = resRedir.request.res.responseUrl;
    }
  } catch (e) {
    // Segue com a URL original em caso de falha no redirecionamento
  }

  const urlMinuscula = url.toLowerCase();

  // 1. SHOPEE
  if (urlMinuscula.includes('shopee.com.br') || urlMinuscula.includes('shp.ee')) {
    try {
      const response = await axios.get(url, { headers: headersNavegador, timeout: 10000 });
      const $ = cheerio.load(response.data);

      let titulo = $('meta[property="og:title"]').attr('content') || $('title').text().trim() || 'Produto Shopee';
      titulo = titulo.replace(/\s*\|\s*Shopee Brasil.*/i, '').trim();

      const imagem = $('meta[property="og:image"]').attr('content') || '';
      const precoMeta = $('meta[property="product:price:amount"]').attr('content') || $('meta[property="og:price:amount"]').attr('content');
      
      let preco = 0;
      if (precoMeta) preco = parseFloat(precoMeta);

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

  // 2. MERCADO LIVRE
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

    // A) Consulta Detalhes do Produto de Catálogo (/products/MLB...)
    try {
      const resProd = await axios.get(`https://api.mercadolibre.com/products/${mlbId}`, { timeout: 4000 });
      if (resProd.data) {
        const data = resProd.data;
        const titulo = data.name || tituloFormatado;
        
        // Pega o preço da caixa de compra principal (buy_box_winner)
        let preco = data.buy_box_winner?.price || 0;
        
        // Pega a imagem principal
        let img = '';
        if (data.pictures && data.pictures.length > 0) {
          img = data.pictures[0].url || data.pictures[0].secure_url;
        }

        if (preco > 0 || img) {
          return {
            titulo: titulo,
            precoAtual: preco,
            linkAfiliado: urlOriginal,
            loja: 'Mercado Livre',
            imagem: img
          };
        }
      }
    } catch (e) {}

    // B) Consulta Itens Atrelados ao Catálogo (/products/MLB.../items)
    try {
      const resCat = await axios.get(`https://api.mercadolibre.com/products/${mlbId}/items`, { timeout: 4000 });
      if (resCat.data && resCat.data.results && resCat.data.results.length > 0) {
        const item = resCat.data.results[0];
        const img = item.thumbnail ? item.thumbnail.replace('-I.jpg', '-O.jpg') : '';
        return {
          titulo: item.title || tituloFormatado,
          precoAtual: item.price || 0,
          linkAfiliado: urlOriginal,
          loja: 'Mercado Livre',
          imagem: img
        };
      }
    } catch (e) {}

    // C) Consulta Item Direto (/items/MLB...)
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