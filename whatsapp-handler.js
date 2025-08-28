// whatsapp-handler-with-credits.js - VERSÃO CORRIGIDA COM SEGURANÇA TOTAL + SILÊNCIO PROFUNDO
const axios = require('axios');
const pino = require('pino');

class WhatsAppHandler {
    constructor(config = {}) {
        this.config = {
            whatsappBotUrl: config.whatsappBotUrl || 'http://localhost:3000',
            ...config
        };
        
        this.logger = pino({ level: 'info' });
        this.db = null;
        this.orderService = null;
        this.activationService = null;
        
        // Cache para mensagens e produtos
        this.messagesCache = new Map();
        this.productsCache = new Map();
    }

    // Inicializar com dependências
    initialize(dependencies) {
        this.db = dependencies.db;
        this.orderService = dependencies.orderService;
        this.activationService = dependencies.activationService;
        
        this.logger.info('📱 WhatsApp Handler com sistema de créditos inicializado');
    }

    // Carregar dados em cache
    async loadCache() {
        try {
            // Carregar produtos em cache
            const products = await this.db.getProducts();
            products.forEach(product => {
                this.productsCache.set(product.id, product);
            });

            // Carregar mensagens em cache
            const messages = await this.db.getMessages();
            Object.entries(messages).forEach(([type, message]) => {
                this.messagesCache.set(type, message);
            });

            this.logger.info(`Cache carregado: ${products.length} produtos, ${Object.keys(messages).length} mensagens`);
            
        } catch (error) {
            this.logger.error('Erro ao carregar cache:', error);
        }
    }

    // Método principal para processar mensagens do WhatsApp
    async processMessage(chatId, message) {
        try {
            this.logger.info(`📱 Processando mensagem de ${chatId}: "${message}"`);
            
            const userSession = await this.db.getUserSession(chatId);
            const messageText = message.toLowerCase().trim();

            // 🔇 SILÊNCIO PROFUNDO - NOVA VERIFICAÇÃO
            if (userSession.state === 'processing_activation') {
                this.logger.info(`🔇 SILÊNCIO ATIVO - Ignorando mensagem de ${chatId}: "${message}"`);
                return; // Não responde NADA - silêncio total
            }

            this.logger.info(`Sessão atual: Estado=${userSession.state}, Crédito=R$${userSession.availableCredit}, Pedido=${userSession.currentOrderId}`);

            // === VERIFICAR SE USUÁRIO TEM CRÉDITO ATIVO ===
            if (userSession.availableCredit > 0) {
                this.logger.info(`💳 Usuário ${chatId} tem crédito ativo: R$ ${userSession.availableCredit}`);
                return await this.handleCreditFlow(chatId, messageText, userSession);
            }

            // === FLUXO NORMAL (SEM CRÉDITO) ===
            return await this.handleNormalFlow(chatId, messageText, userSession);

        } catch (error) {
            this.logger.error('Erro ao processar mensagem WhatsApp:', error);
            return {
                reply: '❌ Erro interno. Tente novamente em alguns minutos.'
            };
        }
    }

    // === NOVO FLUXO COM CRÉDITO ===
    async handleCreditFlow(chatId, messageText, userSession) {
        try {
            this.logger.info(`💳 Processando fluxo de crédito para ${chatId} - Mensagem: "${messageText}"`);

            // No fluxo de crédito, o usuário está "preso" até conseguir ativar algo

            // === COMANDOS ESPECIAIS PERMITIDOS COM CRÉDITO ===
            if (this.isSupportCommand(messageText)) {
                this.logger.info(`💳 Comando suporte detectado`);
                return await this.handleSupportCommand();
            }

            // === COMANDO MENU EXPLÍCITO ===
            if (this.isMenuCommand(messageText)) {
                this.logger.info(`💳 Comando menu explícito detectado`);
                return await this.handleCreditMenu(chatId, userSession);
            }

            // === ESTADOS DO CRÉDITO ===

            // Estado: Aguardando informações de ativação (mesmo com crédito)
            if (userSession.state === 'awaiting_activation_info') {
                this.logger.info(`💳 Processando dados de ativação com crédito para ${chatId}`);
                return await this.handleActivationInfo(chatId, messageText, userSession);
            }

            // === SELEÇÃO DE PRODUTO (CASO PADRÃO) ===
            // Se não é comando especial nem estado específico, deve ser seleção de produto
            this.logger.info(`💳 Tentando processar como seleção de produto: "${messageText}"`);
            return await this.handleCreditProductSelection(chatId, messageText, userSession);

        } catch (error) {
            this.logger.error('Erro no fluxo de crédito:', error);
            return { reply: '❌ Erro no processamento. Voltando ao menu de ativação.' };
        }
    }

