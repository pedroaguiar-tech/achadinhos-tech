import axios from 'axios';
import * as cheerio from 'cheerio';

export async function processarLinkGenerico(url: string, tagAmazon: string) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);

    // Extrai o Título real do produto
    let titulo = $('h1.ui-pdp-title').text().trim() || 
                 $('meta[property="og:title"]').attr('content') || 
                 $('h1').text().trim() || 
                 'Oferta em Destaque';

    // Extrai a Imagem principal do produto
    let imagem = $('meta[property="og:image"]').attr('content') || '';

    // Extrai o Preço do produto no Mercado Livre
    let precoTexto = $('.ui-pdp-price__second-line .andes-money-amount__fraction').first().text().trim() ||
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
  } catch (error) {
    console.error('Erro ao processar parser:', error);
    return {
      titulo: 'Produto em Destaque',
      precoAtual: 0,
      linkAfiliado: url,
      loja: 'Mercado Livre',
      imagem: ''
    };
  }
}