/*
============================================================
|        SERVIDOR BACK-END - MAYARA BURGUER'S              |
|   Refatorado para usar o Supabase Client, resolvendo o   |
|   problema de conexão de rede (ENETUNREACH).             |
============================================================
*/
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

// --- CONFIGURAÇÃO DO CLIENTE SUPABASE ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Erro Crítico: As variáveis de ambiente SUPABASE_URL e SUPABASE_KEY são obrigatórias.");
    process.exit(1); 
}
const supabase = createClient(supabaseUrl, supabaseKey);


// --- CONFIGURAÇÃO DO SERVIDOR EXPRESS ---
const app = express();
const port = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());


// --- ROTAS DA APLICAÇÃO ---

app.get('/', (req, res) => {
    res.json({ message: "Servidor da Mayara Burguer's está no ar! Conexão via Supabase Client." });
});

// --- ROTAS DE PRODUTOS ---
app.get('/api/produtos', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('produtos')
           
            .select('*, categorias(nome)')
            .order('id', { ascending: true }); // Ordenação simples

        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/produtos', async (req, res) => {
    try {
        const { nome, descricao, preco_base, categoria_id, subcategoria, preco_pao_especial, preco_pao_baby, imagem_url, receita } = req.body;
        if (!nome || !preco_base || !categoria_id) {
            return res.status(400).json({ error: 'Nome, preço e categoria são obrigatórios.' });
        }
        
        // Insere o produto
        const { data: produtoData, error: produtoError } = await supabase
            .from('produtos')
            .insert({ nome, descricao, preco_base, categoria_id, subcategoria, preco_pao_especial, preco_pao_baby, imagem_url })
            .select('id')
            .single(); // .single() para pegar o objeto diretamente

        if (produtoError) throw produtoError;
        const produtoId = produtoData.id;

        // Insere a receita, se houver
        if (receita && receita.length > 0) {
            const receitaParaInserir = receita.map(item => ({
                produto_id: produtoId,
                ingrediente_id: item.ingrediente_id,
                quantidade_usada: item.quantidade_usada
            }));
            const { error: receitaError } = await supabase.from('receitas').insert(receitaParaInserir);
            if (receitaError) throw receitaError;
        }
        
        res.status(201).json({ id: produtoId, message: 'Produto criado com sucesso!' });
    } catch (error) {
        console.error("Erro ao criar produto:", error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/produtos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, descricao, preco_base, categoria_id, subcategoria, preco_pao_especial, preco_pao_baby, imagem_url, receita } = req.body;

        // Atualiza o produto
        const { error: produtoError } = await supabase
            .from('produtos')
            .update({ nome, descricao, preco_base, categoria_id, subcategoria, preco_pao_especial, preco_pao_baby, imagem_url })
            .eq('id', id);
        if (produtoError) throw produtoError;

        // Apaga a receita antiga
        const { error: deleteError } = await supabase.from('receitas').delete().eq('produto_id', id);
        if (deleteError) throw deleteError;

        // Insere a nova receita, se houver
        if (receita && receita.length > 0) {
            const receitaParaInserir = receita.map(item => ({
                produto_id: id,
                ingrediente_id: item.ingrediente_id,
                quantidade_usada: item.quantidade_usada
            }));
            const { error: insertError } = await supabase.from('receitas').insert(receitaParaInserir);
            if (insertError) throw insertError;
        }

        res.status(200).json({ message: 'Produto atualizado com sucesso!' });
    } catch (error) {
        console.error("Erro ao atualizar produto:", error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/produtos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Se suas chaves estrangeiras estiverem configuradas com "ON DELETE CASCADE",
        // apagar o produto automaticamente apagará a receita. Mas para garantir:
        await supabase.from('receitas').delete().eq('produto_id', id);
        const { error } = await supabase.from('produtos').delete().eq('id', id);
        if (error) throw error;
        res.status(200).json({ message: 'Produto apagado com sucesso!' });
    } catch (error) {
        console.error("Erro ao apagar produto:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- ROTAS DE RECEITAS ---
app.get('/api/produtos/:id/receita', async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('receitas')
            .select('id, ingrediente_id, quantidade_usada, ingredientes(nome, unidade)')
            .eq('produto_id', id);
        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        console.error('Erro ao buscar receita:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- ROTA DE CATEGORIAS ---
app.get('/api/categorias', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('categorias')
            .select('*')
            .order('ordem');
        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        console.error("Erro ao buscar categorias:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/categorias', async (req, res) => {
    try {
        const { nome, ordem } = req.body;
        const { data, error } = await supabase
            .from('categorias')
            .insert({ nome, ordem })
            .select('id')
            .single();
        if (error) throw error;
        res.status(201).json({ id: data.id, message: 'Categoria criada com sucesso!' });
    } catch (error) {
        console.error("Erro ao criar categoria:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- ROTAS DE PEDIDOS ---
// ATENÇÃO: A lógica de pedidos com controle de estoque é complexa.
// O ideal para garantir 100% de consistência seria criar uma "Database Function" (RPC) no Supabase.
// A conversão abaixo é uma aproximação que funcionará, mas não é uma "transação" atômica.
app.get('/api/pedidos', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pedidos')
            .select('*, itens_do_pedido(*)')
            .order('data_hora', { ascending: false });
        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        console.error('Erro ao buscar pedidos:', error);
        res.status(500).json({ error: error.message });
    }
});

// A ROTA POST DE PEDIDOS É A MAIS COMPLEXA.
// A conversão direta é difícil. Recomendo focar em fazer o resto funcionar primeiro.
// Esta rota precisará ser reescrita com cuidado usando funções do Supabase (RPC) para garantir
// que o estoque não seja deduzido incorretamente.

// --- ROTAS DE ESTOQUE (INGREDIENTES) ---
app.get('/api/ingredientes', async (req, res) => {
    try {
        const { data, error } = await supabase.from('ingredientes').select('*').order('nome');
        if (error) throw error;
        res.status(200).json(data);
    } catch (error) { 
        console.error("Erro ao buscar ingredientes:", error);
        res.status(500).json({ error: 'Erro interno do servidor' }); 
    }
});

app.put('/api/ingredientes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { quantidade_estoque } = req.body;
        const { error } = await supabase
            .from('ingredientes')
            .update({ quantidade_estoque })
            .eq('id', id);
        if (error) throw error;
        res.status(200).json({ message: 'Estoque atualizado com sucesso!' });
    } catch (error) { 
        console.error("Erro ao atualizar estoque:", error);
        res.status(500).json({ error: 'Erro interno ao atualizar estoque.' }); 
    }
});

app.post('/api/ingredientes', async (req, res) => {
    try {
        const { nome, quantidade_estoque, unidade } = req.body;
        const { data, error } = await supabase
            .from('ingredientes')
            .insert({ nome, quantidade_estoque, unidade })
            .select('id')
            .single();
        if (error) throw error;
        res.status(201).json({ message: 'Ingrediente adicionado com sucesso!', id: data.id });
    } catch (error) { 
        console.error("Erro ao adicionar ingrediente:", error);
        res.status(500).json({ error: 'Erro interno do servidor' }); 
    }
});

app.delete('/api/ingredientes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('ingredientes').delete().eq('id', id);
        if (error) throw error;
        res.status(200).json({ message: 'Ingrediente apagado com sucesso!' });
    } catch (error) { 
        console.error("Erro ao apagar ingrediente:", error);
        res.status(500).json({ error: 'Erro interno do servidor' }); 
    }
});

// --- INICIAR SERVIDOR ---
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
