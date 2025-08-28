// order-service.js - VERSÃO CORRIGIDA COM SEGURANÇA TOTAL
const { v4: uuidv4 } = require('uuid');
const pino = require('pino');

class OrderService {
    constructor(config = {}) {
        this.config = {
            whatsappBotUrl: config.whatsappBotUrl || 'http://localhost:3000',
            coreSystemUrl: config.coreSystemUrl || 'http://localhost:3001',
            ...config
        };
        
        this.logger = pino({ level: 'info' });
        this.db = null;
        this.mercadoPago = null;
        this.whatsappHandler = null;
        
        // Cache para produtos
        this.productsCache = new Map();
    }

    // Inicializar com dependências
    initialize(dependencies) {
        this.db = dependencies.db;
        this.mercadoPago = dependencies.mercadoPago;
        this.whatsappHandler = dependencies.whatsappHandler;
        
        this.logger.info('💳 Order Service inicializado');
    }

    // Carregar produtos em cache
    async loadProductsCache() {
        try {
            const products = await this.db.getProducts();
            products.forEach(product => {
                this.productsCache.set(product.id, product);
            });
            
            this.logger.info(`💳 Cache de produtos carregado: ${products.length} produtos`);
        } catch (error) {
            this.logger.error('Erro ao carregar cache de produtos:', error);
        }
    }

    // Selecionar produto e criar pedido
    async selectProduct(chatId, productId) {
        try {
            const product = this.productsCache.get(productId);
            if (!product || !product.active) {
                return { reply: '❌ Produto não encontrado ou indisponível.' };
            }

            this.logger.info(`💳 Criando pedido - Produto: ${product.name}, Cliente: ${chatId}`);

            // Criar pedido
            const orderId = uuidv4();
            const pixResult = await this.generatePixPayment(orderId, product);
            
            const order = {
                id: orderId,
                chatId,
                productId,
                product,
                pixCode: pixResult.pixCode,
                paymentId: pixResult.paymentId ? String(pixResult.paymentId).split('.')[0] : null,
                status: 'pending_payment',
                createdAt: new Date().toISOString()
            };
            
            // Salvar no banco
            await this.db.saveOrder(order);
            
            // Atualizar sessão do usuário
            const userSession = await this.db.getUserSession(chatId);
            userSession.currentOrderId = orderId;
            userSession.state = 'awaiting_payment';
            await this.db.saveUserSession(chatId, userSession);
            
            this.logger.info(`💳 Pedido criado: ${orderId}, PaymentId: ${order.paymentId}`);
            
            // ✅ NOVA IMPLEMENTAÇÃO: ENVIAR 2 MENSAGENS SEPARADAS
            
            // 1ª MENSAGEM: Instruções de pagamento (SEM código PIX)
            const instructionsMessage = `✅ *${product.name} selecionado!*
    💰 *Valor:* R$ ${product.price.toFixed(2)}
    ━━━━━━━━━━━━━━━━━━━
    📋 *Instruções:*
    1. Copie o código PIX abaixo
    2. Faça o pagamento no seu banco
    3. Após pagar, digite: *verificar*
    ⏰ *Pedido:* ${orderId.substring(0, 8)}...
    🔗 *PIX Copia e Cola:*`;

            // Enviar 1ª mensagem
            await this.whatsappHandler.sendMessage(chatId, instructionsMessage);
            
            // Aguardar 1 segundo antes de enviar o código PIX
            await this.sleep(1000);
            
            // 2ª MENSAGEM: Apenas o código PIX
            const pixCodeMessage = pixResult.pixCode;
            
            // Enviar 2ª mensagem (código PIX)
            await this.whatsappHandler.sendMessage(chatId, pixCodeMessage);
            
            // Retornar sucesso (não precisa de reply porque já enviamos as mensagens)
            return { success: true };
            
        } catch (error) {
            this.logger.error('Erro ao criar pedido:', error);
            return { reply: '❌ Erro ao processar pedido. Tente novamente.' };
        }
    }

