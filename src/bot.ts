import { Bot, InlineKeyboard } from 'grammy';
import * as dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import axios from 'axios';
import { validarUrlOferta } from './validator';
import { processarLinkGenerico } from './parser';
import { formatarMensagemOferta } from './formatter';
import { registrarPostagem } from './logger';
import { initDatabase, salvarOferta, linkJaExiste } from './database';
import cron from 'node-cron';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const MINHA_TAG_AMAZON = 'achadin0bad49-20';
const CANAL_BR = process.env.CANAL_BR || '@achadinhos_teech'; 
const CANAL_EU = process.env.CANAL_EU || '@achadinhos_tech_europe'; 

if (!BOT_TOKEN) {
  console.error('❌ ERRO: BOT_TOKEN não foi configurado no arquivo .env!');
  process.exit(1);
}

const bot = new Bot(BOT_TOKEN);

// Inicializa o servidor Express para a Landing Page
function iniciarServidorWeb() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.static(path.join(__dirname, '../public')));

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });

  app.listen(PORT, () => {
    console.log(`🌐 Landing Page rodando em: http://localhost:${PORT}`);
  });
}

/**
 * Busca ofertas em tempo real de feeds de promoções / scraper
 */
async function buscarOfertasEmTempoReal(): Promise<string[]> {
  try {
    const response = await axios.get('https://api.promobit.com.br/v2/offers?limit=25', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 10000,
    });

    const ofertas = response.data?.offers || response.data || [];
    const linksAmazon: string[] = [];

    for (const item of ofertas) {
      const url = item.url || item.link || '';
      if (url.includes('amazon.com.br')) {
        linksAmazon.push(url);
      }
    }

    return linksAmazon;
  } catch (error) {
    console.log('⚠️ Aviso ao consultar feed dinâmico, usando lista de apoio:', error);
    return [
      'https://www.amazon.com.br/dp/B09B2SBHQK', // Echo Pop
      'https://www.amazon.com.br/dp/B08C1KN5J2', // Fire TV Stick
      'https://www.amazon.com.br/dp/B0733B3SDR', // Kindle 11ª
      'https://www.amazon.com.br/dp/B084DWG2VQ', // Echo Dot 5ª
    ];
  }
}

// Função responsável por processar e enviar as ofertas automáticas nos canais
async function buscarEPostarAutomatico() {
  console.log('🤖 [ROBÔ] Iniciando varredura em tempo real por novas ofertas...');

  try {
    const candidatos = await buscarOfertasEmTempoReal();

    for (const urlItem of candidatos) {
      // 1. Consulta o banco de dados SQLite para garantir que NUNCA repete
      const jaExiste = await linkJaExiste(urlItem);
      if (jaExiste) {
        console.log(`⚠️ [ROBÔ] Link já publicado anteriormente (ignorado): ${urlItem}`);
        continue;
      }

      console.log(`🔥 [ROBÔ] Nova oferta encontrada: ${urlItem}`);

      // 2. Processa a oferta injetando a sua tag oficial de afiliado e raspando dados
      const oferta = await processarLinkGenerico(urlItem, MINHA_TAG_AMAZON);
      const mensagemPronta = formatarMensagemOferta(oferta);

      // 3. Envia direto para o canal de destino do Brasil
      if (oferta.imagem) {
        await bot.api.sendPhoto(CANAL_BR, oferta.imagem, {
          caption: mensagemPronta,
          parse_mode: 'Markdown',
        });
      } else {
        await bot.api.sendMessage(CANAL_BR, mensagemPronta, {
          parse_mode: 'Markdown',
        });
      }

      // 4. Grava no banco SQLite para nunca mais repetir
      await salvarOferta(oferta.titulo, oferta.precoAtual, urlItem, oferta.loja, 'BR');
      registrarPostagem(oferta);

      console.log(`✅ [ROBÔ] Oferta publicada com sucesso no canal ${CANAL_BR}!`);

      // Publica uma oferta por ciclo automático e finaliza o loop
      break;
    }
  } catch (error) {
    console.error('❌ [ROBÔ] Erro na rotina de busca automática:', error);
  }
}

// Configura as tarefas automáticas de background (Cron Job)
function iniciarAgendadorAutomatico() {
  // Executa a cada 30 minutos no automático
  cron.schedule('*/30 * * * *', async () => {
    console.log('⏰ [CRON] Disparando execução a cada 30 minutos...');
    await buscarEPostarAutomatico();
  });

  console.log('⏱️ Agendador Cron ativo (Verificação de promoções em tempo real a cada 30 minutos)');

  // 🚀 Executa uma vez imediatamente ao iniciar o servidor para testar o envio
  buscarEPostarAutomatico();
}

