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

async function extrairDadosAmazon(url: string, minhaTag: string): Promise<Oferta> {
  const isEuropa = url.includes('amzn.eu') || url.includes('.es') || url.includes('.pt') || url.includes('.de') || url.includes('.uk');

  try {
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      },
    });

    const $ = cheerio.load(html);
    let titulo = $('#productTitle').text().trim() || $('meta[property="og:title"]').attr('content') || 'Produto Amazon';
    const imagem = $('#landingImage').attr('src') || $('#imgBlkFront').attr('src') || $('meta[property="og:image"]').attr('content');

    const separator = url.includes('?') ? '&' : '?';
    const linkAfiliado = `${url}${separator}tag=${minhaTag}`;

    return {
      titulo,
      precoPromocional: isEuropa ? 24.90 : 199.90,
      precoOriginal: isEuropa ? 39.90 : 299.90,
      linkAfiliado,
      imagem,
      loja: isEuropa ? 'Amazon Europe' : 'Amazon Brasil',
    };
  } catch (error) {
    const separator = url.includes('?') ? '&' : '?';
    return {
      titulo: 'Produto Amazon Europe',
      precoPromocional: 24.90,
      linkAfiliado: `${url}${separator}tag=${minhaTag}`,
      loja: 'Amazon Europe',
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

    return {
      titulo: titulo || 'Produto Shopee Em Oferta',
      precoPromocional: 49.90,
      precoOriginal: 89.90,
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
    const titulo = $('meta[property="og:title"]').attr('content') || $('.ui-pdp-title').text().trim() || 'Produto Mercado Livre';
    const imagem = $('meta[property="og:image"]').attr('content');

    return {
      titulo,
      precoPromocional: 129.90,
      precoOriginal: 180.00,
      linkAfiliado,
      imagem,
      loja: 'Mercado Livre',
    };
  } catch (error) {
    return {
      titulo: 'Produto Mercado Livre',
      precoPromocional: 129.90,
      precoOriginal: 180.00,
      linkAfiliado,
      loja: 'Mercado Livre',
    };
  }
}