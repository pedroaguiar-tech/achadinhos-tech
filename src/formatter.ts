export interface Oferta {
  titulo: string;
  precoAtual: number;
  precoOriginal?: number;
  desconto?: number;
  linkAfiliado: string;
  loja: string;
  imagem?: string;
}

export function formatarMensagemOferta(oferta: Oferta): string {
  const preco = oferta.precoAtual || 0;

  const precoFormatado = preco > 0 
    ? `R$ ${preco.toFixed(2).replace('.', ',')}` 
    : 'Consulte no site';

  let mensagem = `🔥 **${oferta.titulo || 'Oferta Imperdível!'}**\n\n`;

  if (oferta.precoOriginal && oferta.precoOriginal > preco && preco > 0) {
    const precoOrigFormatado = `R$ ${oferta.precoOriginal.toFixed(2).replace('.', ',')}`;
    mensagem += `❌ De: ~${precoOrigFormatado}~\n`;
    mensagem += `✅ **Por apenas: ${precoFormatado}**\n`;
  } else {
    mensagem += `💰 **Preço:** ${precoFormatado}\n`;
  }

  if (oferta.desconto) {
    mensagem += `📉 **Desconto:** ${oferta.desconto}%\n`;
  }

  mensagem += `🛒 **Loja:** ${oferta.loja || 'Mercado Livre'}\n\n`;
  mensagem += `🔗 **Garanta o seu aqui:**\n${oferta.linkAfiliado}`;

  return mensagem;
}