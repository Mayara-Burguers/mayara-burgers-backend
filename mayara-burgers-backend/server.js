
/*
============================================================
|        SERVIDOR BACK-END - MAYARA BURGUER'S              |
|   Versão final com rota de pedidos e ordenação corrigida.|
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
            .select('*, categorias!inner(nome, permite_adicionais, ordem)') // CORREÇÃO AQUI
            .order('ordem', { foreignTable: 'categorias' }) // E AQUI
            .order('id', { ascending: true });

        if (error) throw error;
        
        // Simplifica a estrutura do objeto para facilitar o front-end
        const produtosFormatados = data.map(p => ({
            ...p,
            categorias: p.categorias // Mantém o objeto de categoria intacto
        }));

        res.status(200).json(produtosFormatados);
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({ error: error.message });
    }
});


app.post('/api/produtos', async (req, res) => {
    try {
        const { nome, descricao, preco_base, categoria_id, imagem_url, receita } = req.body;
        if (!nome || !preco_base || !categoria_id) {
            return res.status(400).json({ error: 'Nome, preço e categoria são obrigatórios.' });
        }
        
        const { data: produtoData, error: produtoError } = await supabase
            .from('produtos')
            .insert({ nome, descricao, preco_base, categoria_id, imagem_url })
            .select('id')
            .single();

        if (produtoError) throw produtoError;
        const produtoId = produtoData.id;

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
        const { nome, descricao, preco_base, categoria_id, imagem_url, receita } = req.body;

        const { error: produtoError } = await supabase
            .from('produtos')
            .update({ nome, descricao, preco_base, categoria_id, imagem_url })
            .eq('id', id);
        if (produtoError) throw produtoError;

        await supabase.from('receitas').delete().eq('produto_id', id);

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

app.post('/api/pedidos', async (req, res) => {
    try {
        const dadosDoPedido = req.body;
        const { data, error } = await supabase.rpc('processar_pedido', {
            dados_pedido: dadosDoPedido
        });

        if (error) {
            throw new Error(`Erro no RPC do banco de dados: ${error.message}`);
        }
        if (data.success) {
            res.status(201).json({
                message: 'Pedido criado com sucesso!',
                pedidoId: data.pedidoId
            });
        } else {
            res.status(400).json({ error: `Falha ao processar o pedido: ${data.message}` });
        }
    } catch (error) {
        console.error('Erro na rota /api/pedidos:', error.message);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});


// --- ROTAS DE ESTOQUE E ADICIONAIS ---
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
        const { data, error } = await supabase
            .from('ingredientes')
            .select('id, nome, preco_adicional')
            .eq('pode_ser_adicional', true)
            .order('nome');

        if (error) throw error;
        res.status(200).json(data);
    } catch (error) { 
        console.error("Erro ao buscar adicionais:", error);
        res.status(500).json({ error: 'Erro interno do servidor' }); 
    }
});

// Encontre esta rota no seu server.js e substitua pela versão abaixo
app.put('/api/ingredientes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Agora pegamos todos os campos do corpo da requisição
        const { 
            nome, 
            unidade, 
            quantidade_estoque, 
            pode_ser_adicional, 
            preco_adicional,
            quantidade_descontada // Novo campo
        } = req.body;

        // Monta o objeto de atualização apenas com os campos fornecidos
        const camposParaAtualizar = {};
        if (nome !== undefined) camposParaAtualizar.nome = nome;
        if (unidade !== undefined) camposParaAtualizar.unidade = unidade;
        if (quantidade_estoque !== undefined) camposParaAtualizar.quantidade_estoque = quantidade_estoque;
        if (pode_ser_adicional !== undefined) camposParaAtualizar.pode_ser_adicional = pode_ser_adicional;
        // Se pode ser adicional, atualiza o preço, caso contrário, zera o preço.
        camposParaAtualizar.preco_adicional = pode_ser_adicional ? (preco_adicional || 0) : 0;
        if (quantidade_descontada !== undefined) camposParaAtualizar.quantidade_descontada = quantidade_descontada;

        const { error } = await supabase
            .from('ingredientes')
            .update(camposParaAtualizar)
            .eq('id', id);
            
        if (error) throw error;
        
        res.status(200).json({ message: 'Ingrediente atualizado com sucesso!' });
    } catch (error) { 
        console.error("Erro ao atualizar ingrediente:", error);
        res.status(500).json({ error: 'Erro interno ao atualizar ingrediente.' }); 
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

