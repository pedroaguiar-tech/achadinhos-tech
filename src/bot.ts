import { Bot, InlineKeyboard } from 'grammy';
import * as dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
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
  console.error('❌ ERRO: BOT_TOKEN não foi configurado no arquivo .env!');
  process.exit(1);
}

const bot = new Bot(BOT_TOKEN);

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
 * Raspa os produtos mais vendidos / ofertas do Mercado Livre Brasil
 */
async function buscarOfertasMercadoLivre(): Promise<string[]> {
  try {
    const response = await axios.get('https://www.mercadolivre.com.br/ofertas', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    const linksML: string[] = [];

    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (href && (href.includes('mercadolivre.com.br/MLB') || href.includes('/p/MLB'))) {
        // Limpa a URL removendo parâmetros pesados de rastreio original
        const urlLimpa = href.split('#')[0].split('?')[0];
        if (!linksML.includes(urlLimpa)) {
          linksML.push(urlLimpa);
        }
      }
    });

    return linksML;
  } catch (error) {
    console.log('⚠️ Erro ao raspar Mercado Livre, utilizando lista de apoio:', error);
    return [
      'https://www.mercadolivre.com.br/p/MLB21856382',
      'https://www.mercadolivre.com.br/p/MLB19156432',
    ];
  }
}

/**
 * Busca promoções em diversas categorias para garantir variedade no canal
 */
async function buscarEPostarAutomatico() {
  console.log('🤖 [ROBÔ ML] Buscando nova promoção variada no Mercado Livre...');

  try {
    const candidatos = await buscarOfertasMercadoLivre();

    if (!candidatos || candidatos.length === 0) {
      console.log('⚠️ Nenhuma oferta nova encontrada no momento.');
      return;
    }

    // Embaralha a lista para não postar sempre na mesma ordem
    const candidatosEmbaralhados = candidatos.sort(() => Math.random() - 0.5);

    for (const urlItem of candidatosEmbaralhados) {
      // Verifica no banco de dados SQLite se esse produto já foi postado recentemente
      const jaExiste = await linkJaExiste(urlItem);
      if (jaExiste) {
        console.log(`⚠️ [ROBÔ ML] Produto já publicado anteriormente (pulando): ${urlItem}`);
        continue;
      }

      console.log(`🔥 [ROBÔ ML] Processando produto inédito: ${urlItem}`);

      // Processa título, preço real e foto do produto raspado
      const oferta = await processarLinkGenerico(urlItem, '');
      
      oferta.loja = 'Mercado Livre';
      // Atribui o link real da oferta raspada para o botão/link
      oferta.linkAfiliado = urlItem; 

      const mensagemPronta = formatarMensagemOferta(oferta);

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

      // Salva no banco de dados para nunca mais repetir essa oferta
      await salvarOferta(oferta.titulo, oferta.precoAtual, urlItem, 'Mercado Livre', 'BR');
      registrarPostagem(oferta);

      console.log(`✅ [ROBÔ ML] Nova oferta variada ("${oferta.titulo}") publicada com sucesso!`);
      break; // Publica apenas 1 oferta por ciclo de 30 min para manter o ritmo perfeito
    }
  } catch (error) {
    console.error('❌ [ROBÔ ML] Erro na rotina do Mercado Livre:', error);
  }
}

function iniciarAgendadorAutomatico() {
  cron.schedule('*/30 * * * *', async () => {
    console.log('⏰ [CRON ML] Executando varredura a cada 30 minutos...');
    await buscarEPostarAutomatico();
  });

  console.log('⏱️ Agendador Cron ativo para o Mercado Livre (Frequência: 30 min)');
  
  // Dispara o teste imediato ao ligar o servidor no Render
  buscarEPostarAutomatico();
}

async function iniciarBot() {
  await initDatabase();
  iniciarServidorWeb();
  iniciarAgendadorAutomatico();

  bot.command('start', (ctx) => {
    return ctx.reply('👋 **Olá! Bem-vindo ao Achadinhos Tech!**\n\nEnvie o link de qualquer produto para formatar a oferta.', { parse_mode: 'Markdown' });
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

    const mensagemAviso = await ctx.reply('🔎 *Buscando dados atualizados do produto...*', { parse_mode: 'Markdown' });

    try {
      const oferta = await processarLinkGenerico(textoRecebido, '');
      const mensagemPronta = formatarMensagemOferta(oferta);

      registrarPostagem(oferta);
      await salvarOferta(oferta.titulo, oferta.precoAtual, textoRecebido, oferta.loja, 'GERAL');

      await ctx.api.deleteMessage(ctx.chat.id, mensagemAviso.message_id);

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

  bot.callbackQuery('postar_br', async (ctx) => {
    await enviarParaCanal(ctx, CANAL_BR, 'América do Sul 🇧🇷');
  });

  bot.callbackQuery('postar_eu', async (ctx) => {
    await enviarParaCanal(ctx, CANAL_EU, 'Europa 🇪🇺');
  });

  bot.start();
  console.log('🚀 Achadinhos Tech ON operando com Mercado Livre!');
}

iniciarBot();