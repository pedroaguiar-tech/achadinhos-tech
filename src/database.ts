import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

let db: Database;

// Inicializa e conecta ao banco de dados SQLite
export async function initDatabase() {
  db = await open({
    filename: 'achadinhos.db',
    driver: sqlite3.Database
  });

  // Tabela para registrar o histórico de ofertas postadas
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ofertas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT,
      preco TEXT,
      link TEXT UNIQUE,
      loja TEXT,
      regiao TEXT DEFAULT 'AMERICA_DO_SUL',
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('🗄️ Banco de dados SQLite inicializado com sucesso!');
}

// Salva uma oferta no banco
export async function salvarOferta(titulo: string, preco: string, link: string, loja: string, regiao: string = 'AMERICA_DO_SUL') {
  return await db.run(
    `INSERT OR IGNORE INTO ofertas (titulo, preco, link, loja, regiao) VALUES (?, ?, ?, ?, ?)`,
    [titulo || 'Produto sem título', preco || 'Consulte o site', link, loja || 'Loja', regiao]
  );
}

// Verifica se a oferta já foi cadastrada anteriormente
export async function linkJaExiste(link: string): Promise<boolean> {
  const result = await db.get('SELECT id FROM ofertas WHERE link = ?', [link]);
  return !!result;
}