    // === FLUXO NORMAL (SEM CRÉDITO) - 🔒 ATUALIZADO COM COMANDO CANCELAR ===
    async handleNormalFlow(chatId, messageText, userSession) {
        try {
            // === COMANDOS PRINCIPAIS ===
            
            // Menu principal (AGORA SEGURO)
            if (this.isMenuCommand(messageText)) {
                return await this.handleMenuCommand(chatId);
            }

            // 🗑️ NOVO: Comando cancelar
            if (this.isCancelCommand(messageText)) {
                return await this.handleCancelCommand(chatId);
            }

            // Suporte
            if (this.isSupportCommand(messageText)) {
                return await this.handleSupportCommand();
            }

            // 🔒 COMANDO VERIFICAR - AGORA COM SEGURANÇA TOTAL
            if (this.isVerifyCommand(messageText)) {
                return await this.handleVerifyCommandSecure(chatId, userSession);
            }

            // === ESTADOS DO USUÁRIO ===

            // Menu principal ou seleção de produto
            if (userSession.state === 'menu' || !userSession.state) {
                return await this.handleProductSelection(chatId, messageText);
            }

            // Aguardando informações de ativação
            if (userSession.state === 'awaiting_activation_info') {
                return await this.handleActivationInfo(chatId, messageText, userSession);
            }

            // Resposta padrão
            return await this.handleDefaultResponse();

        } catch (error) {
            this.logger.error('Erro no fluxo normal:', error);
            return { reply: '❌ Erro interno. Tente novamente em alguns minutos.' };
        }
    }

