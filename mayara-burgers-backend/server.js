

/*
============================================================
|        SERVIDOR BACK-END - MAYARA BURGUER'S              |
|   Versão definitiva com sistema flexível de opções       |
|   e todas as rotas de CRUD.                              |
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

app.use(cors());
app.use(express.json());


// --- ROTAS DA APLICAÇÃO ---

app.get('/', (req, res) => {
    res.json({ message: "Servidor da Mayara Burguer's está no ar!" });
});

// --- ROTAS DE PRODUTOS ---
app.get('/api/produtos', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('produtos')
            .select('*, categorias!inner(id, nome, permite_adicionais, ordem, grupo_opcoes_id)')
            .order('ordem', { foreignTable: 'categorias' })
            .order('id', { ascending: true });

        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({ error: error.message });
    }
});

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

app.post('/api/produtos', async (req, res) => {
    try {
        const { nome, descricao, preco_base, categoria_id, imagem_url, receita, opcoes } = req.body;
        
        const { data: pData, error: pError } = await supabase.from('produtos').insert({ nome, descricao, preco_base, categoria_id, imagem_url }).select('id').single();
        if (pError) throw pError;
        const produtoId = pData.id;

        if (receita && receita.length > 0) {
            const rData = receita.map(i => ({ produto_id: produtoId, ingrediente_id: i.ingrediente_id, quantidade_usada: i.quantidade_usada }));
            await supabase.from('receitas').insert(rData);
        }
        if (opcoes && opcoes.length > 0) {
            const oData = opcoes.map(i => ({ produto_id: produtoId, opcao_id: i.opcao_id, preco: i.preco }));
            await supabase.from('produtos_opcoes').insert(oData);
        }
        res.status(201).json({ id: produtoId, message: 'Produto criado!' });
    } catch (error) {
        console.error('Erro ao criar produto:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/produtos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, descricao, preco_base, categoria_id, imagem_url, receita, opcoes } = req.body;

        await supabase.from('produtos').update({ nome, descricao, preco_base, categoria_id, imagem_url }).eq('id', id);
        
        await supabase.from('receitas').delete().eq('produto_id', id);
        if (receita && receita.length > 0) {
            const rData = receita.map(i => ({ produto_id: id, ingrediente_id: i.ingrediente_id, quantidade_usada: i.quantidade_usada }));
            await supabase.from('receitas').insert(rData);
        }
        
        await supabase.from('produtos_opcoes').delete().eq('produto_id', id);
        if (opcoes && opcoes.length > 0) {
            const oData = opcoes.map(i => ({ produto_id: id, opcao_id: i.opcao_id, preco: i.preco }));
            await supabase.from('produtos_opcoes').insert(oData);
        }
        res.status(200).json({ message: 'Produto atualizado!' });
    } catch (error) {
        console.error('Erro ao atualizar produto:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/produtos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await supabase.from('receitas').delete().eq('produto_id', id);
        await supabase.from('produtos_opcoes').delete().eq('produto_id', id);
        const { error } = await supabase.from('produtos').delete().eq('id', id);
        if (error) throw error;
        res.status(204).send();
    } catch (error) {
        console.error("Erro ao apagar produto:", error);
        res.status(500).json({ error: error.message });
    }
});


// --- ROTAS DE CATEGORIAS ---
app.get('/api/categorias', async (req, res) => {
    try {
        const { data, error } = await supabase.from('categorias').select('*').order('ordem');
        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        console.error("Erro ao buscar categorias:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/categorias', async (req, res) => {
    try {
        const { nome, ordem, permite_adicionais, grupo_opcoes_id } = req.body;
        const { data, error } = await supabase.from('categorias').insert({ nome, ordem, permite_adicionais, grupo_opcoes_id: grupo_opcoes_id || null }).select().single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        console.error("Erro ao criar categoria:", error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/categorias/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, ordem, permite_adicionais, grupo_opcoes_id } = req.body;
        const { error } = await supabase.from('categorias').update({ nome, ordem, permite_adicionais, grupo_opcoes_id: grupo_opcoes_id || null }).eq('id', id);
        if (error) throw error;
        res.status(200).json({ message: 'Categoria atualizada!' });
    } catch (error) {
        console.error("Erro ao atualizar categoria:", error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/categorias/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await supabase.from('produtos').update({ categoria_id: null }).eq('categoria_id', id);
        const { error } = await supabase.from('categorias').delete().eq('id', id);
        if (error) throw error;
        res.status(204).send();
    } catch (error) {
        console.error("Erro ao apagar categoria:", error);
        res.status(500).json({ error: error.message });
    }
});


// --- ROTAS DE GRUPOS DE OPÇÕES E OPÇÕES ---
app.get('/api/grupos_opcoes', async (req, res) => {
    try {
        const { data, error } = await supabase.from('grupos_opcoes').select('*, opcoes(*)').order('nome');
        if (error) throw error;
        res.status(200).json(data);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/grupos_opcoes', async (req, res) => {
    try {
        const { nome } = req.body;
        const { data, error } = await supabase.from('grupos_opcoes').insert({ nome }).select().single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/grupos_opcoes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await supabase.from('categorias').update({ grupo_opcoes_id: null }).eq('grupo_opcoes_id', id);
        const { error } = await supabase.from('grupos_opcoes').delete().eq('id', id);
        if (error) throw error;
        res.status(204).send();
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/opcoes', async (req, res) => {
    try {
        const { nome, grupo_id } = req.body;
        const { data, error } = await supabase.from('opcoes').insert({ nome, grupo_id }).select().single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/opcoes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('opcoes').delete().eq('id', id);
        if (error) throw error;
        res.status(204).send();
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/produtos/:id/opcoes', async (req, res) => {
    try {
        const { id } = req.params;
        const { data: produto, error: produtoError } = await supabase.from('produtos').select('categorias(grupo_opcoes_id, grupos_opcoes(nome))').eq('id', id).single();
        if (produtoError || !produto.categorias || !produto.categorias.grupo_opcoes_id) {
             return res.status(200).json(null);
        }
        
        const { data, error } = await supabase.from('produtos_opcoes').select('preco, opcoes(id, nome)').eq('produto_id', id);
        if (error) throw error;

        res.status(200).json({
            grupo_nome: produto.categorias.grupos_opcoes.nome,
            opcoes: data.map(item => ({ id: item.opcoes.id, nome: item.opcoes.nome, preco: item.preco }))
        });
    } catch (error) { res.status(500).json({ error: error.message }); }
});


// --- ROTAS DE PEDIDOS ---
app.get('/api/pedidos', async (req, res) => { /* ...código sem alteração... */ });
app.post('/api/pedidos', async (req, res) => { /* ...código sem alteração... */ });

// --- ROTAS DE INGREDIENTES / ESTOQUE ---
app.get('/api/ingredientes', async (req, res) => { /* ...código sem alteração... */ });
app.get('/api/adicionais', async (req, res) => { /* ...código sem alteração... */ });
app.post('/api/ingredientes', async (req, res) => { /* ...código sem alteração... */ });
app.put('/api/ingredientes/:id', async (req, res) => { /* ...código sem alteração... */ });
app.delete('/api/ingredientes/:id', async (req, res) => { /* ...código sem alteração... */ });


app.listen(port, () => console.log(`Servidor rodando na porta ${port}`));