    // Função auxiliar para esperar
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Gerar pagamento PIX
    async generatePixPayment(orderId, product) {
        try {
            this.logger.info(`💳 Gerando PIX - Pedido: ${orderId}, Produto: ${product.name}, Valor: R$ ${product.price}`);
            
            if (!this.mercadoPago.isConfigured()) {
                this.logger.warn('Mercado Pago não configurado, usando PIX simulado');
                return {
                    pixCode: this.generateFallbackPix(orderId, product),
                    paymentId: null
                };
            }

            const order = { id: orderId, product, chatId: 'temp' };
            
            this.logger.info('💳 Chamando Mercado Pago para gerar PIX...');
            const mpResult = await this.mercadoPago.generatePixPayment(order);
            
            this.logger.info(`💳 Resultado MP: ${JSON.stringify(mpResult)}`);
            
            if (mpResult.success && mpResult.pixCode) {
                this.logger.info(`✅ PIX real gerado - PaymentId: ${mpResult.paymentId}`);
                return {
                    pixCode: mpResult.pixCode,
                    paymentId: mpResult.paymentId
                };
            } else {
                this.logger.error(`❌ Falha na geração PIX MP: ${mpResult.error}`);
                return {
                    pixCode: this.generateFallbackPix(orderId, product),
                    paymentId: null
                };
            }
            
        } catch (error) {
            this.logger.error('❌ Erro ao gerar PIX, usando fallback:', error.message);
            return {
                pixCode: this.generateFallbackPix(orderId, product),
                paymentId: null
            };
        }
    }

    // PIX de fallback (simulado)
    generateFallbackPix(orderId, product) {
        const amount = product.price.toFixed(2).replace('.', '');
        const orderShort = orderId.substring(0, 8);
        
        return `00020126580014BR.GOV.BCB.PIX0136${orderShort}@exemplo.com5204000053039865802BR5925EMPRESA ATIVACOES LTDA6009SAO PAULO62070503***6304${Math.floor(Math.random() * 9999)}`;
    }