    // 🔒 NOVO MÉTODO SEGURO PARA COMANDO MENU
    async handleMenuCommand(chatId) {
        try {
            this.logger.info(`🔒 Comando MENU recebido de ${chatId} - Iniciando verificações de segurança`);
            
            const userSession = await this.db.getUserSession(chatId);
            
            // 🔒 VERIFICAÇÃO 1: Usuário tem crédito ativo
            if (userSession.availableCredit > 0 && userSession.creditOrderId) {
                this.logger.warn(`🔒 BLOQUEIO: Usuário ${chatId} tem crédito ativo - R$ ${userSession.availableCredit}`);
                
                // Redirecionar para menu de crédito ao invés de menu normal
                return await this.handleCreditMenu(chatId, userSession);
            }
            
            // 🔒 VERIFICAÇÃO 2: Pedido pendente de pagamento
            if (userSession.currentOrderId) {
                const currentOrder = await this.db.getOrder(userSession.currentOrderId);
                
                if (currentOrder && currentOrder.status === 'pending_payment') {
                    this.logger.warn(`🔒 BLOQUEIO: Usuário ${chatId} tem pedido pendente: ${currentOrder.id}`);
                    
                    return {
                        reply: `⚠️ *VOCÊ JÁ TEM UM PEDIDO PENDENTE!*\n\n` +
                               `🎯 *Produto:* ${currentOrder.product.name}\n` +
                               `💰 *Valor:* R$ ${currentOrder.product.price.toFixed(2)}\n` +
                               `🆔 *Pedido:* ${currentOrder.id.substring(0, 8)}...\n` +
                               `📅 *Criado:* ${new Date(currentOrder.createdAt).toLocaleString('pt-BR')}\n\n` +
                               `━━━━━━━━━━━━━━━━━━━\n` +
                               `📋 *SUAS OPÇÕES:*\n\n` +
                               `✅ Digite *verificar* - Para verificar pagamento\n` +
                               `🗑️ Digite *cancelar* - Para cancelar este pedido\n` +
                               `📞 Digite *suporte* - Para falar com atendimento\n\n` +
                               `💡 *Complete este pedido antes de fazer um novo!*\n` +
                               `🔒 *Sua segurança é nossa prioridade.*`
                    };
                }
            }
            
            // 🔒 VERIFICAÇÃO 3: Buscar pedidos pendentes órfãos (sem referência na sessão)
            this.logger.info(`🔍 Buscando pedidos pendentes órfãos para ${chatId}`);
            
            const orphanPendingOrders = await this.db.all(
                'SELECT * FROM orders WHERE chat_id = ? AND status = "pending_payment" ORDER BY created_at DESC LIMIT 3',
                [chatId]
            );
            
            if (orphanPendingOrders.length > 0) {
                const latestOrder = orphanPendingOrders[0];
                
                // Verificar se o pedido não é muito antigo (ex: mais de 24 horas)
                const orderAge = Date.now() - new Date(latestOrder.created_at).getTime();
                const maxAge = 24 * 60 * 60 * 1000; // 24 horas
                
                if (orderAge < maxAge) {
                    this.logger.warn(`🔒 BLOQUEIO: Encontrado pedido pendente órfão recente: ${latestOrder.id}`);
                    
                    // Reconectar pedido à sessão
                    userSession.currentOrderId = latestOrder.id;
                    userSession.state = 'pending_payment';
                    await this.db.saveUserSession(chatId, userSession);
                    
                    this.logger.info(`🔧 Pedido órfão reconectado à sessão: ${latestOrder.id}`);
                    
                    return {
                        reply: `🔄 *PEDIDO PENDENTE ENCONTRADO!*\n\n` +
                               `🎯 *Produto:* ${JSON.parse(latestOrder.product_data).name}\n` +
                               `💰 *Valor:* R$ ${JSON.parse(latestOrder.product_data).price.toFixed(2)}\n` +
                               `🆔 *Pedido:* ${latestOrder.id.substring(0, 8)}...\n` +
                               `📅 *Criado:* ${new Date(latestOrder.created_at).toLocaleString('pt-BR')}\n\n` +
                               `━━━━━━━━━━━━━━━━━━━\n` +
                               `📋 *SUAS OPÇÕES:*\n\n` +
                               `✅ Digite *verificar* - Para verificar pagamento\n` +
                               `🗑️ Digite *cancelar* - Para cancelar este pedido\n` +
                               `📞 Digite *suporte* - Para falar com atendimento\n\n` +
                               `💡 *Finalize este pedido antes de criar um novo!*`
                    };
                } else {
                    // Pedidos muito antigos podem ser considerados abandonados
                    this.logger.info(`🗑️ Pedidos antigos encontrados (${orderAge/1000/60/60}h), mas permitindo novo menu`);
                }
            }
            
            // 🔒 VERIFICAÇÃO PASSOU: Usuário pode acessar menu normal
            this.logger.info(`✅ Todas as verificações passaram - Exibindo menu normal para ${chatId}`);
            
            // Limpar sessão antes de mostrar menu
            userSession.state = 'menu';
            userSession.currentOrderId = null;
            await this.db.saveUserSession(chatId, userSession);
            
            return {
                reply: this.getMainMenu()
            };
            
        } catch (error) {
            this.logger.error('🔒 Erro no comando menu seguro:', error);
            return { reply: '❌ Erro ao carregar menu. Tente novamente em alguns minutos.' };
        }
    }

