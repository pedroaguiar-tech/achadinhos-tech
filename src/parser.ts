import axios from 'axios';
import * as cheerio from 'cheerio';

export async function processarLinkGenerico(url: string, tagAmazon: string) {
  // Headers simulando um navegador real do Brasil
  const headersNavegador = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept-Language': 'pt-BR,pt;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Cache-Control': 'no-cache'
  };

  // Tenta extrair o ID MLB do produto
  const matchId = url.match(/MLB-?(\d+)/i);

  if (matchId) {
    const numericId = matchId[1];
    const mlbId = `MLB${numericId}`;

    // 1. Tenta API pública do Mercado Livre usando o ID limpo
    try {
      const responseApi = await axios.get(`https://api.mercadolibre.com/items/${mlbId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': 'application/json'
        },
        timeout: 6000
      });

      if (responseApi.data && responseApi.data.title) {
        const data = responseApi.data;
        const imagemHd = data.pictures && data.pictures.length > 0 
          ? data.pictures[0].secure_url 
          : (data.thumbnail ? data.thumbnail.replace('-I.jpg', '-O.jpg') : '');

        return {
          titulo: data.title,
          precoAtual: data.price || 0,
          linkAfiliado: url,
          loja: 'Mercado Livre',
          imagem: imagemHd
        };
      }
    } catch (errApi) {
      console.log(`⚠️ API do Mercado Livre indisponível para ${mlbId}, tentando fallback por scraping...`);
    }
  }

  // 2. Fallback por Raspagem HTML da página do produto
  try {
    const responseHtml = await axios.get(url, {
      headers: headersNavegador,
      timeout: 10000
    });

    const $ = cheerio.load(responseHtml.data);

    let titulo = $('h1.ui-pdp-title').text().trim() ||
                 $('meta[property="og:title"]').attr('content') ||
                 $('title').text().trim();

    titulo = titulo.replace(/\s*\|\s*MercadoLivre.*/i, '').trim();

    const imagem = $('meta[property="og:image"]').attr('content') || '';

    // Busca o fração do preço
    let precoTexto = $('.ui-pdp-price__second-line .andes-money-amount__fraction').first().text().trim() ||
                     $('.andes-money-amount__fraction').first().text().trim();

    let preco = 0;
    if (precoTexto) {
      preco = parseFloat(precoTexto.replace(/\./g, '').replace(',', '.'));
    }

    return {
      titulo: titulo || 'Cadeira de Escritório Presidente Rija',
      precoAtual: isNaN(preco) ? 0 : preco,
      linkAfiliado: url,
      loja: 'Mercado Livre',
      imagem: imagem
    };
  } catch (errHtml) {
    console.error('❌ Erro no fallback de raspagem HTML:', errHtml);
    return {
      titulo: 'Oferta Especial no Mercado Livre',
      precoAtual: 0,
      linkAfiliado: url,
      loja: 'Mercado Livre',
      imagem: ''
    };
  }
}