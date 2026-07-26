import { Oferta } from './formatter';

// Array em memória para guardar o histórico das ofertas postadas
const historicoPostagens: { data: Date; oferta: Oferta }[] = [];

/**
 * Registra uma nova oferta postada no histórico
 */
export function registrarPostagem(oferta: Oferta): void {
  historicoPostagens.push({
    data: new Date(),
    oferta,
  });
  console.log(`📝 [LOG] Oferta "${oferta.titulo.substring(0, 30)}..." registrada no histórico!`);
}

/**
 * Gera um resumo/relatório com estatísticas das ofertas processadas
 */
export function gerarRelatorioDesempenho(): void {
  console.log('\n==================================================');
  console.log('📈 ACHADINHOS TECH - RELATÓRIO DO DIA');
  console.log('==================================================');

  const totalPosts = historicoPostagens.length;

  if (totalPosts === 0) {
    console.log('Nenhuma oferta foi postada hoje ainda.');
    console.log('==================================================\n');
    return;
  }

  // Calcula a economia total acumulada das ofertas
  const economiaTotal = historicoPostagens.reduce((acumulado, item) => {
    if (item.oferta.precoOriginal) {
      return acumulado + (item.oferta.precoOriginal - item.oferta.precoPromocional);
    }
    return acumulado;
  }, 0);

  console.log(`📊 Total de Ofertas Processadas: ${totalPosts}`);
  console.log(`💰 Economia Total Gerada para os Clientes: R$ ${economiaTotal.toFixed(2)}`);
  console.log('==================================================\n');
}