    // 🗑️ NOVO MÉTODO PARA CANCELAR PEDIDOS
    async handleCancelCommand(chatId) {
        try {
            this.logger.info(`🗑️ Comando CANCELAR recebido de ${chatId}`);
            
            const userSession = await this.db.getUserSession(chatId);
            
            if (!userSession.currentOrderId) {
                return {
                    reply: '❌ Nenhum pedido ativo para cancelar. Digite *menu* para começar.'
                };
            }
            
            const order = await this.db.getOrder(userSession.currentOrderId);
            
            if (!order) {
                return {
                    reply: '❌ Pedido não encontrado. Digite *menu* para começar.'
                };
            }
            
            if (order.status !== 'pending_payment') {
                return {
                    reply: `⚠️ *Não é possível cancelar*\n\nPedido ${order.id.substring(0, 8)}... já foi processado.\nStatus: ${order.status}\n\nDigite *suporte* se precisar de ajuda.`
                };
            }
            
            // Cancelar pedido
            order.status = 'cancelled';
            order.error = 'Cancelado pelo usuário';
            order.completedAt = new Date().toISOString();
            await this.db.saveOrder(order);
            
            // Limpar sessão
            userSession.state = null;
            userSession.currentOrderId = null;
            await this.db.saveUserSession(chatId, userSession);
            
            this.logger.info(`🗑️ Pedido ${order.id} cancelado pelo usuário ${chatId}`);
            
            return {
                reply: `✅ *PEDIDO CANCELADO COM SUCESSO!*\n\n` +
                       `🆔 Pedido: ${order.id.substring(0, 8)}...\n` +
                       `🎯 Produto: ${order.product.name}\n` +
                       `💰 Valor: R$ ${order.product.price.toFixed(2)}\n\n` +
                       `💡 *Se você já fez o pagamento PIX:*\n` +
                       `📞 Entre em contato com o suporte para reembolso\n\n` +
                       `Digite *menu* para fazer um novo pedido.`
            };
            
        } catch (error) {
            this.logger.error('🗑️ Erro ao cancelar pedido:', error);
            return { reply: '❌ Erro ao cancelar pedido. Digite *suporte* para ajuda.' };
        }
    }

    // 🔒 NOVO MÉTODO SEGURO PARA VERIFICAR PAGAMENTOS
    async handleVerifyCommandSecure(chatId, userSession) {
        try {
            this.logger.info(`🔒 VERIFICAÇÃO SEGURA iniciada para ${chatId}`);
            
            let targetOrderId = userSession.currentOrderId;
            
            // Se não há pedido na sessão, buscar o mais recente pendente
            if (!targetOrderId) {
                this.logger.info(`🔍 Buscando pedido pendente mais recente para ${chatId}`);
                
                const recentOrders = await this.db.all(
                    'SELECT * FROM orders WHERE chat_id = ? AND status = "pending_payment" ORDER BY created_at DESC LIMIT 1',
                    [chatId]
                );
                
                if (recentOrders.length === 0) {
                    this.logger.warn(`❌ Nenhum pedido pendente encontrado para ${chatId}`);
                    return {
                        reply: '❌ Nenhum pedido pendente encontrado. Digite *menu* para começar.'
                    };
                }
                
                targetOrderId = recentOrders[0].id;
                this.logger.info(`🔍 Pedido encontrado: ${targetOrderId}`);
            }
            
            // 🔒 VERIFICAÇÕES DE SEGURANÇA CRÍTICAS
            const order = await this.db.getOrder(targetOrderId);
            
            if (!order) {
                this.logger.error(`❌ Pedido ${targetOrderId} não encontrado no banco`);
                return { reply: '❌ Pedido não encontrado.' };
            }

            // 🔒 VERIFICAÇÃO 1: Status do pedido
            if (order.status !== 'pending_payment') {
                this.logger.warn(`🔒 BLOQUEIO: Pedido ${targetOrderId} já foi processado (Status: ${order.status})`);
                
                if (order.status === 'paid' && order.creditAmount > 0) {
                    // Se foi pago e gerou crédito, redirecionar para menu de crédito
                    return {
                        reply: `✅ *Este pedido já foi pago!*\n\n📋 Pedido: ${targetOrderId.substring(0, 8)}...\n🎯 Produto: ${order.product.name}\n💳 Status: Já processado\n\n💡 Use seu crédito ou digite *menu* para ver opções.`
                    };
                } else if (order.status === 'completed') {
                    return {
                        reply: `✅ *Este pedido já foi finalizado!*\n\n📋 Pedido: ${targetOrderId.substring(0, 8)}...\n🎯 Produto: ${order.product.name}\n✅ Status: Ativação concluída\n\nDigite *menu* para novo pedido.`
                    };
                } else {
                    return {
                        reply: `⚠️ *Pedido já processado*\n\n📋 Pedido: ${targetOrderId.substring(0, 8)}...\n💳 Status: ${order.status}\n\nDigite *menu* para novo pedido.`
                    };
                }
            }

            // 🔒 VERIFICAÇÃO 2: Crédito já concedido
            if (order.creditAmount > 0 && !order.creditUsed) {
                this.logger.warn(`🔒 BLOQUEIO: Pedido ${targetOrderId} já gerou crédito não utilizado`);
                return {
                    reply: `⚠️ *Este pagamento já foi processado!*\n\n📋 Pedido: ${targetOrderId.substring(0, 8)}...\n💳 Crédito gerado: R$ ${order.creditAmount.toFixed(2)}\n\n💡 Use seu crédito existente ou entre em contato com o suporte.`
                };
            }

            // 🔒 VERIFICAÇÃO 3: Usuário já tem crédito ativo de outro pedido
            const currentSession = await this.db.getUserSession(chatId);
            if (currentSession.availableCredit > 0 && currentSession.creditOrderId !== targetOrderId) {
                this.logger.warn(`🔒 BLOQUEIO: Usuário ${chatId} já tem crédito ativo de outro pedido: ${currentSession.creditOrderId}`);
                return {
                    reply: `⚠️ *Você já tem crédito ativo!*\n\n💳 Crédito disponível: R$ ${currentSession.availableCredit.toFixed(2)}\n📋 Pedido origem: ${currentSession.creditOrderId?.substring(0, 8)}...\n\n💡 Use seu crédito atual primeiro ou entre em contato com o suporte.`
                };
            }

            this.logger.info(`✅ Todas as verificações de segurança passaram para pedido ${targetOrderId}`);

            // Se passou por todas as verificações, proceder com a verificação normal
            this.logger.info(`🔍 Verificando pagamento real do pedido ${targetOrderId}`);
            return await this.orderService.verifyPayment(chatId, targetOrderId);

        } catch (error) {
            this.logger.error('🔒 Erro na verificação segura:', error);
            return { reply: '❌ Erro ao verificar pagamento. Tente novamente em alguns minutos.' };
        }
    }

