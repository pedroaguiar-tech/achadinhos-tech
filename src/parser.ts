import axios from 'axios';
import * as cheerio from 'cheerio';
import { Oferta } from './formatter';

export async function processarLinkGenerico(url: string, minhaTag: string): Promise<Oferta> {
  const urlLower = url.toLowerCase();

  if (urlLower.includes('amazon') || urlLower.includes('amzn.')) {
    return extrairDadosAmazon(url, minhaTag);
  } else if (urlLower.includes('shopee') || urlLower.includes('shp.ee')) {
    return extrairDadosShopee(url, minhaTag);
  } else if (urlLower.includes('mercadolivre') || urlLower.includes('mercadolibre')) {
    return extrairDadosMercadoLivre(url, minhaTag);
  }

  return {
    titulo: 'Oferta Especial',
    precoPromocional: 99.90,
    linkAfiliado: url,
    loja: 'Geral',
  };
}

// --- AMAZON ---
async function extrairDadosAmazon(url: string, minhaTag: string): Promise<Oferta> {
  const isEuropa = url.includes('amzn.eu') || url.includes('.es') || url.includes('.pt') || url.includes('.de') || url.includes('.uk');
  const separator = url.includes('?') ? '&' : '?';
  const linkAfiliado = `${url}${separator}tag=${minhaTag}`;

  try {
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    const $ = cheerio.load(html);
    const titulo = $('#productTitle').text().trim() || $('meta[property="og:title"]').attr('content') || 'Produto Amazon';
    const imagem = $('#landingImage').attr('src') || $('meta[property="og:image"]').attr('content');

    // Tenta capturar do bloco principal de preço
    let precoText = $('.a-price .a-offscreen').first().text().replace('R$', '').replace('€', '').trim();
    let precoExtraido = precoText ? parseFloat(precoText.replace('.', '').replace(',', '.')) : null;

    return {
      titulo,
      precoPromocional: precoExtraido || (isEuropa ? 24.90 : 199.90),
      precoOriginal: precoExtraido ? precoExtraido * 1.2 : (isEuropa ? 39.90 : 250.00),
      linkAfiliado,
      imagem,
      loja: isEuropa ? 'Amazon Europe' : 'Amazon Brasil',
    };
  } catch (error) {
    return {
      titulo: 'Produto Amazon',
      precoPromocional: isEuropa ? 24.90 : 199.90,
      linkAfiliado,
      loja: isEuropa ? 'Amazon Europe' : 'Amazon Brasil',
    };
  }
}

// --- SHOPEE (Busca Direta via API Interna) ---
async function extrairDadosShopee(url: string, minhaTag: string): Promise<Oferta> {
  const separator = url.includes('?') ? '&' : '?';
  const linkAfiliado = `${url}${separator}tag=${minhaTag}`;

  try {
    // 1. Resolve o link curto (ex: shp.ee/xyz) para pegar a URL completa final
    const responseRedirect = await axios.get(url, {
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });

    const urlFinal = responseRedirect.request.res.responseUrl || url;

    // 2. Tenta extrair shopid e itemid usando Regex
    // Padrão comum da Shopee: -i.SHOPID.ITEMID ou product/SHOPID/ITEMID
    const match = urlFinal.match(/-i\.(\d+)\.(\d+)/) || urlFinal.match(/product\/(\d+)\/(\d+)/);

    if (match && match[1] && match[2]) {
      const shopId = match[1];
      const itemId = match[2];

      // 3. Consulta a API pública de itens da Shopee
      const apiUrl = `https://shopee.com.br/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`;
      const { data: apiResponse } = await axios.get(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'x-shopee-language': 'pt',
        }
      });

      if (apiResponse && apiResponse.data) {
        const item = apiResponse.data;
        const titulo = item.name || 'Produto Shopee';
        // A Shopee retorna preços multiplicados por 100.000 na API (ex: 499000000 = R$ 4990.00)
        const precoAtual = (item.price / 100000) || 49.90;
        const precoAntes = (item.price_before_discount / 100000) || (precoAtual * 1.25);
        const imagem = item.image ? `https://down-br.img.susercontent.com/file/${item.image}` : undefined;

        return {
          titulo,
          precoPromocional: precoAtual,
          precoOriginal: precoAntes > precoAtual ? precoAntes : undefined,
          linkAfiliado,
          imagem,
          loja: 'Shopee',
        };
      }
    }

    // Fallback via HTML caso a API não responda
    const $ = cheerio.load(responseRedirect.data);
    let titulo = $('meta[property="og:title"]').attr('content') || $('title').text().trim();
    let imagem = $('meta[property="og:image"]').attr('content');
    if (titulo.includes(' | Shopee')) titulo = titulo.split(' | Shopee')[0];

    return {
      titulo: titulo || 'Produto Shopee em Oferta',
      precoPromocional: 49.90,
      linkAfiliado,
      imagem,
      loja: 'Shopee',
    };
  } catch (error) {
    console.error('Erro ao processar link Shopee:', error);
    return {
      titulo: 'Produto Shopee em Oferta',
      precoPromocional: 49.90,
      linkAfiliado,
      loja: 'Shopee',
    };
  }
}

// --- MERCADO LIVRE ---
async function extrairDadosMercadoLivre(url: string, minhaTag: string): Promise<Oferta> {
  const separator = url.includes('?') ? '&' : '?';
  const linkAfiliado = `${url}${separator}matt_tool=${minhaTag}`;

  try {
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    const $ = cheerio.load(html);
    const titulo = $('meta[property="og:title"]').attr('content') || $('.ui-pdp-title').text().trim() || 'Produto Mercado Livre';
    const imagem = $('meta[property="og:image"]').attr('content');

    const metaPreco = $('meta[itemprop="price"]').attr('content');
    const precoExtraido = metaPreco ? parseFloat(metaPreco) : null;

    return {
      titulo,
      precoPromocional: precoExtraido || 129.90,
      precoOriginal: precoExtraido ? precoExtraido * 1.2 : 180.0,
      linkAfiliado,
      imagem,
      loja: 'Mercado Livre',
    };
  } catch (error) {
    return {
      titulo: 'Produto Mercado Livre',
      precoPromocional: 129.90,
      precoOriginal: 180.0,
      linkAfiliado,
      loja: 'Mercado Livre',
    };
  }
}