import { Bot, InlineKeyboard } from 'grammy';
import * as dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { validarUrlOferta } from './validator';
import { processarLinkGenerico } from './parser';
import { formatarMensagemOferta } from './formatter';
import { registrarPostagem } from './logger';
import { initDatabase, salvarOferta, linkJaExiste } from './database';
import cron from 'node-cron';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const MINHA_TAG_AMAZON = process.env.TAG_AMAZON || 'achadin0bad49-20';
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

// Função responsável por processar e enviar as ofertas automáticas nos canais
async function buscarEPostarAutomatico() {
  console.log('🤖 [ROBÔ] Iniciando rotina de busca e envio de ofertas automáticas...');

  // Lista de links/ofertas monitoradas para postagem automática
  const ofertasFila = [
    {
      url: 'https://www.amazon.com.br/dp/B09B2SBHQK', // Exemplo de produto BR
      canal: CANAL_BR,
      regiao: 'BR'
    }
  ];

  for (const item of ofertasFila) {
    try {
      const jaExiste = await linkJaExiste(item.url);
      if (jaExiste) {
        console.log(`⚠️ [ROBÔ] Link já publicado anteriormente: ${item.url}`);
        continue;
      }

      // Processa a oferta injetando a tag de afiliado e extraindo dados
      const oferta = await processarLinkGenerico(item.url, MINHA_TAG_AMAZON);
      const mensagemPronta = formatarMensagemOferta(oferta);

      // Envia direto para o canal de destino correspondente
      if (oferta.imagem) {
        await bot.api.sendPhoto(item.canal, oferta.imagem, {
          caption: mensagemPronta,
          parse_mode: 'Markdown',
        });
      } else {
        await bot.api.sendMessage(item.canal, mensagemPronta, {
          parse_mode: 'Markdown',
        });
      }

      // Salva no banco SQLite e grava histórico
      await salvarOferta(oferta.titulo, oferta.precoAtual, item.url, oferta.loja, item.regiao);
      registrarPostagem(oferta);

      console.log(`✅ [ROBÔ] Oferta publicada com sucesso no canal ${item.canal}!`);
    } catch (error) {
      console.error(`❌ [ROBÔ] Erro ao processar oferta automática (${item.url}):`, error);
    }
  }
}

// Configura as tarefas automáticas de background (Cron Job)
function iniciarAgendadorAutomatico() {
  // Executa a cada 2 horas (às 00:00, 02:00, 04:00, etc.)
  cron.schedule('0 */2 * * *', async () => {
    console.log('⏰ [CRON] Disparando execução agendada...');
    await buscarEPostarAutomatico();
  });

  console.log('⏱️ Agendador Cron ativo (Verificação a cada 2 horas)');

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

  // 2. Processador de mensagens de texto
  bot.on('message:text', async (ctx) => {
    const textoRecebido = ctx.message.text.trim();

    // Ignora se for algum comando (ex: /start, /help)
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

  // Função genérica para enviar pro canal selecionado
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