    // === HANDLERS DO SISTEMA DE CRÉDITO ===

    async handleCreditMenu(chatId, userSession) {
        try {
            this.logger.info(`💳 Exibindo menu de crédito para ${chatId} - Crédito: R$ ${userSession.availableCredit}`);

            // Buscar o pedido original para saber de onde veio o crédito
            const originalOrder = await this.db.getOrder(userSession.creditOrderId);
            const originalProductName = originalOrder ? originalOrder.product.name : 'produto';

            const products = Array.from(this.productsCache.values()).filter(p => p.active);
            
            let productsList = '';
            products.forEach((product, index) => {
                // Verificar se o preço está dentro do crédito disponível
                const canAfford = product.price <= userSession.availableCredit;
                const priceDisplay = canAfford ? `💚 ${product.price.toFixed(2)} R$` : `❌ ${product.price.toFixed(2)} R$`;
                
                productsList += `*${index + 1}.* ${product.name} ${priceDisplay}\n\n`;  // ← TUDO EM UMA LINHA
            });

            // Atualizar estado para menu de crédito
            userSession.state = 'credit_menu';
            await this.db.saveUserSession(chatId, userSession);

            const creditMenuMessage = `💳 *VOCÊ TEM CRÉDITO DISPONÍVEL!*

🎯 *Crédito:* R$ ${userSession.availableCredit.toFixed(2)}
📦 *Origem:* ${originalProductName}

━━━━━━━━━━━━━━━━━━━
📱 *ESCOLHA UM PRODUTO PARA ATIVAR:*

${productsList}━━━━━━━━━━━━━━━━━━━
💡 *Como funciona:*
• Você já pagou, então não será cobrado novamente
• Escolha qualquer produto que caiba no seu crédito
• Se a ativação falhar, pode tentar outro produto
• Seu crédito só é consumido quando a ativação der certo

👆 *Digite o número* do produto
🆘 Para suporte: /suporte`;

            return { reply: creditMenuMessage };

        } catch (error) {
            this.logger.error('Erro ao exibir menu de crédito:', error);
            return { reply: '❌ Erro ao carregar menu. Digite *menu* para tentar novamente.' };
        }
    }

