/*
================================================================================
| SERVIDOR BACKEND COMPLETO - MAYARA BURGUER'S (VERSÃO CORRIGIDA)              |
| - Nomes das tabelas ajustados para minúsculas.                               |
| - Rota de produtos simplificada para garantir funcionamento.                 |
================================================================================
*/

// --- 1. IMPORTAÇÕES E CONFIGURAÇÕES INICIAIS ---
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3001;

// --- 2. MIDDLEWARES ---

// Configuração do CORS para permitir acesso do seu site no Netlify
const corsOptions = {
  origin: 'https://mayara-burguers.netlify.app',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Permite que o servidor entenda JSON no corpo das requisições
app.use(express.json());

// --- 3. CONEXÃO COM O SUPABASE ---
// Pega as chaves das variáveis de ambiente configuradas no Render
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Cria o cliente Supabase, forçando o uso de IPv4 para evitar erros no Render
const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    host: 'db.sjaozedoputohsyqegbf.supabase.co',
    family: 4
  }
});

// --- 4. ROTAS DA API ---

// Rota de teste
app.get('/', (req, res) => {
    res.json({ message: "Servidor da Mayara Burguer's está no ar e conectado ao Supabase!" });
});

// --- ROTAS DE PRODUTOS ---
app.get('/api/produtos', async (req, res) => {
    try {
        // Passo 1: Pega todas as categorias e cria um mapa para consulta rápida
        const { data: categorias, error: categoriasError } = await supabase
            .from('categorias')
            .select('id, nome');
        if (categoriasError) throw categoriasError;
        
        const mapaCategorias = new Map();
        for (const cat of categorias) {
            mapaCategorias.set(cat.id, cat.nome);
        }

        // Passo 2: Pega todos os produtos
        const { data: produtos, error: produtosError } = await supabase
            .from('produtos')
            .select('*')
            .order('id', { ascending: true });
        if (produtosError) throw produtosError;

        // Passo 3: Junta as informações no código
        const produtosComCategoria = produtos.map(produto => ({
            ...produto, // Copia todas as informações do produto
            categoria_nome: mapaCategorias.get(produto.categoria_id) || 'Sem Categoria' // Adiciona o nome da categoria
        }));

        res.status(200).json(produtosComCategoria);
    } catch (error) {
        console.error('Erro ao buscar produtos:', error.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});


app.post('/api/produtos', async (req, res) => {
    try {
        const { nome, descricao, preco_base, categoria_id, subcategoria, preco_pao_especial, preco_pao_baby, imagem_url, receita } = req.body;
        if (!nome || !preco_base || !categoria_id) {
            return res.status(400).json({ error: 'Nome, preço e categoria são obrigatórios.' });
        }

        const { data: produtoData, error: produtoError } = await supabase
            .from('produtos')
            .insert([{ nome, descricao, preco_base, categoria_id, subcategoria, preco_pao_especial, preco_pao_baby, imagem_url: imagem_url || 'placeholder.jpg' }])
            .select()
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
        console.error("Erro ao criar produto:", error.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.put('/api/produtos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, descricao, preco_base, categoria_id, subcategoria, preco_pao_especial, preco_pao_baby, imagem_url, receita } = req.body;

        const { error: produtoError } = await supabase
            .from('produtos')
            .update({ nome, descricao, preco_base, categoria_id, subcategoria, preco_pao_especial, preco_pao_baby, imagem_url: imagem_url || 'placeholder.jpg' })
            .eq('id', id);
        if (produtoError) throw produtoError;

        const { error: deleteError } = await supabase.from('receitas').delete().eq('produto_id', id);
        if (deleteError) throw deleteError;

        if (receita && receita.length > 0) {
            const receitaParaInserir = receita.map(item => ({
                produto_id: id,
                ingrediente_id: item.ingrediente_id,
                quantidade_usada: item.quantidade_usada
            }));
            const { error: receitaError } = await supabase.from('receitas').insert(receitaParaInserir);
            if (receitaError) throw receitaError;
        }
        res.status(200).json({ message: 'Produto atualizado com sucesso!' });
    } catch (error) {
        console.error("Erro ao atualizar produto:", error.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.delete('/api/produtos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('produtos').delete().eq('id', id);
        if (error) throw error;
        res.status(200).json({ message: 'Produto apagado com sucesso!' });
    } catch (error) {
        console.error("Erro ao apagar produto:", error.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// --- ROTA DE RECEITAS ---
app.get('/api/produtos/:id/receita', async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('receitas')
            .select('*, ingrediente_nome:ingredientes(nome, unidade)')
            .eq('produto_id', id);
        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        console.error('Erro ao buscar receita:', error.message);
        res.status(500).json({ error: 'Erro ao buscar receita' });
    }
});

// --- ROTA DE CATEGORIAS ---
app.get('/api/categorias', async (req, res) => {
    try {
        const { data, error } = await supabase.from('categorias').select('*').order('ordem');
        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        console.error("Erro ao buscar categorias:", error.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.post('/api/categorias', async (req, res) => {
    try {
        const { nome, ordem } = req.body;
        const { data, error } = await supabase.from('categorias').insert([{ nome, ordem }]).select().single();
        if (error) throw error;
        res.status(201).json({ id: data.id, message: 'Categoria criada com sucesso!' });
    } catch (error) {
        console.error("Erro ao criar categoria:", error.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});


// --- ROTAS DE PEDIDOS ---
app.post('/api/pedidos', async (req, res) => {
    const { cliente_nome, cliente_telefone, cliente_endereco, tipo_entrega, valor_total, itens, saches_alho, molhos } = req.body;

    try {
        for (const item of itens) {
            const { data: produtoInfo, error: produtoError } = await supabase
                .from('produtos')
                .select('id, categoria:categorias(nome)')
                .eq('nome', item.name)
                .single();

            if (produtoError || !produtoInfo) continue;
            if (produtoInfo.categoria.nome === 'Bebidas') continue;

            const { data: receita, error: receitaError } = await supabase
                .from('receitas')
                .select('*')
                .eq('produto_id', produtoInfo.id);

            if (receitaError || receita.length === 0) continue;

            for (const ingredienteDaReceita of receita) {
                const quantidadeADeduzir = ingredienteDaReceita.quantidade_usada * item.quantity;
                const { error: estoqueError } = await supabase.rpc('deduzir_estoque', {
                    ingrediente_id_param: ingredienteDaReceita.ingrediente_id,
                    quantidade_param: quantidadeADeduzir
                });
                if (estoqueError) throw new Error(`Estoque insuficiente para um dos ingredientes de ${item.name}.`);
            }
        }

        const { data: pedidoData, error: pedidoError } = await supabase
            .from('pedidos')
            .insert([{ cliente_nome, cliente_telefone, cliente_endereco, tipo_entrega, valor_total, saches_alho, molhos }])
            .select()
            .single();

        if (pedidoError) throw pedidoError;
        const novoPedidoId = pedidoData.id;

        const itensParaInserir = itens.map(item => ({
            pedido_id: novoPedidoId,
            produto_nome: item.name,
            quantidade: item.quantity,
            preco_unitario: item.price,
            observacoes: item.notes,
            adicionais: item.extras ? item.extras.join(', ') : null
        }));
        const { error: itensError } = await supabase.from('itens_do_pedido').insert(itensParaInserir);
        if (itensError) throw itensError;

        res.status(201).json({ message: 'Pedido criado com sucesso!', pedidoId: novoPedidoId });

    } catch (error) {
        console.error('Erro ao criar o pedido:', error.message);
        res.status(500).json({ error: `Falha ao processar o pedido: ${error.message}` });
    }
});

app.get('/api/pedidos', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pedidos')
            .select('*, itens_do_pedido(*)')
            .order('data_hora', { ascending: false });

        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        console.error('Erro ao buscar pedidos:', error.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.put('/api/pedidos/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const { error } = await supabase.from('pedidos').update({ status }).eq('id', id);
        if (error) throw error;
        res.status(200).json({ message: 'Status do pedido atualizado com sucesso!' });
    } catch (error) {
        console.error('Erro ao atualizar status do pedido:', error.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});


// --- ROTAS DE ESTOQUE (INGREDIENTES) ---
app.get('/api/ingredientes', async (req, res) => {
    try {
        const { data, error } = await supabase.from('ingredientes').select('*').order('nome');
        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        console.error('Erro ao buscar ingredientes:', error.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.put('/api/ingredientes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { quantidade_estoque } = req.body;
        const { error } = await supabase.from('ingredientes').update({ quantidade_estoque }).eq('id', id);
        if (error) throw error;
        res.status(200).json({ message: 'Estoque atualizado com sucesso!' });
    } catch (error) {
        console.error('Erro ao atualizar estoque:', error.message);
        res.status(500).json({ error: 'Erro interno ao atualizar estoque.' });
    }
});

app.post('/api/ingredientes', async (req, res) => {
    try {
        const { nome, quantidade_estoque, unidade } = req.body;
        const { data, error } = await supabase.from('ingredientes').insert([{ nome, quantidade_estoque, unidade }]).select().single();
        if (error) throw error;
        res.status(201).json({ message: 'Ingrediente adicionado com sucesso!', id: data.id });
    } catch (error) {
        console.error('Erro ao adicionar ingrediente:', error.message);
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
        console.error('Erro ao apagar ingrediente:', error.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// --- 5. INICIAR O SERVIDOR ---
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
