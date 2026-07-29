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
 * Busca ofertas em alta usando a API oficial do Mercado Livre Brasil (sem bloqueio de IP)
 */
async function buscarOfertasMercadoLivreAPI(): Promise<any[]> {
  const termosBusca = ['tecnologia', 'smartphone', 'fone bluetooth', 'gamer', 'smartwatch', 'casa inteligente'];
  const termoSorteado = termosBusca[Math.floor(Math.random() * termosBusca.length)];

  try {
    const urlApi = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(termoSorteado)}&sort=relevance`;
    const response = await axios.get(urlApi, { timeout: 8000 });

    if (response.data && response.data.results) {
      return response.data.results.map((item: any) => ({
        titulo: item.title,
        precoAtual: item.price,
        linkAfiliado: item.permalink,
        loja: 'Mercado Livre',
        imagem: item.thumbnail ? item.thumbnail.replace('-I.jpg', '-O.jpg') : ''
      }));
    }
    return [];
  } catch (error) {
    console.error('⚠️ Erro ao buscar ofertas na API do ML:', error);
    return [];
  }
}

/**
 * Rotina automática autônoma de busca e publicação
 */
async function buscarEPostarAutomatico() {
  console.log('🤖 [ROBÔ ML] Buscando nova promoção via API Oficial do Mercado Livre...');

  try {
    const ofertas = await buscarOfertasMercadoLivreAPI();

    if (!ofertas || ofertas.length === 0) {
      console.log('⚠️ Nenhuma oferta encontrada na API no momento.');
      return;
    }

    // Embaralha para variar as postagens
    const ofertasEmbaralhadas = ofertas.sort(() => Math.random() - 0.5);

    for (const oferta of ofertasEmbaralhadas) {
      const jaExiste = await linkJaExiste(oferta.linkAfiliado);
      if (jaExiste) {
        continue;
      }

      console.log(`🔥 [ROBÔ ML] Publicando oferta inédita: ${oferta.titulo} - R$ ${oferta.precoAtual}`);

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

      await salvarOferta(oferta.titulo, oferta.precoAtual, oferta.linkAfiliado, 'Mercado Livre', 'BR');
      registrarPostagem(oferta);

      console.log(`✅ [ROBÔ ML] Publicado com sucesso no canal: "${oferta.titulo}"`);
      break; // Posta 1 oferta por ciclo
    }
  } catch (error) {
    console.error('❌ [ROBÔ ML] Erro na rotina de publicação:', error);
  }
}

function iniciarAgendadorAutomatico() {
  cron.schedule('*/30 * * * *', async () => {
    console.log('⏰ [CRON ML] Executando varredura a cada 30 minutos...');
    await buscarEPostarAutomatico();
  });

  console.log('⏱️ Agendador Cron ativo (Frequência: 30 min)');
  
  // Dispara uma postagem teste assim que o servidor subir no Render
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
  console.log('🚀 Achadinhos Tech ON operando!');
}

iniciarBot();