    async handleCreditProductSelection(chatId, messageText, userSession) {
        try {
            this.logger.info(`💳 Processando seleção de produto: "${messageText}" para ${chatId}`);
            
            const selectedProduct = this.findProductByInput(messageText);
            
            if (!selectedProduct) {
                this.logger.warn(`💳 Produto não encontrado para entrada: "${messageText}"`);
                
                // Se não encontrou produto, mostrar menu novamente
                const menuResult = await this.handleCreditMenu(chatId, userSession);
                return {
                    reply: `❌ *Produto não encontrado*\n\nDigite o *número* do produto (1, 2, 3, etc.)\n\n${menuResult.reply}`
                };
            }

            this.logger.info(`💳 Produto encontrado: ${selectedProduct.name} - R$ ${selectedProduct.price}`);

            // Verificar se o usuário tem crédito suficiente
            if (selectedProduct.price > userSession.availableCredit) {
                this.logger.warn(`💳 Crédito insuficiente: R$ ${userSession.availableCredit} < R$ ${selectedProduct.price}`);
                return {
                    reply: `❌ *Crédito insuficiente*\n\n🎯 Produto: ${selectedProduct.name}\n💰 Preço: R$ ${selectedProduct.price.toFixed(2)}\n💳 Seu crédito: R$ ${userSession.availableCredit.toFixed(2)}\n\n💡 Escolha um produto mais barato ou entre em contato com o suporte.`
                };
            }

            this.logger.info(`💳 Produto selecionado com crédito: ${selectedProduct.name} por ${chatId}`);

            // "Usar" o crédito (marcar como reservado)
            await this.db.useCredit(chatId, selectedProduct.price);
            this.logger.info(`💳 Crédito usado: R$ ${selectedProduct.price} para ${chatId}`);

            // 🔧 CORREÇÃO CRÍTICA: Salvar qual produto foi selecionado na sessão
            userSession.state = 'awaiting_activation_info';
            userSession.currentOrderId = userSession.creditOrderId; // Usar o pedido original
            
            // 🔧 NOVO: Salvar produto selecionado nos dados da sessão
            if (!userSession.data) {
                userSession.data = {};
            }
            userSession.data.selectedProductId = selectedProduct.id;
            userSession.data.selectedProductName = selectedProduct.name;
            userSession.data.selectedProductModule = selectedProduct.activationModule;
            
            await this.db.saveUserSession(chatId, userSession);

            this.logger.info(`✅ PRODUTO SELECIONADO SALVO NA SESSÃO: ${selectedProduct.name} (ID: ${selectedProduct.id})`);

            // Buscar mensagem personalizada para este produto
            const message = await this.formatProductMessage('payment_confirmed', selectedProduct.id, {
                product_name: selectedProduct.name,
                price: selectedProduct.price.toFixed(2)
            });

            this.logger.info(`💳 Enviando mensagem de confirmação personalizada para ${chatId}`);

            return { reply: message };

        } catch (error) {
            this.logger.error('Erro na seleção de produto com crédito:', error);
            return { reply: '❌ Erro ao processar seleção. Digite *menu* para tentar novamente.' };
        }
    }