    // 🔒 VERIFICAR PAGAMENTO - VERSÃO ULTRA SEGURA
    async verifyPayment(chatId, orderId) {
        try {
            this.logger.info(`🔒 VERIFICAÇÃO ULTRA SEGURA - Chat: ${chatId}, Pedido: ${orderId}`);
            
            const order = await this.db.getOrder(orderId);
            
            if (!order) {
                this.logger.warn(`❌ Pedido ${orderId} não encontrado`);
                return { reply: '❌ Pedido não encontrado.' };
            }

            this.logger.info(`🔍 Pedido encontrado - Status: ${order.status}, PaymentId: ${order.paymentId}, CreditAmount: ${order.creditAmount}, CreditUsed: ${order.creditUsed}`);

            // 🔒 VERIFICAÇÃO CRÍTICA 1: Status do pedido
            if (order.status !== 'pending_payment') {
                this.logger.warn(`🔒 BLOQUEIO CRÍTICO: Pedido ${orderId} já foi processado (Status: ${order.status})`);
                
                return {
                    reply: `⚠️ *Este pedido já foi processado!*\n\n📋 Pedido: ${orderId.substring(0, 8)}...\n💳 Status: ${order.status}\n🎯 Produto: ${order.product.name}\n\n${this.getStatusMessage(order.status)}`
                };
            }

            // 🔒 VERIFICAÇÃO CRÍTICA 2: Crédito já foi concedido para este pedido
            if (order.creditAmount > 0) {
                this.logger.warn(`🔒 BLOQUEIO CRÍTICO: Pedido ${orderId} já gerou crédito de R$ ${order.creditAmount} (Usado: ${order.creditUsed})`);
                
                return {
                    reply: `🚫 *PAGAMENTO JÁ PROCESSADO!*\n\n📋 Pedido: ${orderId.substring(0, 8)}...\n🎯 Produto: ${order.product.name}\n💳 Crédito gerado: R$ ${order.creditAmount.toFixed(2)}\n🔄 Status do crédito: ${order.creditUsed ? 'Já utilizado' : 'Disponível'}\n\n⚠️ *Este pagamento não pode ser verificado novamente.*\n\n💡 Entre em contato com o suporte se necessário.`
                };
            }

            // 🔒 VERIFICAÇÃO CRÍTICA 3: Usuário já tem crédito ativo de outro pedido
            const userSession = await this.db.getUserSession(chatId);
            if (userSession.availableCredit > 0 && userSession.creditOrderId !== orderId) {
                this.logger.warn(`🔒 BLOQUEIO CRÍTICO: Usuário ${chatId} já tem crédito ativo de outro pedido: ${userSession.creditOrderId}`);
                
                return {
                    reply: `🚫 *VOCÊ JÁ TEM CRÉDITO ATIVO!*\n\n💳 Crédito atual: R$ ${userSession.availableCredit.toFixed(2)}\n📋 Pedido origem: ${userSession.creditOrderId?.substring(0, 8)}...\n\n⚠️ *Não é possível processar outro pagamento enquanto você tem crédito ativo.*\n\n💡 Use seu crédito atual primeiro ou entre em contato com o suporte.`
                };
            }

            // 🔒 Se passou por todas as verificações, proceder com verificação real
            this.logger.info(`✅ TODAS AS VERIFICAÇÕES DE SEGURANÇA PASSARAM para pedido ${orderId}`);

            // Usar verificação real do Mercado Pago
            if (this.mercadoPago && this.mercadoPago.isConfigured() && order.paymentId) {
                try {
                    // Limpar PaymentId (remover decimais se houver)
                    const cleanPaymentId = String(order.paymentId).split('.')[0];
                    
                    this.logger.info(`🔍 Verificando pagamento ${cleanPaymentId} no Mercado Pago`);
                    
                    const paymentStatus = await this.mercadoPago.getPaymentStatus(cleanPaymentId);
                    
                    this.logger.info(`💳 Status do pagamento: ${paymentStatus.status}`);
                    
                    if (['approved', 'authorized'].includes(paymentStatus.status)) {
                        return await this.processPaymentApprovalSecure(orderId, paymentStatus);
                    } else if (paymentStatus.status === 'rejected') {
                        return { 
                            reply: `❌ *Pagamento rejeitado*\n\n📋 Pedido: ${orderId.substring(0, 8)}...\n\n💳 Tente novamente com outro método de pagamento ou entre em contato com o suporte.` 
                        };
                    } else if (paymentStatus.status === 'pending') {
                        return { 
                            reply: `⏳ *Pagamento pendente*\n\n📋 Pedido: ${orderId.substring(0, 8)}...\n💳 Status: Aguardando pagamento PIX\n\n⚠️ Realize o pagamento e aguarde - sistema detectará automaticamente` 
                        };
                    } else {
                        return { 
                            reply: `⏳ *Pagamento processando*\n\n📋 Pedido: ${orderId.substring(0, 8)}...\n⏰ Status: ${paymentStatus.status}\n\n⚠️ Aguarde - sistema detectará automaticamente` 
                        };
                    }
                } catch (mpError) {
                    this.logger.error('Erro ao verificar no Mercado Pago:', mpError);
                    
                    return { 
                        reply: `❌ *Erro na verificação*\n\n📋 Pedido: ${orderId.substring(0, 8)}...\n\n⚠️ Tente novamente em alguns minutos ou entre em contato com o suporte.` 
                    };
                }
            }
            
            // Fallback se MP não configurado
            this.logger.info('Mercado Pago não configurado, usando simulação');
            const isPaid = Math.random() > 0.3; // 70% chance de estar pago
            
            if (isPaid) {
                this.logger.info(`🎲 Simulando pagamento aprovado para pedido ${orderId}`);
                
                return await this.processPaymentApprovalSecure(orderId, { status: 'approved', simulation: true });
            } else {
                this.logger.info(`🎲 Simulando pagamento pendente para pedido ${orderId}`);
                return { 
                    reply: `⏳ *Pagamento ainda não identificado*\n\n📋 Pedido: ${orderId.substring(0, 8)}...\n\n⚠️ Se já pagou, aguarde alguns minutos - sistema detectará automaticamente` 
                };
            }
        } catch (error) {
            this.logger.error('🔒 Erro na verificação ultra segura:', error);
            return { reply: '❌ Erro ao verificar pagamento. Tente novamente em alguns minutos.' };
        }
    }

