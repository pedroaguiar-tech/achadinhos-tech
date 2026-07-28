import axios from 'axios';
import * as cheerio from 'cheerio';

export async function processarLinkGenerico(url: string, tagAmazon: string) {
  // Headers simulando um navegador real no Windows (evita erro 403 Forbidden)
  const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept': 'application/json, text/plain, */*',
  };

  const match = url.match(/MLB-?\d+/i);

  // 1. TENTATIVA VIA API OFICIAL DO MERCADO LIVRE
  if (match) {
    const mlbId = match[0].replace('-', '').toUpperCase();
    const apiUrl = `https://api.mercadolibre.com/items/${mlbId}`;

    try {
      const response = await axios.get(apiUrl, {
        headers: browserHeaders,
        timeout: 8000,
      });

      const data = response.data;
      const titulo = data.title || 'Produto em Destaque';
      const preco = data.price || 0;
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
    } catch (apiError) {
      console.log('⚠️ API ML respondeu com bloqueio/erro, alterando para Scraping HTML...');
    }
  }

  // 2. FALLBACK VIA RASPAGEM DIRETA DO LINK (Caso a API falhe)
  try {
    const response = await axios.get(url, {
      headers: browserHeaders,
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);

    let titulo = $('h1.ui-pdp-title').text().trim() ||
                 $('meta[property="og:title"]').attr('content') ||
                 'Produto em Destaque no Mercado Livre';

    // Limpa o título do sufixo | MercadoLivre
    titulo = titulo.replace(/\s*\|\s*MercadoLivre.*/i, '').trim();

    const imagem = $('meta[property="og:image"]').attr('content') || '';

    const precoTexto = $('.ui-pdp-price__second-line .andes-money-amount__fraction').first().text().trim() ||
                     $('.andes-money-amount__fraction').first().text().trim();

    let preco = 0;
    if (precoTexto) {
      preco = parseFloat(precoTexto.replace(/\./g, '').replace(',', '.'));
    }

    return {
      titulo: titulo,
      precoAtual: isNaN(preco) ? 0 : preco,
      linkAfiliado: url,
      loja: 'Mercado Livre',
      imagem: imagem
    };
  } catch (htmlError) {
    console.error('❌ Erro final ao processar link do Mercado Livre:', htmlError);
    return {
      titulo: 'Produto em Oferta no Mercado Livre',
      precoAtual: 0,
      linkAfiliado: url,
      loja: 'Mercado Livre',
      imagem: ''
    };
  }
}