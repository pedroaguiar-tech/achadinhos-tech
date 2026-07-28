import axios from 'axios';

export async function processarLinkGenerico(url: string, tagAmazon: string) {
  // Extrai o ID do produto
  const matchId = url.match(/MLB-?(\d+)/i);
  let tituloFormatado = '';

  // Trata o título extraindo e limpando o trecho da própria URL (infalível contra CAPTCHA)
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

  if (matchId) {
    const mlbId = `MLB${matchId[1]}`;

    try {
      // Requisição para a API pública
      const res = await axios.get(`https://api.mercadolibre.com/items/${mlbId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        },
        timeout: 5000
      });

      if (res.data && res.data.title) {
        const img = res.data.pictures && res.data.pictures.length > 0 
          ? res.data.pictures[0].secure_url 
          : (res.data.thumbnail ? res.data.thumbnail.replace('-I.jpg', '-O.jpg') : '');

        return {
          titulo: res.data.title,
          precoAtual: res.data.price || 0,
          linkAfiliado: url,
          loja: 'Mercado Livre',
          imagem: img
        };
      }
    } catch (err) {
      console.log(`⚠️ API indisponível para ${mlbId}. Aplicando formatação via URL...`);
    }
  }

  return {
    titulo: tituloFormatado || 'Oferta Especial no Mercado Livre',
    precoAtual: 0,
    linkAfiliado: url,
    loja: 'Mercado Livre',
    imagem: ''
  };
}