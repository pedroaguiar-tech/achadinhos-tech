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
const CANAL_BR = process.env.CANAL_BR || '@achadinhos_teech'; 
const CANAL_EU = process.env.CANAL_EU || '@achadinhos_tech_europe'; 

if (!BOT_TOKEN) {
  console.error('❌ ERRO: BOT_TOKEN não foi configurado!');
  process.exit(1);
}

const bot = new Bot(BOT_TOKEN);

function iniciarServidorWeb() {
  const app = express();
  const PORT = process.env.PORT || 10000;

  app.use(express.static(path.join(__dirname, '../public')));

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Landing Page rodando na porta: ${PORT}`);
  });
}

// Lista de links do Mercado Livre para o robô automático alternar sem tomar 403
const LINKS_AUTOMATICOS = [
  'https://www.mercadolivre.com.br/creatina-monohidratada-250g-growth-supplements-sem-sabor-em-po/p/MLB19603205',
  'https://www.mercadolivre.com.br/multivitaminico-60-caps-growth-supplements-sem-sabor-sem-sabor/p/MLB67352286',
  'https://www.mercadolivre.com.br/smart-tv-philco-40-p40vik-led-roku-dolby-audio-wi-fi-hdmi-hdr-full-hd-110220v/p/MLB67270079',
  'https://www.mercadolivre.com.br/smartphone-motorola-moto-g56-5g-256gb-16gb-camera-50mp/p/MLB62405543',
  'https://www.mercadolivre.com.br/fone-de-ouvido-sem-fio-bluetooth-headphone/p/MLB21856382'
];

async function buscarEPostarAutomatico() {
  console.log('🤖 [ROBÔ ML] Executando postagem automática de ofertas...');

  try {
    const listaEmbaralhada = LINKS_AUTOMATICOS.sort(() => Math.random() - 0.5);

    for (const urlItem of listaEmbaralhada) {
      const jaExiste = await linkJaExiste(urlItem);
      if (jaExiste) continue;

      console.log(`🔥 [ROBÔ ML] Processando produto: ${urlItem}`);

      const oferta = await processarLinkGenerico(urlItem, '');
      const mensagemPronta = formatarMensagemOferta(oferta);

      // Envia SOMENTE mensagem de texto no canal (Sem Foto)
      await bot.api.sendMessage(CANAL_BR, mensagemPronta, {
        parse_mode: 'Markdown',
      });

      await salvarOferta(oferta.titulo, oferta.precoAtual, urlItem, oferta.loja, 'BR');
      registrarPostagem(oferta);

      console.log(`✅ [ROBÔ ML] Oferta publicada com sucesso: "${oferta.titulo}"`);
      break; 
    }
  } catch (error) {
    console.error('❌ [ROBÔ ML] Erro na publicação automática:', error);
  }
}

function iniciarAgendadorAutomatico() {
  cron.schedule('*/30 * * * *', async () => {
    console.log('⏰ [CRON ML] Executando varredura a cada 30 minutos...');
    await buscarEPostarAutomatico();
  });

  console.log('⏱️ Agendador Cron ativo (Frequência: 30 min)');
  buscarEPostarAutomatico();
}

async function iniciarBot() {
  await initDatabase();
  iniciarServidorWeb();
  iniciarAgendadorAutomatico();

  bot.command('start', (ctx) => {
    return ctx.reply('👋 **Olá! Bem-vindo ao Achadinhos Tech!**\n\nEnvie o link do produto para formatar a oferta.', { parse_mode: 'Markdown' });
  });

  bot.on('message:text', async (ctx) => {
    const textoRecebido = ctx.message.text.trim();
    if (textoRecebido.startsWith('/')) return;

    const checagem = validarUrlOferta(textoRecebido);
    if (!checagem.valido) {
      return ctx.reply(`❌ **Link Inválido:** ${checagem.motivo}`, { parse_mode: 'Markdown' });
    }

    const jaPostado = await linkJaExiste(textoRecebido);
    if (jaPostado) {
      return ctx.reply('⚠️ **Atenção:** Este link já foi registrado anteriormente!', { parse_mode: 'Markdown' });
    }

    const mensagemAviso = await ctx.reply('🔎 *Buscando dados do produto...*', { parse_mode: 'Markdown' });

    try {
      const oferta = await processarLinkGenerico(textoRecebido, '');
      const mensagemPronta = formatarMensagemOferta(oferta);

      registrarPostagem(oferta);
      await salvarOferta(oferta.titulo, oferta.precoAtual, textoRecebido, oferta.loja, 'GERAL');

      await ctx.api.deleteMessage(ctx.chat.id, mensagemAviso.message_id);

      const teclado = new InlineKeyboard()
        .text('🇧🇷 Postar no Brasil', 'postar_br')
        .text('🇪🇺 Postar na Europa', 'postar_eu');

      // Responde SOMENTE com texto e botões
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

  async function enviarParaCanal(ctx: any, canalTarget: string, regiaoNome: string) {
    try {
      await ctx.answerCallbackQuery({ text: `Enviando para o canal ${regiaoNome}...` });
      const mensagemOriginal = ctx.callbackQuery.message;

      if (mensagemOriginal?.text) {
        await ctx.api.sendMessage(canalTarget, mensagemOriginal.text, {
          parse_mode: 'Markdown',
        });
      }

      await ctx.reply(`✅ **Publicado com sucesso no canal da ${regiaoNome}!**`, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error(`Erro ao postar no canal ${regiaoNome}:`, err);
      await ctx.reply(`❌ Erro ao enviar para o canal.`);
    }
  }

  bot.callbackQuery('postar_br', async (ctx) => {
    await enviarParaCanal(ctx, CANAL_BR, 'América do Sul 🇧🇷');
  });

  bot.callbackQuery('postar_eu', async (ctx) => {
    await enviarParaCanal(ctx, CANAL_EU, 'Europa 🇪🇺');
  });

  bot.start();
  console.log('🚀 Achadinhos Tech ON (Modo Texto/Preço Ativo)!');
}

iniciarBot();