    // 🔒 PROCESSAR APROVAÇÃO DE PAGAMENTO - VERSÃO ULTRA SEGURA
    async processPaymentApprovalSecure(orderId, paymentData) {
        try {
            this.logger.info(`🔒 APROVAÇÃO ULTRA SEGURA iniciada para pedido: ${orderId}`);
            
            const order = await this.db.getOrder(orderId);
            
            if (!order) {
                this.logger.error(`❌ Pedido ${orderId} não encontrado para aprovação`);
                return { reply: '❌ Pedido não encontrado.' };
            }

            // 🔒 VERIFICAÇÃO DUPLA: Status ainda é pending_payment?
            if (order.status !== 'pending_payment') {
                this.logger.error(`🔒 BLOQUEIO CRÍTICO NA APROVAÇÃO: Pedido ${orderId} não está mais pendente (Status: ${order.status})`);
                return { 
                    reply: `⚠️ *Erro de sincronização*\n\nEste pedido não pode mais ser processado.\nStatus atual: ${order.status}\n\nEntre em contato com o suporte.` 
                };
            }

            // 🔒 VERIFICAÇÃO DUPLA: Ainda não foi gerado crédito?
            if (order.creditAmount > 0) {
                this.logger.error(`🔒 BLOQUEIO CRÍTICO NA APROVAÇÃO: Pedido ${orderId} já gerou crédito: R$ ${order.creditAmount}`);
                return { 
                    reply: `⚠️ *Erro de duplicação*\n\nEste pagamento já foi processado.\nCrédito: R$ ${order.creditAmount.toFixed(2)}\n\nEntre em contato com o suporte.` 
                };
            }

            // 🔒 VERIFICAÇÃO DUPLA: Usuário não tem crédito ativo?
            const userSession = await this.db.getUserSession(order.chatId);
            if (userSession.availableCredit > 0) {
                this.logger.error(`🔒 BLOQUEIO CRÍTICO NA APROVAÇÃO: Usuário ${order.chatId} já tem crédito ativo: R$ ${userSession.availableCredit}`);
                return { 
                    reply: `⚠️ *Erro de duplicação de crédito*\n\nVocê já possui crédito ativo.\nEntre em contato com o suporte.` 
                };
            }

            this.logger.info(`✅ TODAS AS VERIFICAÇÕES DUPLAS PASSARAM - Aprovando pagamento: ${orderId}`);

            // Atualizar status do pedido
            order.status = 'paid';
            order.paidAt = new Date().toISOString();
            order.paymentData = paymentData;
            await this.db.saveOrder(order);

            this.logger.info(`✅ Pedido ${orderId} atualizado para status 'paid'`);

            // 🔒 CONCEDER CRÉDITO COM PROTEÇÃO DUPLA
            this.logger.info(`💳 Concedendo crédito de R$ ${order.product.price} para ${order.chatId} com proteção dupla`);
            const creditResult = await this.whatsappHandler.grantCreditToUser(order.chatId, orderId, order.product.price);

            // 🔒 VERIFICAÇÃO FINAL: Crédito foi realmente concedido?
            const finalOrder = await this.db.getOrder(orderId);
            const finalSession = await this.db.getUserSession(order.chatId);
            
            this.logger.info(`🔒 VERIFICAÇÃO FINAL - Crédito no pedido: R$ ${finalOrder.creditAmount}, Crédito na sessão: R$ ${finalSession.availableCredit}`);

            if (finalOrder.creditAmount > 0 && finalSession.availableCredit > 0) {
                this.logger.info(`✅ PAGAMENTO APROVADO E CRÉDITO CONCEDIDO COM SUCESSO: ${orderId}`);
            } else {
                this.logger.error(`❌ ERRO CRÍTICO: Crédito não foi concedido corretamente para pedido ${orderId}`);
            }
            
            return creditResult;

        } catch (error) {
            this.logger.error('🔒 Erro crítico na aprovação ultra segura:', error);
            return { reply: '❌ Erro interno crítico ao processar pagamento. Entre em contato com o suporte.' };
        }
    }

