const { Pool } = require('pg');
require('dotenv').config();

// Cria um pool de conexões para PostgreSQL usando a URL do ambiente
// Ele vai procurar pela variável DATABASE_URL que você configurou no Render/Fly.io
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

console.log("Pool de conexões com o banco de dados (PostgreSQL) criado!");

// Exportamos o objeto pool para ser usado em outros arquivos
module.exports = {
    query: (text, params) => pool.query(text, params),
    connect: () => pool.connect(),
};
