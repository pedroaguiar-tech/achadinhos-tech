import axios from 'axios';
import * as cheerio from 'cheerio';
import { Oferta } from './formatter';

// Aceita URL e parâmetros opcionais de preço digitados manualmente
export async function processarLinkGenerico(
  texto: string,
  minhaTag: string
): Promise<Oferta> {
  const partes = texto.trim().split(/\s+/);
  const url = partes[0];
  const precoPromoManual = partes[1] ? parseFloat(partes[1].replace(',', '.')) : undefined;
  const precoOrigManual = partes[2] ? parseFloat(partes[2].replace(',', '.')) : undefined;

  const urlLower = url.toLowerCase();
  let oferta: Oferta;

  if (urlLower.includes('amazon') || urlLower.includes('amzn.')) {
    oferta = await extrairDadosAmazon(url, minhaTag);
  } else if (urlLower.includes('shopee') || urlLower.includes('shp.ee')) {
    oferta = await extrairDadosShopee(url, minhaTag);
  } else if (urlLower.includes('mercadolivre') || urlLower.includes('mercadolibre')) {
    oferta = await extrairDadosMercadoLivre(url, minhaTag);
  } else {
    oferta = {
      titulo: 'Oferta Especial',
      precoPromocional: 99.90,
      linkAfiliado: url,
      loja: 'Geral',
    };
  }

  // Se você passou preço na mensagem do Telegram, sobrepõe o preço raspado!
  if (precoPromoManual && !isNaN(precoPromoManual)) {
    oferta.precoPromocional = precoPromoManual;
  }
  if (precoOrigManual && !isNaN(precoOrigManual)) {
    oferta.precoOriginal = precoOrigManual;
  }

  return oferta;
}

async function extrairDadosAmazon(url: string, minhaTag: string): Promise<Oferta> {
  const isEuropa =
    url.includes('amzn.eu') ||
    url.includes('.es') ||
    url.includes('.pt') ||
    url.includes('.de') ||
    url.includes('.uk');

  const separator = url.includes('?') ? '&' : '?';
  const linkAfiliado = `${url}${separator}tag=${minhaTag}`;

  try {
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      },
    });

    const $ = cheerio.load(html);
    let titulo =
      $('#productTitle').text().trim() ||
      $('meta[property="og:title"]').attr('content') ||
      'Produto Amazon';
    const imagem =
      $('#landingImage').attr('src') ||
      $('#imgBlkFront').attr('src') ||
      $('meta[property="og:image"]').attr('content');

    // Tenta extrair preço das tags
    const precoText = $('.a-price .a-offscreen').first().text().replace('R$', '').replace('€', '').trim();
    const precoExtraido = precoText ? parseFloat(precoText.replace('.', '').replace(',', '.')) : null;

    return {
      titulo,
      precoPromocional: precoExtraido || (isEuropa ? 24.90 : 199.90),
      precoOriginal: isEuropa ? 39.90 : 299.90,
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

async function extrairDadosShopee(url: string, minhaTag: string): Promise<Oferta> {
  const separator = url.includes('?') ? '&' : '?';
  const linkAfiliado = `${url}${separator}tag=${minhaTag}`;

  try {
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      },
    });

    const $ = cheerio.load(html);

    let titulo = $('meta[property="og:title"]').attr('content') || $('title').text().trim();
    let imagem = $('meta[property="og:image"]').attr('content');

    if (titulo.includes(' | Shopee')) {
      titulo = titulo.split(' | Shopee')[0];
    }

    // Tenta extrair das meta tags de preço da Shopee caso existam
    const metaPreco = $('meta[property="product:price:amount"]').attr('content');
    const precoExtraido = metaPreco ? parseFloat(metaPreco) : null;

    return {
      titulo: titulo || 'Produto Shopee Em Oferta',
      precoPromocional: precoExtraido || 49.90,
      precoOriginal: precoExtraido ? precoExtraido * 1.3 : 89.90,
      linkAfiliado,
      imagem,
      loja: 'Shopee',
    };
  } catch (error) {
    return {
      titulo: 'Produto Shopee em Oferta',
      precoPromocional: 49.90,
      linkAfiliado,
      loja: 'Shopee',
    };
  }
}

async function extrairDadosMercadoLivre(url: string, minhaTag: string): Promise<Oferta> {
  const separator = url.includes('?') ? '&' : '?';
  const linkAfiliado = `${url}${separator}matt_tool=${minhaTag}`;

  try {
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      },
    });

    const $ = cheerio.load(html);
    const titulo =
      $('meta[property="og:title"]').attr('content') ||
      $('.ui-pdp-title').text().trim() ||
      'Produto Mercado Livre';
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