const { Pool } = require('pg');
require('dotenv').config();

// Verifica se a variável de ambiente DATABASE_URL foi carregada.
if (!process.env.DATABASE_URL) {
  throw new Error('A variável de ambiente DATABASE_URL não foi definida. Verifique seu arquivo .env ou as configurações do servidor.');
}

const pool = new Pool({
  // Usa a connection string fornecida pelo Supabase, que será lida da variável de ambiente.
  connectionString: process.env.DATABASE_URL,
  // O Supabase, assim como o Render, requer SSL para conexões externas.
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  connect: () => pool.connect(),
};