    async handleActivationInfo(chatId, message, userSession) {
        try {
            this.logger.info(`🔧 Processando dados de ativação para ${chatId} (com crédito: ${userSession.availableCredit > 0})`);
            
            // Chamar o serviço de ativação
            const result = await this.activationService.processActivationInfo(chatId, message);
            
            // Se a ativação falhou E o usuário tinha crédito, redirecionar para menu de crédito
            if (!result.success && userSession.availableCredit > 0) {
                this.logger.info(`❌ Ativação falhou para usuário com crédito ${chatId}, redirecionando para menu`);
                
                // Restaurar o crédito (já que a ativação falhou)
                const originalOrder = await this.db.getOrder(userSession.creditOrderId);
                if (originalOrder) {
                    await this.db.grantCredit(chatId, originalOrder.id, originalOrder.product.price);
                }
                
                // Mostrar erro + menu de crédito
                const errorMessage = result.reply || '❌ Falha na ativação.';
                const menuMessage = await this.handleCreditMenu(chatId, userSession);
                
                return {
                    reply: `${errorMessage}\n\n━━━━━━━━━━━━━━━━━━━\n💡 *Tente novamente:*\n\n${menuMessage.reply}`
                };
            }
            
            // Se a ativação teve sucesso OU usuário não tinha crédito, seguir fluxo normal
            return result;

        } catch (error) {
            this.logger.error('Erro ao processar dados de ativação:', error);
            return { reply: '❌ Erro interno. Tente novamente.' };
        }
    }

    // === HANDLERS DE ESTADO (FLUXO NORMAL) ===

    async handleProductSelection(chatId, messageText) {
        try {
            const selectedProduct = this.findProductByInput(messageText);
            
            if (selectedProduct) {
                this.logger.info(`Produto selecionado: ${selectedProduct.name}`);
                return await this.orderService.selectProduct(chatId, selectedProduct.id);
            } else {
                return {
                    reply: '❌ Produto não encontrado. Digite *menu* para ver os produtos disponíveis.'
                };
            }
        } catch (error) {
            this.logger.error('Erro na seleção de produto:', error);
            return { reply: '❌ Erro ao processar seleção.' };
        }
    }

    async handleSupportCommand() {
        return {
            reply: this.formatMessage('support', {})
        };
    }

    async handleDefaultResponse() {
        return {
            reply: this.formatMessage('welcome', {})
        };
    }

// === VERIFICADORES DE COMANDO - 🔒 ATUALIZADOS ===

    isMenuCommand(messageText) {
        return ['/start', 'menu', 'oi', 'olá', 'inicio', 'começar'].includes(messageText);
    }

    isCancelCommand(messageText) {
        return ['cancelar', 'cancel', '/cancelar', 'desistir'].includes(messageText);
    }

    isSupportCommand(messageText) {
        return ['/suporte', 'suporte', 'ajuda', 'help'].includes(messageText);
    }

    isVerifyCommand(messageText) {
        return ['verificar', 'pago', 'verifique', 'check'].includes(messageText);
    }

    // === MÉTODOS AUXILIARES ===

    findProductByInput(input) {
        try {
            const products = Array.from(this.productsCache.values()).filter(p => p.active);
            
            this.logger.info(`🔍 Buscando produto para entrada: "${input}" entre ${products.length} produtos`);
            
            // Buscar por número
            const inputNumber = input.trim();
            const productNumber = parseInt(inputNumber);
            
            this.logger.info(`🔍 Tentando como número: ${productNumber}`);
            
            if (productNumber > 0 && productNumber <= products.length) {
                const selectedProduct = products[productNumber - 1];
                this.logger.info(`✅ Produto encontrado por número ${productNumber}: ${selectedProduct.name}`);
                return selectedProduct;
            }

            // Buscar por nome ou ID
            const foundProduct = products.find(p => 
                p.name.toLowerCase().includes(input.toLowerCase()) || 
                p.id.toLowerCase().includes(input.toLowerCase())
            );
            
            if (foundProduct) {
                this.logger.info(`✅ Produto encontrado por nome/ID: ${foundProduct.name}`);
                return foundProduct;
            }

            this.logger.warn(`❌ Nenhum produto encontrado para: "${input}"`);
            this.logger.info(`📋 Produtos disponíveis: ${products.map((p, i) => `${i+1}:${p.name}`).join(', ')}`);
            
            return null;
        } catch (error) {
            this.logger.error('Erro ao buscar produto:', error);
            return null;
        }
    }

    getMainMenu() {
        const products = Array.from(this.productsCache.values()).filter(p => p.active);
        
        let productsList = '';
        products.forEach((product, index) => {
            productsList += `*${index + 1}.* ${product.name} ${product.price.toFixed(2)} R$💰\n\n`;
        });
        
        return this.formatMessage('menu', { products_list: productsList });
    }

