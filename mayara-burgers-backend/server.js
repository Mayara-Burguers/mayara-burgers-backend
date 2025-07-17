/*
============================================================
| SERVER.JS COMPLETO E CORRIGIDO                           |
| FOCO DA CORREÇÃO:                                        |
| - Dedução automática de estoque agora inclui os          |
|   ingredientes adicionais escolhidos pelo cliente.       |
============================================================
*/
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const port = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Rota de teste
app.get('/', (req, res) => {
    res.json({ message: "Servidor da Mayara Burguer's está no ar!" });
});

// --- ROTAS DE PRODUTOS ---
app.get('/api/produtos', async (req, res) => {
    try {
        const result = await db.query('SELECT p.*, c.nome AS categoria_nome FROM Produtos p JOIN Categorias c ON p.categoria_id = c.id ORDER BY c.ordem, p.id');
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
        
        const sqlProduto = 'INSERT INTO Produtos (nome, descricao, preco_base, categoria_id, subcategoria, preco_pao_especial, preco_pao_baby, imagem_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id';
        const produtoValues = [nome, descricao, preco_base, categoria_id, subcategoria || null, preco_pao_especial || null, preco_pao_baby || null, imagem_url || 'placeholder.jpg'];
        const result = await client.query(sqlProduto, produtoValues);
        const produtoId = result.rows[0].id;

        if (receita && receita.length > 0) {
            for (const item of receita) {
                const sqlReceita = 'INSERT INTO Receitas (produto_id, ingrediente_id, quantidade_usada) VALUES ($1, $2, $3)';
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
        
        const sqlProduto = 'UPDATE Produtos SET nome=$1, descricao=$2, preco_base=$3, categoria_id=$4, subcategoria=$5, preco_pao_especial=$6, preco_pao_baby=$7, imagem_url=$8 WHERE id=$9';
        await client.query(sqlProduto, [nome, descricao, preco_base, categoria_id, subcategoria || null, preco_pao_especial || null, preco_pao_baby || null, imagem_url || 'placeholder.jpg', id]);
        
        await client.query('DELETE FROM Receitas WHERE produto_id = $1', [id]);
        if (receita && receita.length > 0) {
            for (const item of receita) {
                const sqlReceita = 'INSERT INTO Receitas (produto_id, ingrediente_id, quantidade_usada) VALUES ($1, $2, $3)';
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
        await db.query('DELETE FROM Receitas WHERE produto_id = $1', [id]);
        await db.query('DELETE FROM Produtos WHERE id = $1', [id]);
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
            'SELECT r.id, r.ingrediente_id, i.nome as ingrediente_nome, r.quantidade_usada, i.unidade FROM Receitas r JOIN Ingredientes i ON r.ingrediente_id = i.id WHERE r.produto_id = $1',
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
        const result = await db.query('SELECT * FROM Categorias ORDER BY ordem');
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
            'INSERT INTO Categorias (nome, ordem) VALUES ($1, $2) RETURNING id',
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
        const pedidosResult = await db.query('SELECT * FROM Pedidos ORDER BY data_hora DESC');
        const pedidos = pedidosResult.rows;
        for (let pedido of pedidos) {
            const itensResult = await db.query('SELECT * FROM Itens_do_Pedido WHERE pedido_id = $1', [pedido.id]);
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
            const produtoInfoResult = await client.query('SELECT p.id, c.nome as categoria_nome FROM Produtos p JOIN Categorias c ON p.categoria_id = c.id WHERE p.nome = $1', [item.name]);
            if (produtoInfoResult.rows.length === 0) throw new Error(`Produto não encontrado: ${item.name}`);
            
            if (produtoInfoResult.rows[0].categoria_nome !== 'Bebidas') {
                const produtoId = produtoInfoResult.rows[0].id;
                const receitaResult = await client.query('SELECT ingrediente_id, quantidade_usada FROM Receitas WHERE produto_id = $1', [produtoId]);
                
                // Deduz ingredientes da receita base
                for (const ingredienteDaReceita of receitaResult.rows) {
                    const quantidadeADeduzir = ingredienteDaReceita.quantidade_usada * item.quantity;
                    const sqlUpdateEstoque = `UPDATE Ingredientes SET quantidade_estoque = quantidade_estoque - $1 WHERE id = $2 AND quantidade_estoque >= $3`;
                    const updateResult = await client.query(sqlUpdateEstoque, [quantidadeADeduzir, ingredienteDaReceita.ingrediente_id, quantidadeADeduzir]);
                    if (updateResult.rowCount === 0) {
                        const ingInfo = await client.query('SELECT nome FROM Ingredientes WHERE id = $1', [ingredienteDaReceita.ingrediente_id]);
                        throw new Error(`Estoque insuficiente para: ${ingInfo.rows[0].nome}`);
                    }
                }

                // --- INÍCIO DA LÓGICA CORRIGIDA PARA ADICIONAIS ---
                if (item.extras && item.extras.length > 0) {
                    for (const extra of item.extras) {
                        const parts = extra.split('x ');
                        const quantity = parseInt(parts[0], 10);
                        const name = parts[1].trim();
                        
                        const ingredienteResult = await client.query('SELECT id FROM Ingredientes WHERE nome = $1', [name]);
                        
                        if (ingredienteResult.rows.length > 0) {
                            const ingredienteId = ingredienteResult.rows[0].id;
                            const sqlUpdateAdicional = `UPDATE Ingredientes SET quantidade_estoque = quantidade_estoque - $1 WHERE id = $2 AND quantidade_estoque >= $3`;
                            const updateAdicionalResult = await client.query(sqlUpdateAdicional, [quantity, ingredienteId, quantity]);
                            
                            if (updateAdicionalResult.rowCount === 0) {
                                throw new Error(`Estoque insuficiente para o adicional: ${name}`);
                            }
                        } else {
                            console.warn(`Adicional "${name}" não encontrado na tabela de ingredientes. Estoque não deduzido.`);
                        }
                    }
                }
                // --- FIM DA LÓGICA CORRIGIDA ---
            }
        }
        
        const pedidoSql = `INSERT INTO Pedidos (cliente_nome, cliente_telefone, cliente_endereco, tipo_entrega, valor_total, saches_alho, molhos) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`;
        const pedidoResult = await client.query(pedidoSql, [cliente_nome, cliente_telefone, cliente_endereco, tipo_entrega, valor_total, saches_alho, molhos]);
        const novoPedidoId = pedidoResult.rows[0].id;

        for (const item of itens) {
            const itemSql = `INSERT INTO Itens_do_Pedido (pedido_id, produto_nome, quantidade, preco_unitario, observacoes, adicionais) VALUES ($1, $2, $3, $4, $5, $6)`;
            await client.query(itemSql, [novoPedidoId, item.name, item.quantity, item.price, item.notes, item.extras ? item.extras.join(', ') : null]);
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
        await db.query('UPDATE Pedidos SET status = $1 WHERE id = $2', [status, id]);
        res.status(200).json({ message: 'Status do pedido atualizado com sucesso!' });
    } catch (error) { res.status(500).json({ error: 'Erro interno do servidor' }); }
});

// --- ROTAS DE ESTOQUE (INGREDIENTES) ---
app.get('/api/ingredientes', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM Ingredientes ORDER BY nome');
        res.status(200).json(result.rows);
    } catch (error) { res.status(500).json({ error: 'Erro interno do servidor' }); }
});

app.put('/api/ingredientes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { quantidade_estoque } = req.body;
        await db.query('UPDATE Ingredientes SET quantidade_estoque = $1 WHERE id = $2', [quantidade_estoque, id]);
        res.status(200).json({ message: 'Estoque atualizado com sucesso!' });
    } catch (error) { res.status(500).json({ error: 'Erro interno ao atualizar estoque.' }); }
});

app.post('/api/ingredientes', async (req, res) => {
    try {
        const { nome, quantidade_estoque, unidade } = req.body;
        const result = await db.query('INSERT INTO Ingredientes (nome, quantidade_estoque, unidade) VALUES ($1, $2, $3) RETURNING id', [nome, quantidade_estoque, unidade]);
        res.status(201).json({ message: 'Ingrediente adicionado com sucesso!', id: result.rows[0].id });
    } catch (error) { res.status(500).json({ error: 'Erro interno do servidor' }); }
});

app.delete('/api/ingredientes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM Ingredientes WHERE id = $1', [id]);
        res.status(200).json({ message: 'Ingrediente apagado com sucesso!' });
    } catch (error) { res.status(500).json({ error: 'Erro interno do servidor' }); }
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