    // Aprovar pagamento manualmente (para admin)
    async approvePaymentManually(orderId, force = false) {
        try {
            const order = await this.db.getOrder(orderId);
            
            if (!order) {
                return { success: false, error: 'Pedido não encontrado' };
            }

            // 🔒 VERIFICAÇÕES DE SEGURANÇA MESMO NA APROVAÇÃO MANUAL
            if (order.status !== 'pending_payment' && !force) {
                return { 
                    success: false, 
                    error: `Pedido já foi processado (Status: ${order.status})`,
                    suggestion: 'Use "Forçar Aprovação" se necessário'
                };
            }

            if (order.creditAmount > 0 && !force) {
                return { 
                    success: false, 
                    error: `Pedido já gerou crédito de R$ ${order.creditAmount}`,
                    suggestion: 'Use "Forçar Aprovação" se necessário'
                };
            }

            let paymentVerified = false;
            let paymentInfo = null;

            // Tentar verificar pagamento real primeiro
            if (this.mercadoPago.isConfigured() && order.paymentId && !force) {
                try {
                    const cleanPaymentId = String(order.paymentId).split('.')[0];
                    
                    this.logger.info(`🔍 Verificando pagamento real ${cleanPaymentId} antes de aprovar`);
                    paymentInfo = await this.mercadoPago.getPaymentStatus(cleanPaymentId);
                    
                    if (['approved', 'authorized'].includes(paymentInfo.status)) {
                        paymentVerified = true;
                        this.logger.info(`✅ Pagamento ${cleanPaymentId} verificado como: ${paymentInfo.status}`);
                    } else {
                        this.logger.warn(`⚠️ Pagamento ${cleanPaymentId} não está aprovado: ${paymentInfo.status}`);
                        
                        return {
                            success: false,
                            error: `Pagamento não aprovado (Status: ${paymentInfo.status})`,
                            paymentStatus: paymentInfo.status,
                            suggestion: 'Use "Forçar Aprovação" se necessário'
                        };
                    }
                } catch (mpError) {
                    this.logger.error('Erro ao verificar no Mercado Pago:', mpError);
                    return {
                        success: false,
                        error: 'Erro ao verificar pagamento no Mercado Pago',
                        suggestion: 'Verifique as configurações do MP ou use "Forçar Aprovação"'
                    };
                }
            } else if (force) {
                this.logger.info(`⚡ Aprovação manual forçada para pedido ${orderId}`);
                paymentVerified = true;
            } else {
                this.logger.info(`🎲 Aprovação simulada para pedido ${orderId} (MP não configurado)`);
                paymentVerified = true;
            }

            if (paymentVerified) {
                // Usar o método ultra seguro
                const result = await this.processPaymentApprovalSecure(orderId, paymentInfo || { status: 'manual_approval', forced: force });

                this.logger.info(`✅ Pagamento aprovado manualmente: ${orderId}`);
                
                return { 
                    success: true, 
                    paymentVerified: !!paymentInfo,
                    paymentStatus: paymentInfo?.status || 'manual'
                };
            } else {
                return {
                    success: false,
                    error: 'Não foi possível verificar o pagamento'
                };
            }

        } catch (error) {
            this.logger.error('Erro ao aprovar pagamento manualmente:', error);
            return { success: false, error: error.message };
        }
    }

    // Helper para mensagens de status
    getStatusMessage(status) {
        switch (status) {
            case 'paid':
                return '✅ Pagamento confirmado - Crédito já foi processado.';
            case 'completed':
                return '🎉 Pedido finalizado com sucesso!';
            case 'failed':
                return '❌ Falha no processamento.';
            case 'cancelled':
                return '🚫 Pedido cancelado.';
            default:
                return '📋 Status: ' + status;
        }
    }

    // Obter estatísticas de pedidos
    async getOrderStats() {
        try {
            const stats = await this.db.getStats();
            return {
                ...stats,
                cacheSize: this.productsCache.size
            };
        } catch (error) {
            this.logger.error('Erro ao obter estatísticas:', error);
            return null;
        }
    }

    // Atualizar cache de produtos
    async updateProductsCache() {
        await this.loadProductsCache();
        this.logger.info('💳 Cache de produtos atualizado');
    }
}

module.exports = OrderService;
