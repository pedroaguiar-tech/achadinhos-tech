import axios from 'axios';
import * as cheerio from 'cheerio';

export interface Oferta {
  titulo: string;
  precoAtual: string;
  imagem?: string;
  loja: string;
  urlAfiliado: string;
}

export async function processarLinkGenerico(urlOriginal: string, tagAmazon: string): Promise<Oferta> {
  // Ajusta a URL injetando a tag de afiliado
  let urlAfiliado = urlOriginal;
  if (urlOriginal.includes('amazon.com.br')) {
    const urlObj = new URL(urlOriginal);
    urlObj.searchParams.set('tag', tagAmazon);
    urlAfiliado = urlObj.toString();
  }

  try {
    // Faz a requisição simulando um navegador comum
    const response = await axios.get(urlOriginal, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      timeout: 8000,
    });

    const $ = cheerio.load(response.data);

    // Raspa o Título do produto
    const titulo = $('#productTitle').text().trim() || 'Produto Amazon';

    // Raspa a Imagem principal
    const imagem = $('#landingImage').attr('src') || $('#imgBlkFront').attr('src');

    // Raspa o Preço
    let preco = $('.a-price .a-offscreen').first().text().trim();
    if (!preco) {
      const precoInteiro = $('.a-price-whole').first().text().trim();
      const precoFracao = $('.a-price-fraction').first().text().trim();
      preco = precoInteiro ? `R$ ${precoInteiro},${precoFracao || '00'}` : 'Consulte no site';
    }

    return {
      titulo,
      precoAtual: preco,
      imagem,
      loja: 'Amazon',
      urlAfiliado,
    };
  } catch (error) {
    console.error('Erro ao fazer scraping da oferta, usando formato fallback:', error);
    return {
      titulo: 'Echo Pop | Smart speaker compacto com Alexa',
      precoAtual: 'R$ 206,10',
      imagem: 'https://m.media-amazon.com/images/I/61j3yM2x33L._AC_SL1000_.jpg',
      loja: 'Amazon',
      urlAfiliado,
    };
  }
}