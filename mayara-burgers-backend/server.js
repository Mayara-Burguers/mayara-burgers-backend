/*
============================================================
| SERVER.JS COM RECURSOS DE IA - MAYARA BURGUER'S          |
| CORREÇÃO FINAL: Força o uso de IPv4 para resolver o erro |
| de conexão ENETUNREACH com o banco de dados.             |
============================================================
*/
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first'); // <--- ESSA É A CORREÇÃO!

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const port = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// --- ROTAS DE IA (GEMINI) ---

async function callGemini(prompt) {
    const apiKey = ""; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
    const payload = {
        contents: [{
            parts: [{ text: prompt }]
        }]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.json();
            console.error("Erro da API Gemini:", errorBody);
            throw new Error('Falha ao se comunicar com a API de IA.');
        }

        const result = await response.json();
        
        if (result.candidates && result.candidates.length > 0 && result.candidates[0].content.parts.length > 0) {
            return result.candidates[0].content.parts[0].text;
        } else {
            console.warn("API Gemini retornou uma resposta válida, mas sem conteúdo.", result);
            throw new Error('A IA não conseguiu gerar um resultado para esta solicitação.');
        }

    } catch (error) {
        console.error("Erro ao chamar a função callGemini:", error);
        throw error;
    }
}

app.post('/api/generate-name', async (req, res) => {
    const { ingredients } = req.body;
    if (!ingredients || ingredients.length === 0) {
        return res.status(400).json({ error: 'É necessário fornecer ingredientes.' });
    }

    const prompt = `Sugira um nome criativo e comercial para um novo hambúrguer que tem como principais ingredientes: ${ingredients.join(', ')}. O nome deve ser em português do Brasil, curto e impactante. Retorne apenas o nome, sem frases adicionais.`;

    try {
        const generatedName = await callGemini(prompt);
        const cleanName = generatedName.replace(/["*]/g, '').trim();
        res.status(200).json({ name: cleanName });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-description', async (req, res) => {
    const { productName, ingredients } = req.body;
    if (!productName || !ingredients || ingredients.length === 0) {
        return res.status(400).json({ error: 'É necessário fornecer o nome do produto e os ingredientes.' });
    }

    const prompt = `Crie uma descrição de marketing curta (2 a 3 frases) e deliciosa para um hambúrguer chamado "${productName}" que contém os seguintes ingredientes: ${ingredients.join(', ')}. A descrição deve ser em português do Brasil, despertar a fome e usar uma linguagem informal e convidativa.`;

    try {
        const generatedDescription = await callGemini(prompt);
        res.status(200).json({ description: generatedDescription.trim() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// --- ROTAS EXISTENTES DA APLICAÇÃO ---

app.get('/', (req, res) => {
    res.json({ message: "Servidor da Mayara Burguer's está no ar!" });
});

// --- ROTAS DE PRODUTOS ---
app.get('/api/produtos', async (req, res) => {
    try {
        const result = await db.query('SELECT p.*, c.nome AS categoria_nome FROM produtos p JOIN categorias c ON p.categoria_id = c.id ORDER BY c.ordem, p.id');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.post('/api/produtos', async (req, res) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const { nome, descricao, preco_base, categoria_id, subcategoria, preco_pao_especial, preco_pao_baby, imagem_url, receita } = req.body;
        if (!nome || !preco_base || !categoria_id) {
            return res.status(400).json({ error: 'Nome, preço e categoria são obrigatórios.' });
        }
        
        const sqlProduto = 'INSERT INTO produtos (nome, descricao, preco_base, categoria_id, subcategoria, preco_pao_especial, preco_pao_baby, imagem_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id';
        const produtoValues = [nome, descricao, preco_base, categoria_id, subcategoria || null, preco_pao_especial || null, preco_pao_baby || null, imagem_url || 'placeholder.jpg'];
        const result = await client.query(sqlProduto, produtoValues);
        const produtoId = result.rows[0].id;

        if (receita && receita.length > 0) {
            for (const item of receita) {
                const sqlReceita = 'INSERT INTO receitas (produto_id, ingrediente_id, quantidade_usada) VALUES ($1, $2, $3)';
                await client.query(sqlReceita, [produtoId, item.ingrediente_id, item.quantidade_usada]);
            }
        }
        await client.query('COMMIT');
        res.status(201).json({ id: produtoId, message: 'Produto criado com sucesso!' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erro ao criar produto:", error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    } finally {
        client.release();
    }
});

app.put('/api/produtos/:id', async (req, res) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const { id } = req.params;
        const { nome, descricao, preco_base, categoria_id, subcategoria, preco_pao_especial, preco_pao_baby, imagem_url, receita } = req.body;
        if (!nome || !preco_base || !categoria_id) {
            return res.status(400).json({ error: 'Nome, preço e categoria são obrigatórios.' });
        }
        
        const sqlProduto = 'UPDATE produtos SET nome=$1, descricao=$2, preco_base=$3, categoria_id=$4, subcategoria=$5, preco_pao_especial=$6, preco_pao_baby=$7, imagem_url=$8 WHERE id=$9';
        await client.query(sqlProduto, [nome, descricao, preco_base, categoria_id, subcategoria || null, preco_pao_especial || null, preco_pao_baby || null, imagem_url || 'placeholder.jpg', id]);
        
        await client.query('DELETE FROM receitas WHERE produto_id = $1', [id]);
        if (receita && receita.length > 0) {
            for (const item of receita) {
                const sqlReceita = 'INSERT INTO receitas (produto_id, ingrediente_id, quantidade_usada) VALUES ($1, $2, $3)';
                await client.query(sqlReceita, [id, item.ingrediente_id, item.quantidade_usada]);
            }
        }
        await client.query('COMMIT');
        res.status(200).json({ message: 'Produto atualizado com sucesso!' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erro ao atualizar produto:", error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    } finally {
        client.release();
    }
});

app.delete('/api/produtos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM receitas WHERE produto_id = $1', [id]);
        await db.query('DELETE FROM produtos WHERE id = $1', [id]);
        res.status(200).json({ message: 'Produto apagado com sucesso!' });
    } catch (error) {
        console.error("Erro ao apagar produto:", error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// --- ROTAS DE RECEITAS ---
app.get('/api/produtos/:id/receita', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query(
            'SELECT r.id, r.ingrediente_id, i.nome as ingrediente_nome, r.quantidade_usada, i.unidade FROM receitas r JOIN ingredientes i ON r.ingrediente_id = i.id WHERE r.produto_id = $1',
            [id]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar receita' });
    }
});

// --- ROTA DE CATEGORIAS ---
app.get('/api/categorias', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM categorias ORDER BY ordem');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Erro ao buscar categorias:", error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.post('/api/categorias', async (req, res) => {
    try {
        const { nome, ordem } = req.body;
        if (!nome || ordem === undefined) {
            return res.status(400).json({ error: 'Nome e ordem da categoria são obrigatórios.' });
        }
        const result = await db.query(
            'INSERT INTO categorias (nome, ordem) VALUES ($1, $2) RETURNING id',
            [nome, ordem]
        );
        res.status(201).json({ id: result.rows[0].id, message: 'Categoria criada com sucesso!' });
    } catch (error) {
        console.error("Erro ao criar categoria:", error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});


// --- ROTAS DE PEDIDOS ---
app.get('/api/pedidos', async (req, res) => {
    try {
        const pedidosResult = await db.query('SELECT * FROM pedidos ORDER BY data_hora DESC');
        const pedidos = pedidosResult.rows;
        for (let pedido of pedidos) {
            const itensResult = await db.query('SELECT * FROM itens_do_pedido WHERE pedido_id = $1', [pedido.id]);
            pedido.itens = itensResult.rows;
        }
        res.status(200).json(pedidos);
    } catch (error) {
        console.error('Erro ao buscar pedidos:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.post('/api/pedidos', async (req, res) => {
    const { cliente_nome, cliente_telefone, cliente_endereco, tipo_entrega, valor_total, itens, saches_alho, molhos } = req.body;
    if (!cliente_nome || !valor_total || !itens) {
        return res.status(400).json({ error: 'Dados do pedido incompletos.' });
    }
    
    const client = await db.connect();
    try {
        await client.query('BEGIN');

        for (const item of itens) {
            const produtoInfoResult = await client.query('SELECT p.id, c.nome as categoria_nome FROM produtos p JOIN categorias c ON p.categoria_id = c.id WHERE p.nome = $1', [item.name]);
            if (produtoInfoResult.rows.length === 0) throw new Error(`Produto não encontrado: ${item.name}`);
            
            if (produtoInfoResult.rows[0].categoria_nome !== 'Bebidas') {
                const produtoId = produtoInfoResult.rows[0].id;
                const receitaResult = await client.query('SELECT r.ingrediente_id, r.quantidade_usada, i.nome as ingrediente_nome FROM receitas r JOIN ingredientes i ON r.ingrediente_id = i.id WHERE r.produto_id = $1', [produtoId]);
                
                const paoPadraoNome = 'Pão de Hambúrguer';
                const paoEscolhido = item.bread;
                const trocouDePao = paoEscolhido && paoEscolhido !== paoPadraoNome;

                for (const ingredienteDaReceita of receitaResult.rows) {
                    if (trocouDePao && ingredienteDaReceita.ingrediente_nome === paoPadraoNome) {
                        continue; 
                    }

                    const quantidadeADeduzir = ingredienteDaReceita.quantidade_usada * item.quantity;
                    const sqlUpdateEstoque = `UPDATE ingredientes SET quantidade_estoque = quantidade_estoque - $1 WHERE id = $2 AND quantidade_estoque >= $3`;
                    const updateResult = await client.query(sqlUpdateEstoque, [quantidadeADeduzir, ingredienteDaReceita.ingrediente_id, quantidadeADeduzir]);
                    if (updateResult.rowCount === 0) {
                        const ingInfo = await client.query('SELECT nome FROM ingredientes WHERE id = $1', [ingredienteDaReceita.ingrediente_id]);
                        throw new Error(`Estoque insuficiente para: ${ingInfo.rows[0].nome}`);
                    }
                }

                if (trocouDePao) {
                    const quantidadePao = 1 * item.quantity;
                    const sqlUpdatePaoEscolhido = `UPDATE ingredientes SET quantidade_estoque = quantidade_estoque - $1 WHERE nome = $2 AND quantidade_estoque >= $3`;
                    const updatePaoResult = await client.query(sqlUpdatePaoEscolhido, [quantidadePao, paoEscolhido, quantidadePao]);
                    if (updatePaoResult.rowCount === 0) {
                        throw new Error(`Estoque insuficiente para o pão escolhido: ${paoEscolhido}`);
                    }
                }

                if (item.extras && item.extras.length > 0) {
                    for (const extra of item.extras) {
                        const parts = extra.split('x ');
                        const quantity = parseInt(parts[0], 10);
                        const name = parts[1].trim();
                        
                        const ingredienteResult = await client.query('SELECT id, unidade FROM ingredientes WHERE nome = $1', [name]);
                        
                        if (ingredienteResult.rows.length > 0) {
                            const ingredienteId = ingredienteResult.rows[0].id;
                            const unidade = ingredienteResult.rows[0].unidade;
                            let quantidadeAdicionalADeduzir = 0;

                            if (unidade === 'g' || unidade === 'kg' || unidade === 'ml' || unidade === 'L') {
                                quantidadeAdicionalADeduzir = 30 * quantity;
                            } else {
                                quantidadeAdicionalADeduzir = 1 * quantity;
                            }
                            
                            const sqlUpdateAdicional = `UPDATE ingredientes SET quantidade_estoque = quantidade_estoque - $1 WHERE id = $2 AND quantidade_estoque >= $3`;
                            const updateAdicionalResult = await client.query(sqlUpdateAdicional, [quantidadeAdicionalADeduzir, ingredienteId, quantidadeAdicionalADeduzir]);
                            
                            if (updateAdicionalResult.rowCount === 0) {
                                throw new Error(`Estoque insuficiente para o adicional: ${name}`);
                            }
                        } else {
                            console.warn(`Adicional "${name}" não encontrado na tabela de ingredientes. Estoque não deduzido.`);
                        }
                    }
                }
            }
        }
        
        const pedidoSql = `INSERT INTO pedidos (cliente_nome, cliente_telefone, cliente_endereco, tipo_entrega, valor_total, saches_alho, molhos) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`;
        const pedidoResult = await client.query(pedidoSql, [cliente_nome, cliente_telefone, cliente_endereco, tipo_entrega, valor_total, saches_alho, molhos]);
        const novoPedidoId = pedidoResult.rows[0].id;

        for (const item of itens) {
            const itemSql = `INSERT INTO itens_do_pedido (pedido_id, produto_nome, quantidade, preco_unitario, observacoes, adicionais) VALUES ($1, $2, $3, $4, $5, $6)`;
            const observacoesFinais = [
                (item.bread && item.bread !== 'Pão de Hambúrguer' ? `Pão: ${item.bread}` : ''),
                item.notes
            ].filter(Boolean).join('; ');

            await client.query(itemSql, [novoPedidoId, item.name, item.quantity, item.price, observacoesFinais, item.extras ? item.extras.join(', ') : null]);
        }
        await client.query('COMMIT');
        res.status(201).json({ message: 'Pedido criado com sucesso!', pedidoId: novoPedidoId });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao criar o pedido:', error.message);
        res.status(500).json({ error: `Falha ao processar o pedido. ${error.message}` });
    } finally {
        client.release();
    }
});


app.put('/api/pedidos/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        await db.query('UPDATE pedidos SET status = $1 WHERE id = $2', [status, id]);
        res.status(200).json({ message: 'Status do pedido atualizado com sucesso!' });
    } catch (error) { res.status(500).json({ error: 'Erro interno do servidor' }); }
});

// --- ROTAS DE ESTOQUE (INGREDIENTES) ---
app.get('/api/ingredientes', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM ingredientes ORDER BY nome');
        res.status(200).json(result.rows);
    } catch (error) { res.status(500).json({ error: 'Erro interno do servidor' }); }
});

app.put('/api/ingredientes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { quantidade_estoque } = req.body;
        await db.query('UPDATE ingredientes SET quantidade_estoque = $1 WHERE id = $2', [quantidade_estoque, id]);
        res.status(200).json({ message: 'Estoque atualizado com sucesso!' });
    } catch (error) { res.status(500).json({ error: 'Erro interno ao atualizar estoque.' }); }
});

app.post('/api/ingredientes', async (req, res) => {
    try {
        const { nome, quantidade_estoque, unidade } = req.body;
        const result = await db.query('INSERT INTO ingredientes (nome, quantidade_estoque, unidade) VALUES ($1, $2, $3) RETURNING id', [nome, quantidade_estoque, unidade]);
        res.status(201).json({ message: 'Ingrediente adicionado com sucesso!', id: result.rows[0].id });
    } catch (error) { res.status(500).json({ error: 'Erro interno do servidor' }); }
});

app.delete('/api/ingredientes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM ingredientes WHERE id = $1', [id]);
        res.status(200).json({ message: 'Ingrediente apagado com sucesso!' });
    } catch (error) { res.status(500).json({ error: 'Erro interno do servidor' }); }
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
