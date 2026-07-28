import axios from 'axios';
import * as cheerio from 'cheerio';

export async function processarLinkGenerico(url: string, tagAmazon: string) {
  const urlMinuscula = url.toLowerCase();

  const headersNavegador = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept-Language': 'pt-BR,pt;q=0.9',
  };

  // 1. PROCESSAMENTO SHOPEE
  if (urlMinuscula.includes('shopee.com.br') || urlMinuscula.includes('shp.ee')) {
    try {
      const response = await axios.get(url, { headers: headersNavegador, timeout: 10000 });
      const $ = cheerio.load(response.data);

      let titulo = $('meta[property="og:title"]').attr('content') || $('title').text().trim() || 'Produto Shopee';
      titulo = titulo.replace(/\s*\|\s*Shopee Brasil.*/i, '').trim();

      const imagem = $('meta[property="og:image"]').attr('content') || '';
      const precoMeta = $('meta[property="product:price:amount"]').attr('content') || $('meta[property="og:price:amount"]').attr('content');
      
      let preco = 0;
      if (precoMeta) {
        preco = parseFloat(precoMeta);
      }

      return {
        titulo: titulo,
        precoAtual: isNaN(preco) ? 0 : preco,
        linkAfiliado: url,
        loja: 'Shopee',
        imagem: imagem
      };
    } catch (error) {
      console.error('⚠️ Erro ao processar link da Shopee:', error);
      return {
        titulo: 'Oferta Especial na Shopee',
        precoAtual: 0,
        linkAfiliado: url,
        loja: 'Shopee',
        imagem: ''
      };
    }
  }

  // 2. PROCESSAMENTO MERCADO LIVRE
  const matchId = url.match(/MLB-?(\d+)/i);

  // Tenta puxar direto da API oficial do Mercado Livre (evita bloqueio do Render)
  if (matchId) {
    const mlbId = `MLB${matchId[1]}`;
    try {
      const res = await axios.get(`https://api.mercadolibre.com/items/${mlbId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': 'application/json'
        },
        timeout: 6000
      });

      if (res.data && res.data.title) {
        const data = res.data;
        const img = data.pictures && data.pictures.length > 0 
          ? data.pictures[0].secure_url 
          : (data.thumbnail ? data.thumbnail.replace('-I.jpg', '-O.jpg') : '');

        return {
          titulo: data.title,
          precoAtual: data.price || 0,
          linkAfiliado: url,
          loja: 'Mercado Livre',
          imagem: img
        };
      }
    } catch (errApi) {
      console.log(`⚠️ API do Mercado Livre indisponível para ${mlbId}, tentando extração via URL...`);
    }
  }

  // Fallback: extrai o título direto da estrutura do link para nunca vir em branco
  let tituloFormatado = '';
  try {
    const urlPath = new URL(url).pathname;
    const partes = urlPath.split('/').filter(p => p.length > 0);
    if (partes.length > 0 && partes[0] !== 'p') {
      tituloFormatado = partes[0]
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
    }
  } catch (e) {
    tituloFormatado = 'Produto em Destaque';
  }

  return {
    titulo: tituloFormatado || 'Oferta Especial no Mercado Livre',
    precoAtual: 0,
    linkAfiliado: url,
    loja: 'Mercado Livre',
    imagem: ''
  };
}