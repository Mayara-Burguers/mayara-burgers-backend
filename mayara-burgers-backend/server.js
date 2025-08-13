
/*
============================================================
|        SERVIDOR BACK-END - MAYARA BURGUER'S              |
|   Versão definitiva com todas as rotas de CRUD           |
|   e tratamento de erro robusto para pedidos.             |
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
            .select('*, categorias!inner(id, nome, permite_adicionais, ordem)')
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
        const { nome, descricao, preco_base, categoria_id, imagem_url, receita } = req.body;
        
        const { data: produtoData, error: produtoError } = await supabase
            .from('produtos')
            .insert({ nome, descricao, preco_base, categoria_id, imagem_url })
            .select('id')
            .single();

        if (produtoError) throw produtoError;
        const produtoId = produtoData.id;

        if (receita && receita.length > 0) {
            const receitaParaInserir = receita.map(item => ({ produto_id: produtoId, ingrediente_id: item.ingrediente_id, quantidade_usada: item.quantidade_usada }));
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
        const { nome, descricao, preco_base, categoria_id, imagem_url, receita } = req.body;

        const { error: produtoError } = await supabase.from('produtos').update({ nome, descricao, preco_base, categoria_id, imagem_url }).eq('id', id);
        if (produtoError) throw produtoError;

        await supabase.from('receitas').delete().eq('produto_id', id);

        if (receita && receita.length > 0) {
            const receitaParaInserir = receita.map(item => ({ produto_id: id, ingrediente_id: item.ingrediente_id, quantidade_usada: item.quantidade_usada }));
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
        await supabase.from('receitas').delete().eq('produto_id', id);
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
        const { nome, ordem, permite_adicionais } = req.body;
        const { data, error } = await supabase.from('categorias').insert({ nome, ordem, permite_adicionais }).select('id').single();
        if (error) throw error;
        res.status(201).json({ id: data.id, message: 'Categoria criada com sucesso!' });
    } catch (error) {
        console.error("Erro ao criar categoria:", error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/categorias/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, ordem, permite_adicionais } = req.body;
        const { error } = await supabase.from('categorias').update({ nome, ordem, permite_adicionais }).eq('id', id);
        if (error) throw error;
        res.status(200).json({ message: 'Categoria atualizada com sucesso!' });
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


// --- ROTAS DE PEDIDOS ---
app.get('/api/pedidos', async (req, res) => {
    try {
        const { data, error } = await supabase.from('pedidos').select('*, itens_do_pedido(*)').order('data_hora', { ascending: false });
        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        console.error('Erro ao buscar pedidos:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/pedidos', async (req, res) => {
    try {
        const dadosDoPedido = req.body;

        if (!dadosDoPedido || !dadosDoPedido.itens || dadosDoPedido.itens.length === 0) {
            return res.status(400).json({ error: 'O pedido está vazio ou é inválido.' });
        }

        const { data, error } = await supabase.rpc('processar_pedido', {
            dados_pedido: dadosDoPedido
        });

        if (error) {
            console.error('Erro retornado pelo RPC do Supabase:', error);
            return res.status(400).json({ error: `Falha ao processar o pedido: ${error.message}` });
        }

        if (data && data.length > 0 && data[0].success) {
            res.status(201).json({
                message: data[0].message,
                pedidoId: data[0].pedidoId
            });
        } else {
            const errorMessage = (data && data.length > 0) ? data[0].message : 'Ocorreu um erro desconhecido no processamento.';
            console.error('RPC falhou com a mensagem:', errorMessage);
            res.status(400).json({ error: `Falha ao processar o pedido: ${errorMessage}` });
        }
    } catch (error) {
        console.error('Erro inesperado na rota /api/pedidos:', error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});


// --- ROTAS DE INGREDIENTES / ESTOQUE ---
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

app.get('/api/adicionais', async (req, res) => {
    try {
        const { data, error } = await supabase.from('ingredientes').select('id, nome, preco_adicional').eq('pode_ser_adicional', true).order('nome');
        if (error) throw error;
        res.status(200).json(data);
    } catch (error) { 
        console.error("Erro ao buscar adicionais:", error);
        res.status(500).json({ error: 'Erro interno do servidor' }); 
    }
});

app.post('/api/ingredientes', async (req, res) => {
    try {
        const { nome, unidade, quantidade_estoque, pode_ser_adicional, preco_adicional, quantidade_descontada } = req.body;
        const { data, error } = await supabase.from('ingredientes').insert({ nome, unidade, quantidade_estoque, pode_ser_adicional, preco_adicional, quantidade_descontada }).select('id').single();
        if (error) throw error;
        res.status(201).json({ message: 'Ingrediente adicionado com sucesso!', id: data.id });
    } catch (error) { 
        console.error("Erro ao adicionar ingrediente:", error);
        res.status(500).json({ error: error.message }); 
    }
});

app.put('/api/ingredientes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, unidade, quantidade_estoque, pode_ser_adicional, preco_adicional, quantidade_descontada } = req.body;
        
        const camposParaAtualizar = { nome, unidade, quantidade_estoque, pode_ser_adicional, preco_adicional, quantidade_descontada };
        camposParaAtualizar.preco_adicional = pode_ser_adicional ? (preco_adicional || 0) : 0;

        const { error } = await supabase.from('ingredientes').update(camposParaAtualizar).eq('id', id);
        if (error) throw error;
        res.status(200).json({ message: 'Ingrediente atualizado com sucesso!' });
    } catch (error) { 
        console.error("Erro ao atualizar ingrediente:", error);
        res.status(500).json({ error: 'Erro interno ao atualizar ingrediente.' }); 
    }
});

app.delete('/api/ingredientes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('ingredientes').delete().eq('id', id);
        if (error) throw error;
        res.status(204).send();
    } catch (error) { 
        console.error("Erro ao apagar ingrediente:", error);
        res.status(500).json({ error: 'Erro interno do servidor' }); 
    }
});


// --- INICIAR SERVIDOR ---
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});

