/*
============================================================
| JAVASCRIPT FINAL E COMPLETO - MAYARA BURGUER'S           |
| Adicionais carregados via API e lógica do modal corrigida.|
============================================================
*/
document.addEventListener("DOMContentLoaded", async () => {

    // 1. ELEMENTOS E DADOS GLOBAIS
    const BASE_URL = 'https://mayara-backend-servidor.onrender.com';

    const menuContainer = document.getElementById('menu-container');
    const navContainer = document.getElementById('nav-categorias');
    const modalGenericoEl = document.getElementById('modalGenerico');
    const modalGenerico = new bootstrap.Modal(modalGenericoEl);

    // Variáveis globais para guardar os dados vindos do servidor
    let todosOsProdutos = [];
    let listaDeAdicionais = []; // A lista agora virá da API

    // 2. DELEGAÇÃO DE EVENTOS
    menuContainer.addEventListener('click', (e) => {
        const btnPersonalize = e.target.closest('.btn-personalize');
        const btnSimpleAdd = e.target.closest('.simple-add-btn');

        if (btnPersonalize) {
            const produtoId = parseInt(btnPersonalize.dataset.productId);
            const produto = todosOsProdutos.find(p => p.id === produtoId);
            if (produto) preencherEabrirModal(produto);
        }

        if (btnSimpleAdd) {
            const itemData = JSON.parse(btnSimpleAdd.dataset.item);
            adicionarAoCarrinho({ name: itemData.nome, price: itemData.preco, quantity: 1, extras: [], notes: '' });
        }
    });

    navContainer.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link) {
            e.preventDefault();
            navContainer.querySelectorAll('a').forEach(el => el.classList.remove('active'));
            link.classList.add('active');
            menuContainer.querySelectorAll('.categoria').forEach(cat => cat.style.display = 'none');
            const destino = document.querySelector(link.getAttribute('href'));
            if (destino) destino.style.display = 'block';
        }
    });

    const btnCarrinho = document.getElementById("icone-carrinho");
    const areaCarrinho = document.getElementById("area-carrinho");
    if (btnCarrinho) {
        btnCarrinho.addEventListener("click", () => {
            areaCarrinho.style.display = areaCarrinho.style.display === "block" ? "none" : "block";
        });
    }

    // 3. CARREGAMENTO DE DADOS
    async function carregarDadosIniciais() {
        try {
            const [responseProdutos, responseAdicionais] = await Promise.all([
                fetch(`${BASE_URL}/api/produtos`),
                fetch(`${BASE_URL}/api/adicionais`)
            ]);

            if (!responseProdutos.ok) throw new Error(`Erro ao buscar produtos: ${responseProdutos.statusText}`);
            if (!responseAdicionais.ok) throw new Error(`Erro ao buscar adicionais: ${responseAdicionais.statusText}`);
            
            todosOsProdutos = await responseProdutos.json();
            listaDeAdicionais = await responseAdicionais.json();

            renderizarMenu();

        } catch (error) {
            console.error("Erro ao carregar dados iniciais:", error);
            menuContainer.innerHTML = `<p class='text-center text-danger'>FALHA AO CARREGAR O CARDÁPIO. Verifique a conexão. Detalhes: ${error.message}</p>`;
        }
    }
    
    function renderizarMenu() {
        const categorias = todosOsProdutos.reduce((acc, produto) => {
            const catNome = produto.categorias ? produto.categorias.nome : 'Sem Categoria';
            (acc[catNome] = acc[catNome] || []).push(produto);
            return acc;
        }, {});

        menuContainer.innerHTML = '';
        navContainer.innerHTML = '';
        
        const chavesOrdenadas = Object.keys(categorias).sort((a, b) => {
            const produtoA = categorias[a][0];
            const produtoB = categorias[b][0];
            const ordemA = produtoA.categorias ? produtoA.categorias.ordem : 99;
            const ordemB = produtoB.categorias ? produtoB.categorias.ordem : 99;
            return ordemA - ordemB;
        });
        
        let first = true;
        for (const nomeCategoria of chavesOrdenadas) {
            const slug = nomeCategoria.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            navContainer.innerHTML += `<a href="#${slug}" class="btn btn-orange ${first ? 'active' : ''}">${nomeCategoria}</a>`;
            
            const section = document.createElement('section');
            section.id = slug;
            section.className = 'categoria';
            if (!first) section.style.display = 'none';

            let produtosHtml = `<h2 class="text-center mb-4">${nomeCategoria}</h2>`;

            if (nomeCategoria === 'Bebidas' || nomeCategoria === 'Pastéis') {
                 const subcategorias = categorias[nomeCategoria].reduce((acc, produto) => {
                    const subcatNome = produto.subcategoria || 'Outros';
                    (acc[subcatNome] = acc[subcatNome] || []).push(produto);
                    return acc;
                }, {});

                for (const nomeSubcat in subcategorias) {
                    produtosHtml += `<h4 class="text-center text-muted mb-3 mt-4">${nomeSubcat}</h4><div class="row g-4">`;
                    subcategorias[nomeSubcat].forEach(produto => {
                        produtosHtml += criarCardProduto(produto);
                    });
                    produtosHtml += `</div>`;
                }
            } else {
                produtosHtml += `<div class="row g-4">`;
                categorias[nomeCategoria].forEach(produto => {
                    produtosHtml += criarCardProduto(produto);
                });
                produtosHtml += `</div>`;
            }

            section.innerHTML = produtosHtml;
            menuContainer.appendChild(section);
            first = false;
        }
    }

    function criarCardProduto(produto) {
        const nomeCategoria = produto.categorias ? produto.categorias.nome : '';

        const buttonHtml = nomeCategoria === 'Bebidas'
            ? `<button class="btn btn-sm btn-orange simple-add-btn" data-item='${JSON.stringify({ nome: produto.nome, preco: produto.preco_base })}'>Adicionar</button>`
            : `<button class="btn btn-sm btn-orange btn-personalize" data-product-id="${produto.id}"><i class="fas fa-utensils"></i> Personalizar</button>`;
        
        return `<div class="col-md-6 col-lg-4"><div class="card item h-100"><img src="${produto.imagem_url || 'placeholder.jpg'}" class="card-img-top" alt="${produto.nome}"><div class="card-body d-flex flex-column"><h3 class="card-title">${produto.nome}</h3><p class="card-text">${produto.descricao || ''}</p><div class="d-flex justify-content-between align-items-center mt-auto"><span class="price">${parseFloat(produto.preco_base).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>${buttonHtml}</div></div></div></div>`;
    }

    // 4. LÓGICA DO MODAL
    function preencherEabrirModal(produto) {
        const modalBody = modalGenericoEl.querySelector('.modal-body');
        modalGenericoEl.querySelector('.nome-lanche').textContent = produto.nome;
        
        const categoriaInfo = produto.categorias;
        
        let htmlPao = (categoriaInfo && (categoriaInfo.nome === 'Lanches' || categoriaInfo.nome === 'Hambúrgueres'))
            ? `<div class="option-group"><div class="option-title"><i class="fas fa-bread-slice"></i> Tipo de Pão</div><div class="form-check"><input class="form-check-input" type="radio" name="paoGenerico" id="paoPadrao" value="${produto.preco_base}" checked data-nome="Pão de Hambúrguer"><label class="form-check-label" for="paoPadrao">Pão de Hambúrguer (Padrão) - ${parseFloat(produto.preco_base).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</label></div>${produto.preco_pao_especial ? `<div class="form-check"><input class="form-check-input" type="radio" name="paoGenerico" id="paoFrances" value="${produto.preco_pao_especial}" data-nome="Pão Francês"><label class="form-check-label" for="paoFrances">Pão Francês - ${parseFloat(produto.preco_pao_especial).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</label></div><div class="form-check"><input class="form-check-input" type="radio" name="paoGenerico" id="paoEspecial" value="${produto.preco_pao_especial}" data-nome="Pão Especial"><label class="form-check-label" for="paoEspecial">Pão Especial - ${parseFloat(produto.preco_pao_especial).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</label></div>` : ''}${produto.preco_pao_baby ? `<div class="form-check"><input class="form-check-input" type="radio" name="paoGenerico" id="paoBaby" value="${produto.preco_pao_baby}" data-nome="Pão Baby"><label class="form-check-label" for="paoBaby">Pão Baby - ${parseFloat(produto.preco_pao_baby).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</label></div>` : ''}</div>`
            : '';

        let htmlAdicionais = '';
        if (categoriaInfo && categoriaInfo.permite_adicionais === true && listaDeAdicionais.length > 0) {
            htmlAdicionais = `<div class="option-group"><div class="option-title"><i class="fas fa-plus-circle"></i> Adicionais</div><p class="text-muted small mb-2">Limite de 10 adicionais no total.</p><div class="adicional-section">`;
            listaDeAdicionais.forEach((adicional, index) => {
                const precoAdicional = parseFloat(adicional.preco_adicional || 0);
                htmlAdicionais += `<div class="adicional-item"><input type="checkbox" class="form-check-input adicional-checkbox" id="adicional-${produto.id}-${index}"><label for="adicional-${produto.id}-${index}" class="form-check-label">${adicional.nome} <span class="price-change">+${precoAdicional.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></label><input type="number" class="form-control adicional-quantidade" min="0" value="0" data-nome="${adicional.nome}" data-price="${precoAdicional}" disabled></div>`;
            });
            htmlAdicionais += `</div></div>`;
        }
        
        let htmlObservacoes = `<div class="option-group"><div class="option-title"><i class="fas fa-edit"></i> Observações</div><textarea class="observacoes-textarea form-control" placeholder="Ex: Sem cebola..."></textarea></div>`;
        
        modalBody.innerHTML = htmlPao + htmlAdicionais + htmlObservacoes + `<div class="current-price">Total: R$ <span class="preco-final">0,00</span></div>`;
        
        if (!htmlPao) {
            modalGenericoEl.dataset.baseprice = produto.preco_base;
        }
        
        atualizarPreco(modalGenericoEl);
        modalGenerico.show();
    }
    
    function contarAdicionais(modal) {
        let total = 0;
        modal.querySelectorAll('.adicional-quantidade').forEach(input => {
            total += parseInt(input.value) || 0;
        });
        return total;
    }

    modalGenericoEl.addEventListener('change', e => {
        if (e.target.matches('.adicional-checkbox, input[name="paoGenerico"]')) {
            if (e.target.matches('.adicional-checkbox')) {
                const quantidadeInput = e.target.nextElementSibling.nextElementSibling;
                if (e.target.checked) {
                    if (contarAdicionais(modalGenericoEl) >= 10) {
                        e.target.checked = false;
                        alert("Você pode escolher no máximo 10 adicionais!");
                        return;
                    }
                    quantidadeInput.disabled = false;
                    quantidadeInput.value = 1;
                } else {
                    quantidadeInput.disabled = true;
                    quantidadeInput.value = 0;
                }
            }
            atualizarPreco(modalGenericoEl);
        }
    });

    modalGenericoEl.addEventListener('input', e => {
        if (e.target.matches('.adicional-quantidade')) {
            const inputAtual = e.target;
            let totalAtual = contarAdicionais(modalGenericoEl);

            if (totalAtual > 10) {
                alert("Limite de 10 adicionais atingido!");
                const excedente = totalAtual - 10;
                inputAtual.value = Math.max(0, parseInt(inputAtual.value) - excedente);
            }
        }
        atualizarPreco(modalGenericoEl);
    });

    function atualizarPreco(modal) {
        const paoSelecionado = modal.querySelector('input[name="paoGenerico"]:checked');
        let total = paoSelecionado ? parseFloat(paoSelecionado.value) : parseFloat(modal.dataset.baseprice || 0);

        modal.querySelectorAll('.adicional-item').forEach(item => {
             total += (parseInt(item.querySelector('.adicional-quantidade').value) || 0) * (parseFloat(item.querySelector('.adicional-quantidade').dataset.price) || 0);
        });
        modal.querySelector('.preco-final').textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    // 5. GESTÃO DO CARRINHO
    function adicionarAoCarrinho(item) {
        const carrinho = JSON.parse(localStorage.getItem("cart")) || [];
        carrinho.push(item);
        localStorage.setItem("cart", JSON.stringify(carrinho));
        alert(`${item.name} adicionado ao carrinho!`);
        renderizarCarrinho();
    }
    
    document.querySelector('#modalGenerico .btn-add-custom').addEventListener('click', function () {
        const modal = this.closest('.modal-personalizacao');
        const nomeProduto = modal.querySelector('.nome-lanche').textContent.trim();
        const preco = parseFloat(modal.querySelector('.preco-final').textContent.replace(/[^\d,]/g, '').replace(',', '.'));
        const paoEl = modal.querySelector('input[name="paoGenerico"]:checked');
        const pao = paoEl ? paoEl.dataset.nome : 'Padrão';
        const adicionais = Array.from(modal.querySelectorAll('.adicional-quantidade')).filter(i => i.value > 0).map(i => `${i.value}x ${i.dataset.nome}`);
        const observacoesTextarea = modal.querySelector('.observacoes-textarea');
        const notes = observacoesTextarea ? observacoesTextarea.value.trim() : '';
        adicionarAoCarrinho({ name: nomeProduto, bread: pao, extras: adicionais, notes, quantity: 1, price: preco });
        modalGenerico.hide();
    });
    
    function renderizarCarrinho() {
        const container = document.getElementById("carrinho-itens");
        const totalSpan = document.getElementById("total-carrinho");
        const carrinho = JSON.parse(localStorage.getItem("cart")) || [];
        let total = 0;
        
        container.innerHTML = carrinho.length === 0 ? '<p class="text-muted">Seu carrinho está vazio.</p>' : '';
        if (carrinho.length > 0) {
            let tabela = `<table class="table"><thead><tr><th>Item</th><th>Qtd</th><th>Preço</th><th></th></tr></thead><tbody>`;
            carrinho.forEach((item, index) => {
                total += item.price * item.quantity;
                tabela += `<tr><td><strong>${item.name}</strong><br>${(item.bread && item.bread !== 'Padrão') ? `<small>Pão: ${item.bread}</small><br>` : ''}${item.extras?.length > 0 ? `<small>+ ${item.extras.join(", ")}</small><br>` : ''}${item.notes ? `<small>Obs: ${item.notes}</small><br>` : ''}</td><td>${item.quantity}</td><td>${item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td><button class="btn btn-sm btn-danger btn-remover" data-index="${index}">🗑️</button></td></tr>`;
            });
            tabela += `</tbody></table>`;
            container.innerHTML = tabela;
        }
        
        const sacheQtd = parseInt(localStorage.getItem("sachesAlho")) || 0;
        if (sacheQtd > 0) {
            const alhoPrecoTotal = sacheQtd * 1.00;
            total += alhoPrecoTotal;
            container.innerHTML += `<div class="mt-2" style="border-top: 1px dashed #ccc; padding-top: 10px;"><strong>Sachês de Alho:</strong> ${sacheQtd} x R$ 1,00 = ${alhoPrecoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>`;
        }
        
        totalSpan.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        atualizarQuantidadeIcone();
    }
    
    document.getElementById("carrinho-itens").addEventListener('click', (e) => {
        if(e.target.closest('.btn-remover')) {
            const index = parseInt(e.target.closest('.btn-remover').dataset.index);
            const carrinho = JSON.parse(localStorage.getItem("cart"));
            carrinho.splice(index, 1);
            localStorage.setItem("cart", JSON.stringify(carrinho));
            renderizarCarrinho();
        }
    });

    function atualizarQuantidadeIcone() {
        const carrinho = JSON.parse(localStorage.getItem("cart")) || [];
        document.getElementById("carrinho-quantidade").textContent = carrinho.reduce((soma, item) => soma + item.quantity, 0);
    }
    
    // 6. GESTÃO DE CLIENTE E FINALIZAÇÃO
    (function setupFinalizacao() {
        const modalClienteEl = document.getElementById("modalDadosCliente");
        if (!modalClienteEl) return; // Sai se o modal de cliente não existir
        const modalCliente = new bootstrap.Modal(modalClienteEl);
        const deliveryRadio = document.getElementById("entregaDelivery");
        const retiradaRadio = document.getElementById("entregaRetirada");
        const campoEndereco = document.getElementById("campo-endereco-wrapper");
        const incluirMolhosCheckbox = document.getElementById("incluirMolhos");
        const opcoesMolhosIndividuais = document.getElementById("opcoesMolhosIndividuais");
        const quantidadeAlhoInput = document.getElementById("quantidadeAlho");

        function atualizarVisibilidadeEndereco() {
            if (!campoEndereco) return;
            const tipoEntrega = localStorage.getItem("tipoEntrega") || 'delivery';
            if (tipoEntrega === 'retirada') {
                campoEndereco.style.display = "none";
                if(document.getElementById("inputEnderecoCliente")) document.getElementById("inputEnderecoCliente").required = false;
            } else {
                campoEndereco.style.display = "block";
                if(document.getElementById("inputEnderecoCliente")) document.getElementById("inputEnderecoCliente").required = true;
            }
        }

        if (deliveryRadio && retiradaRadio) {
            [deliveryRadio, retiradaRadio].forEach(radio => {
                radio.addEventListener("change", function () {
                    if (this.checked) localStorage.setItem("tipoEntrega", this.value);
                    atualizarVisibilidadeEndereco();
                });
            });
            const tipoEntregaSalvo = localStorage.getItem("tipoEntrega") || 'delivery';
            if (tipoEntregaSalvo === 'retirada') retiradaRadio.checked = true;
            else deliveryRadio.checked = true;
            atualizarVisibilidadeEndereco();
        }
        
        function verificarDadosCliente() {
            const nomeSalvo = localStorage.getItem("nomeCliente");
            const telefoneSalvo = localStorage.getItem("telefoneCliente");
            const enderecoSalvo = localStorage.getItem("enderecoCliente");
            const precisaEndereco = (localStorage.getItem("tipoEntrega") || 'delivery') === 'delivery';

            if (!nomeSalvo || !telefoneSalvo || (precisaEndereco && !enderecoSalvo)) {
                modalCliente.show();
                return false;
            }
            return true;
        }
        
        document.getElementById("btnSalvarCliente")?.addEventListener("click", () => {
            const nome = document.getElementById("inputNomeCliente").value.trim();
            const telefone = document.getElementById("inputTelefoneCliente").value.trim();
            const endereco = document.getElementById("inputEnderecoCliente").value.trim();
            const tipoEntregaAtual = localStorage.getItem("tipoEntrega") || 'delivery';
            if (!nome || !telefone || (tipoEntregaAtual === 'delivery' && !endereco)) {
                alert("Preencha todos os campos obrigatórios.");
                return;
            }
            localStorage.setItem("nomeCliente", nome);
            localStorage.setItem("telefoneCliente", telefone);
            if (tipoEntregaAtual === 'delivery') localStorage.setItem("enderecoCliente", endereco);
            else localStorage.removeItem("enderecoCliente");
            modalCliente.hide();
            document.getElementById("btn-enviar-whatsapp").click();
        });

        document.getElementById("btn-enviar-whatsapp")?.addEventListener("click", async () => {
            if (!verificarDadosCliente()) return;

            const carrinho = JSON.parse(localStorage.getItem("cart")) || [];
            const sachesAlho = parseInt(localStorage.getItem("sachesAlho")) || 0;

            if (carrinho.length === 0 && sachesAlho === 0) {
                return alert("Seu carrinho está vazio!");
            }
            
            let totalValue = carrinho.reduce((acc, item) => acc + (item.price * item.quantity), 0);
            totalValue += sachesAlho * 1.00;
            
            const molhosSelecionados = [];
            if (localStorage.getItem("molhoKetchup") === "true") molhosSelecionados.push("Ketchup");
            if (localStorage.getItem("molhoMostarda") === "true") molhosSelecionados.push("Mostarda");
            if (localStorage.getItem("molhoMaionese") === "true") molhosSelecionados.push("Maionese");

            const pedidoParaEnviar = {
                cliente_nome: localStorage.getItem("nomeCliente"),
                cliente_telefone: localStorage.getItem("telefoneCliente"),
                tipo_entrega: localStorage.getItem("tipoEntrega") || 'delivery',
                cliente_endereco: localStorage.getItem("enderecoCliente") || null,
                itens: carrinho,
                valor_total: totalValue,
                saches_alho: sachesAlho,
                molhos: molhosSelecionados.join(', ') || null
            };
            
            try {
                const response = await fetch(`${BASE_URL}/api/pedidos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(pedidoParaEnviar)
                });
                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || 'Falha ao registrar o pedido.');
                }
                
                const resultado = await response.json();
                alert(`Seu pedido Nº ${resultado.pedidoId} foi recebido!`);

                const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
                let mensagemWhats = `*Novo Pedido: Nº ${resultado.pedidoId}*%0A*Data/Hora:* ${dataHora}%0A%0A*Cliente:* ${pedidoParaEnviar.cliente_nome}%0A`;

                if (pedidoParaEnviar.tipo_entrega === 'delivery') {
                    mensagemWhats += `*Endereço de Entrega:* ${pedidoParaEnviar.cliente_endereco}%0A`;
                } else {
                    mensagemWhats += `*Opção:* RETIRADA NO BALCÃO%0A`;
                }

                mensagemWhats += `%0A*--- ITENS ---*%0A`;
                pedidoParaEnviar.itens.forEach(item => {
                    mensagemWhats += `*${item.quantity}x ${item.name}* (${item.price.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})})%0A`;
                    if (item.bread && item.bread !== 'Padrão' && item.bread !== 'Pão de Hambúrguer') mensagemWhats += `  - Pão: ${item.bread}%0A`;
                    if (item.extras && item.extras.length > 0) mensagemWhats += `  - Adicionais: ${item.extras.join(', ')}%0A`;
                    if (item.notes) mensagemWhats += `  - Obs: ${item.notes}%0A`;
                });

                if(sachesAlho > 0) mensagemWhats += `*${sachesAlho}x Sachê de Alho*%0A`;
                if(molhosSelecionados.length > 0) mensagemWhats += `*Molhos:* ${molhosSelecionados.join(', ')}%0A`;
                mensagemWhats += `%0A*Total do Pedido:* ${pedidoParaEnviar.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
                
                window.open("https://wa.me/5512992050080?text=" + mensagemWhats, '_blank');
                
                localStorage.clear(); // Limpa tudo relacionado ao pedido
                if(incluirMolhosCheckbox) incluirMolhosCheckbox.checked = false;
                if(opcoesMolhosIndividuais) opcoesMolhosIndividuais.style.display = 'none';
                document.querySelectorAll('#opcoesMolhosIndividuais input').forEach(c => c.checked = false);
                if(quantidadeAlhoInput) quantidadeAlhoInput.value = 0;

                renderizarCarrinho();

            } catch (error) {
                console.error("Erro ao finalizar o pedido:", error);
                alert("Houve um problema ao conectar com nosso sistema: " + error.message);
            }
        });
        
        incluirMolhosCheckbox?.addEventListener("change", function () {
            opcoesMolhosIndividuais.style.display = this.checked ? "block" : "none";
        });

        document.querySelectorAll('#opcoesMolhosIndividuais input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener("change", function () {
                localStorage.setItem(this.id, this.checked);
            });
        });

        quantidadeAlhoInput?.addEventListener("input", function () {
            localStorage.setItem("sachesAlho", this.value);
            renderizarCarrinho();
        });
    })();
    
    // 7. INICIALIZAÇÃO DA PÁGINA
    carregarDadosIniciais();
    renderizarCarrinho();
});
