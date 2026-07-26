export interface Oferta {
  titulo: string;
  precoPromocional: number;
  precoOriginal?: number;
  linkAfiliado: string;
  imagem?: string;
  loja?: string;
}

export function formatarMensagemOferta(oferta: Oferta): string {
  const eEuropa = oferta.loja?.toLowerCase().includes('europe') || oferta.linkAfiliado.includes('amzn.eu');
  const simboloMoeda = eEuropa ? '€' : 'R$';

  let mensagem = `🔥 **${oferta.titulo.toUpperCase()}** 🔥\n\n`;

  if (oferta.precoOriginal && oferta.precoOriginal > oferta.precoPromocional) {
    const desconto = Math.round(
      ((oferta.precoOriginal - oferta.precoPromocional) / oferta.precoOriginal) * 100
    );
    mensagem += `❌ De: ~${simboloMoeda} ${oferta.precoOriginal.toFixed(2)}~\n`;
    mensagem += `✅ **Por: ${simboloMoeda} ${oferta.precoPromocional.toFixed(2)} (${desconto}% OFF!)**\n\n`;
  } else {
    mensagem += `✅ **Por apenas: ${simboloMoeda} ${oferta.precoPromocional.toFixed(2)}**\n\n`;
  }

  mensagem += `🛒 **Compre com desconto aqui:**\n${oferta.linkAfiliado}`;

  return mensagem;
}