async function iniciarBot() {
  await initDatabase();
  iniciarServidorWeb();
  iniciarAgendadorAutomatico();

  // 1. Comando /start configurado em primeiro lugar
  bot.command('start', (ctx) => {
    return ctx.reply('👋 **Olá! Bem-vindo ao Achadinhos Tech!**\n\nEnvie o link de qualquer produto (Amazon, Shopee, etc.) para formatar a oferta e publicar nos canais.', { parse_mode: 'Markdown' });
  });

  // 2. Processador de mensagens de texto recebidas no chat privado
  bot.on('message:text', async (ctx) => {
    const textoRecebido = ctx.message.text.trim();

    if (textoRecebido.startsWith('/')) return;

    const checagem = validarUrlOferta(textoRecebido);

    if (!checagem.valido) {
      return ctx.reply(`❌ **Link Inválido:** ${checagem.motivo}`, { parse_mode: 'Markdown' });
    }

    const jaPostado = await linkJaExiste(textoRecebido);
    if (jaPostado) {
      return ctx.reply('⚠️ **Atenção:** Este link já foi registrado no banco de dados anteriormente!', { parse_mode: 'Markdown' });
    }

    const mensagemAviso = await ctx.reply('🔎 *Buscando dados atualizados do produto...*', { parse_mode: 'Markdown' });

    try {
      const oferta = await processarLinkGenerico(textoRecebido, MINHA_TAG_AMAZON);
      const mensagemPronta = formatarMensagemOferta(oferta);

      registrarPostagem(oferta);
      await salvarOferta(oferta.titulo, oferta.precoAtual, textoRecebido, oferta.loja, 'GERAL');

      await ctx.api.deleteMessage(ctx.chat.id, mensagemAviso.message_id);

      // Teclado com opção de escolha do canal destino
      const teclado = new InlineKeyboard()
        .text('🇧🇷 Postar no Brasil', 'postar_br')
        .text('🇪🇺 Postar na Europa', 'postar_eu');

      if (oferta.imagem) {
        return ctx.replyWithPhoto(oferta.imagem, {
          caption: mensagemPronta,
          parse_mode: 'Markdown',
          reply_markup: teclado,
        });
      }

      return ctx.reply(mensagemPronta, {
        parse_mode: 'Markdown',
        reply_markup: teclado,
      });
    } catch (error) {
      console.error('Erro ao processar oferta:', error);
      await ctx.api.deleteMessage(ctx.chat.id, mensagemAviso.message_id);
      return ctx.reply('❌ Ocorreu um erro ao processar o link desse produto.');
    }
  });

  // Função genérica para enviar pro canal selecionado via botão
  async function enviarParaCanal(ctx: any, canalTarget: string, regiaoNome: string) {
    try {
      await ctx.answerCallbackQuery({ text: `Enviando para o canal ${regiaoNome}...` });

      const mensagemOriginal = ctx.callbackQuery.message;

      if (mensagemOriginal?.photo) {
        const photoId = mensagemOriginal.photo[mensagemOriginal.photo.length - 1].file_id;
        const caption = mensagemOriginal.caption || '';

        await ctx.api.sendPhoto(canalTarget, photoId, {
          caption: caption,
          parse_mode: 'Markdown',
        });
      } else if (mensagemOriginal?.text) {
        await ctx.api.sendMessage(canalTarget, mensagemOriginal.text, {
          parse_mode: 'Markdown',
        });
      }

      await ctx.reply(`✅ **Publicado com sucesso no canal da ${regiaoNome}!**`, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error(`Erro ao postar no canal ${regiaoNome}:`, err);
      await ctx.reply(`❌ Erro ao enviar para o canal da ${regiaoNome}. Verifique se o bot é Admin no canal!`);
    }
  }

  // Escutador do botão Brasil
  bot.callbackQuery('postar_br', async (ctx) => {
    await enviarParaCanal(ctx, CANAL_BR, 'América do Sul 🇧🇷');
  });

  // Escutador do botão Europa
  bot.callbackQuery('postar_eu', async (ctx) => {
    await enviarParaCanal(ctx, CANAL_EU, 'Europa 🇪🇺');
  });

  bot.start();
  console.log('🚀 Achadinhos Tech Multi-Região ON com roteamento de canais e agendador ativos!');
}

iniciarBot();