    formatMessage(type, variables = {}) {
        const messageTemplate = this.messagesCache.get(type);
        if (!messageTemplate) {
            return `❌ Mensagem "${type}" não configurada.`;
        }

        let message = messageTemplate.content;
        
        // Substituir variáveis
        Object.entries(variables).forEach(([key, value]) => {
            const regex = new RegExp(`{${key}}`, 'g');
            message = message.replace(regex, value || '');
        });

        return message;
    }

    // NOVO: Formatar mensagem específica por produto
    async formatProductMessage(type, productId, variables = {}) {
        try {
            if (type === 'payment_confirmed') {
                // Buscar mensagem específica do produto
                const messageData = await this.db.getPaymentConfirmedMessage(productId);
                
                let message = messageData.content;
                
                // Substituir variáveis
                Object.entries(variables).forEach(([key, value]) => {
                    const regex = new RegExp(`{${key}}`, 'g');
                    message = message.replace(regex, value || '');
                });

                this.logger.info(`📱 Usando mensagem ${messageData.isCustom ? 'personalizada' : 'padrão'} para produto ${productId}`);
                
                return message;
            } else {
                // Para outros tipos, usar método normal
                return this.formatMessage(type, variables);
            }
        } catch (error) {
            this.logger.error('Erro ao formatar mensagem do produto:', error);
            return this.formatMessage(type, variables); // Fallback
        }
    }

    // Enviar mensagem para o WhatsApp
    async sendMessage(chatId, message) {
        try {
            await axios.post(`${this.config.whatsappBotUrl}/send`, {
                chatId,
                message,
                type: 'text'
            });
            
            this.logger.info(`📱 Mensagem enviada para ${chatId.substring(0, 15)}...`);
            return { success: true };
        } catch (error) {
            this.logger.error('Erro ao enviar mensagem WhatsApp:', error);
            return { success: false, error: error.message };
        }
    }

    // === NOVOS MÉTODOS PARA SISTEMA DE CRÉDITOS ===

    // Conceder crédito ao usuário após pagamento aprovado
    async grantCreditToUser(chatId, orderId, creditAmount) {
        try {
            await this.db.grantCredit(chatId, orderId, creditAmount);
            
            this.logger.info(`💳 Crédito concedido a ${chatId}: R$ ${creditAmount}`);
            
            // Mostrar menu de crédito imediatamente
            const userSession = await this.db.getUserSession(chatId);
            const menuMessage = await this.handleCreditMenu(chatId, userSession);
            
            return menuMessage;
        } catch (error) {
            this.logger.error('Erro ao conceder crédito:', error);
            return { reply: '❌ Erro ao processar crédito.' };
        }
    }

    // Verificar se usuário tem crédito
    async userHasCredit(chatId) {
        try {
            return await this.db.hasCredit(chatId, 0.01); // Mínimo de R$ 0,01
        } catch (error) {
            this.logger.error('Erro ao verificar crédito:', error);
            return false;
        }
    }

    // Atualizar cache quando necessário
    async updateCache() {
        await this.loadCache();
        this.logger.info('📱 Cache do WhatsApp Handler atualizado');
    }

    // Limpar sessão do usuário
    async clearUserSession(chatId) {
        try {
            const userSession = await this.db.getUserSession(chatId);
            userSession.state = null;
            userSession.currentOrderId = null;
            // NÃO limpar crédito aqui - só em casos específicos
            await this.db.saveUserSession(chatId, userSession);
            
            this.logger.info(`🧹 Sessão limpa para ${chatId} (crédito preservado)`);
        } catch (error) {
            this.logger.error('Erro ao limpar sessão:', error);
        }
    }

    // Estatísticas do handler
    getStats() {
        return {
            cacheSize: {
                products: this.productsCache.size,
                messages: this.messagesCache.size
            },
            whatsappBotUrl: this.config.whatsappBotUrl
        };
    }
}

module.exports = WhatsAppHandler;
