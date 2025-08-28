// activation-service.js - VERSÃO CORRIGIDA - Sistema de Créditos + SILÊNCIO PROFUNDO
const pino = require('pino');

class ActivationService {
    constructor(config = {}) {
        this.config = {
            ...config
        };
        
        this.logger = pino({ level: 'info' });
        this.db = null;
        this.activationManager = null;
        this.whatsappHandler = null;
    }

    // Inicializar com dependências
    initialize(dependencies) {
        this.db = dependencies.db;
        this.activationManager = dependencies.activationManager;
        this.whatsappHandler = dependencies.whatsappHandler;
        
        this.logger.info('🔧 Activation Service inicializado');
    }

    // 🔧 PROCESSAMENTO CORRIGIDO - Identifica produto correto no fluxo de crédito + SILÊNCIO PROFUNDO
    async processActivationInfo(chatId, activationData) {
        try {
            this.logger.info(`🔧 PROCESSAMENTO CORRIGIDO - Ativação para ${chatId}`);
            
            const userSession = await this.db.getUserSession(chatId);
            
            // 🔧 NOVA LÓGICA: Detectar se está no fluxo de crédito
            const isUsingCredit = userSession.availableCredit > 0 && userSession.creditOrderId;
            
            this.logger.info(`💳 Status do usuário: Crédito=${userSession.availableCredit}, UsandoCrédito=${isUsingCredit}, CreditOrderId=${userSession.creditOrderId}, CurrentOrderId=${userSession.currentOrderId}`);
            
            let targetOrder;
            let selectedProduct;
            
            if (isUsingCredit) {
                // 🔧 FLUXO DE CRÉDITO: Produto foi selecionado recentemente
                this.logger.info(`💳 FLUXO DE CRÉDITO DETECTADO - Buscando produto selecionado`);
                
                // Buscar o pedido que gerou o crédito
                const creditOrder = await this.db.getOrder(userSession.creditOrderId);
                
                if (!creditOrder) {
                    this.logger.error(`❌ Pedido de crédito ${userSession.creditOrderId} não encontrado`);
                    return { 
                        success: false,
                        reply: '❌ Erro na sessão de crédito. Entre em contato com o suporte.' 
                    };
                }
                
                // 🔧 CORREÇÃO CRÍTICA: Buscar qual produto foi RECÉM-SELECIONADO
                // Isso deveria estar armazenado na sessão quando o produto é selecionado
                selectedProduct = await this.getLastSelectedProductFromSession(userSession);
                
                if (!selectedProduct) {
                    this.logger.error(`❌ Produto selecionado não encontrado na sessão de ${chatId}`);
                    return { 
                        success: false,
                        reply: '❌ Erro: produto não identificado. Digite *menu* para selecionar novamente.' 
                    };
                }
                
                // Criar um "pedido virtual" para a ativação com o produto correto
                targetOrder = {
                    id: creditOrder.id, // Usar ID do pedido original para tracking
                    chatId: chatId,
                    productId: selectedProduct.id,
                    product: selectedProduct, // 🔧 PRODUTO CORRETO!
                    status: 'paid', // Já foi pago com crédito
                    activationData: activationData,
                    isFromCredit: true
                };
                
                this.logger.info(`✅ PRODUTO CORRETO IDENTIFICADO: ${selectedProduct.name} (ID: ${selectedProduct.id})`);
                
            } else {
                // 🔧 FLUXO NORMAL: Usar pedido atual
                this.logger.info(`💰 FLUXO NORMAL - Usando currentOrderId: ${userSession.currentOrderId}`);
                
                const orderId = userSession.currentOrderId;
                
                if (!orderId) {
                    this.logger.error(`❌ Nenhum pedido ativo para ${chatId}`);
                    return { 
                        success: false,
                        reply: '❌ Nenhum pedido ativo encontrado. Digite *menu* para começar.' 
                    };
                }
                
                targetOrder = await this.db.getOrder(orderId);
                
                if (!targetOrder) {
                    this.logger.error(`❌ Pedido ${orderId} não encontrado`);
                    return { 
                        success: false,
                        reply: '❌ Pedido não encontrado.' 
                    };
                }

                // Verificar se é um pedido pago
                if (targetOrder.status !== 'paid') {
                    this.logger.warn(`⚠️ Tentativa de ativação em pedido não pago: ${orderId}`);
                    return { 
                        success: false,
                        reply: '❌ Pagamento ainda não confirmado. Digite *verificar* para verificar o pagamento.' 
                    };
                }
                
                selectedProduct = targetOrder.product;
            }
            
            // 🔧 LOGS DETALHADOS PARA AUDITORIA
            this.logger.info(`🔧 ATIVAÇÃO CONFIGURADA:`);
            this.logger.info(`   📱 Cliente: ${chatId}`);
            this.logger.info(`   🎯 Produto: ${selectedProduct.name} (ID: ${selectedProduct.id})`);
            this.logger.info(`   🛠️ Módulo: ${selectedProduct.activationModule}`);
            this.logger.info(`   💳 Usando crédito: ${isUsingCredit}`);
            this.logger.info(`   📋 Dados: ${activationData.substring(0, 100)}...`);
            
            // 🔇 ATIVAR SILÊNCIO PROFUNDO ANTES DA ATIVAÇÃO
            this.logger.info(`🔇 ATIVANDO SILÊNCIO para ${chatId} durante ativação de ${selectedProduct.name}`);
            userSession.state = 'processing_activation';
            await this.db.saveUserSession(chatId, userSession);
            
            // Atualizar dados de ativação (usar pedido original se for crédito)
            if (isUsingCredit) {
                // Para crédito, salvar dados no pedido original
                const originalOrder = await this.db.getOrder(userSession.creditOrderId);
                originalOrder.activationData = activationData;
                originalOrder.status = 'processing';
                // 🔧 CRÍTICO: Salvar qual produto foi REALMENTE selecionado
                originalOrder.selectedProductForActivation = {
                    id: selectedProduct.id,
                    name: selectedProduct.name,
                    activationModule: selectedProduct.activationModule
                };
                await this.db.saveOrder(originalOrder);
                
                this.logger.info(`💾 Dados salvos no pedido original ${userSession.creditOrderId} com produto selecionado: ${selectedProduct.name}`);
            } else {
                // Fluxo normal
                targetOrder.activationData = activationData;
                targetOrder.status = 'processing';
                await this.db.saveOrder(targetOrder);
            }
            
            // Enviar confirmação imediata para o usuário
            const confirmationMessage = `🔄 *INICIANDO ATIVAÇÃO*

🎯 **${selectedProduct.name}**
📋 Dados recebidos e verificados

⏳ *Processando ativação...*
Por favor aguarde o resultado final.

🔇 *Sistema em modo silencioso*
Não responderemos até a conclusão.`;

            await this.whatsappHandler.sendMessage(chatId, confirmationMessage);
            
            // 🔧 ENVIAR PARA ATIVAÇÃO COM PRODUTO CORRETO EM BACKGROUND
            setImmediate(async () => {
                await this.sendToActivationModule(targetOrder);
            });
            
            return {
                success: true,
                reply: null // Já enviou confirmação acima
            };
            
        } catch (error) {
            this.logger.error('❌ Erro crítico no processamento de ativação:', error);
            
            // 🔇 DESATIVAR SILÊNCIO EM CASO DE ERRO
            try {
                const userSession = await this.db.getUserSession(chatId);
                userSession.state = 'awaiting_activation_info';
                await this.db.saveUserSession(chatId, userSession);
            } catch (cleanupError) {
                this.logger.error('Erro ao limpar estado:', cleanupError);
            }
            
            return { 
                success: false, 
                reply: '❌ Erro interno. Tente novamente.' 
            };
        }
    }

    // 🔧 NOVO MÉTODO: Buscar produto selecionado na sessão
    async getLastSelectedProductFromSession(userSession) {
        try {
            // Método 1: Verificar se foi salvo nos dados da sessão
            if (userSession.data && userSession.data.selectedProductId) {
                const productId = userSession.data.selectedProductId;
                const product = await this.db.getProduct(productId);
                
                if (product) {
                    this.logger.info(`✅ Produto encontrado nos dados da sessão: ${product.name}`);
                    return product;
                }
            }
            
            // Método 2: Para compatibilidade, tentar buscar o último produto selecionado
            // através de logs ou outras fontes (implementar se necessário)
            
            this.logger.warn(`⚠️ Produto selecionado não encontrado na sessão`);
            return null;
            
        } catch (error) {
            this.logger.error('Erro ao buscar produto da sessão:', error);
            return null;
        }
    }

    // Enviar pedido para o módulo de ativação específico
    async sendToActivationModule(order) {
        try {
            // 🔧 USAR PRODUTO CORRETO (pode ser diferente do produto original)
            const productToActivate = order.selectedProductForActivation || order.product;
            
            this.logger.info(`🚀 INICIANDO ATIVAÇÃO:`);
            this.logger.info(`   🎯 Produto: ${productToActivate.name}`);
            this.logger.info(`   🛠️ Módulo: ${productToActivate.activationModule}`);
            this.logger.info(`   📋 Dados: ${order.activationData}`);
        
            const result = await this.activationManager.activateProduct({
                ...order,
                product: productToActivate // 🔧 Garantir produto correto
            }, order.activationData);
        
            this.logger.info(`🔧 RESULTADO DA ATIVAÇÃO:`, result);
        
            await this.processActivationResult(order.id, result.success, result.result, result.error);
        
        } catch (error) {
            this.logger.error('❌ Erro na ativação:', error);
            await this.processActivationResult(order.id, false, null, error.message);
        }
    }
// Processar resultado da ativação + DESATIVAR SILÊNCIO - VERSÃO CORRIGIDA
    async processActivationResult(orderId, success, result, error = null) {
        try {
            this.logger.info(`🔧 Processando resultado da ativação para pedido ${orderId} - Sucesso: ${success}`);
            
            const order = await this.db.getOrder(orderId);
            
            if (!order) {
                this.logger.error(`Pedido ${orderId} não encontrado para resultado`);
                return;
            }

            // 🔇 BUSCAR SESSÃO ANTES DE MODIFICAR
            const userSession = await this.db.getUserSession(order.chatId);
            this.logger.info(`🔇 DESATIVANDO SILÊNCIO para ${order.chatId} - resultado: ${success ? 'sucesso' : 'falha'}`);

            // 🔧 USAR NOME DO PRODUTO CORRETO NAS MENSAGENS
            const activatedProductName = order.selectedProductForActivation?.name || order.product.name;

            // Atualizar status do pedido
            order.status = success ? 'completed' : 'failed';
            order.result = result;
            order.error = error;
            order.completedAt = new Date().toISOString();
            
            await this.db.saveOrder(order);
            
            this.logger.info(`🔧 Pedido ${orderId} atualizado - Status: ${order.status} - Produto: ${activatedProductName}`);
            
            if (success) {
                // ✅ SUCESSO: SEQUÊNCIA CORRETA DE LIMPEZA
                this.logger.info(`✅ Ativação bem-sucedida de ${activatedProductName} - Iniciando limpeza de créditos`);
                
                // 🔧 CORREÇÃO: Limpar crédito ANTES de limpar a sessão
                this.logger.info(`💳 Limpando crédito para ${order.chatId} - Crédito atual: R$ ${userSession.availableCredit}`);
                await this.db.clearCredit(order.chatId, 'Ativação bem-sucedida');
                
                // 🔇 DESATIVAR SILÊNCIO - SUCESSO (APÓS limpar crédito)
                userSession.state = null;
                userSession.currentOrderId = null;
                userSession.creditOrderId = null;
                userSession.availableCredit = 0; // 🔧 GARANTIR que está zerado
                await this.db.saveUserSession(order.chatId, userSession);
                
                this.logger.info(`🧹 Sessão limpa para ${order.chatId} - Cliente retorna ao estado inicial`);
                
                const messageType = 'activation_success';
                const message = this.whatsappHandler.formatMessage(messageType, {
                    product_name: activatedProductName,
                    result: result || ''
                });
                
                await this.whatsappHandler.sendMessage(order.chatId, message);
                
                this.logger.info(`✅ FLUXO COMPLETO: Cliente ${order.chatId} retornou ao estado inicial sem créditos`);
                
            } else {
                // ❌ FALHA: Manter crédito e permitir nova tentativa
                this.logger.info(`❌ Ativação de ${activatedProductName} falhou - Cliente mantém crédito para nova tentativa`);
                
                if (userSession.availableCredit > 0) {
                    // 🔇 DESATIVAR SILÊNCIO - FALHA COM CRÉDITO
                    this.logger.info(`💳 Restaurando sessão de crédito para ${order.chatId}`);
                    
                    // 🔧 CORREÇÃO: Restaurar crédito se foi usado durante a tentativa
                    const originalOrder = await this.db.getOrder(userSession.creditOrderId);
                    if (originalOrder && userSession.availableCredit === 0) {
                        await this.db.grantCredit(order.chatId, originalOrder.id, originalOrder.product.price);
                        this.logger.info(`💳 Crédito restaurado: R$ ${originalOrder.product.price}`);
                    }
                    
                    // Voltar para menu de crédito
                    userSession.state = 'credit_menu';
                    await this.db.saveUserSession(order.chatId, userSession);
                    
                    // Atualizar sessão após restaurar crédito
                    const updatedSession = await this.db.getUserSession(order.chatId);
                    
                    // Enviar erro + menu de crédito
                    const errorMessage = `❌ *ERRO NA ATIVAÇÃO*

🎯 ${activatedProductName}
⚠️ ${error || 'Falha na ativação'}

💡 *Não se preocupe!* Seu crédito foi preservado.
Tente novamente ou escolha outro produto.

━━━━━━━━━━━━━━━━━━━
💳 *Você ainda tem R$ ${updatedSession.availableCredit.toFixed(2)} em crédito!*

Digite *menu* para ver os produtos disponíveis.`;
                    
                    await this.whatsappHandler.sendMessage(order.chatId, errorMessage);
                    
                } else {
                    // 🔇 DESATIVAR SILÊNCIO - FALHA SEM CRÉDITO
                    userSession.state = null;
                    userSession.currentOrderId = null;
                    await this.db.saveUserSession(order.chatId, userSession);
                    
                    // Enviar mensagem de erro
                    const errorMessage = `❌ *ATIVAÇÃO FALHOU*

🎯 ${activatedProductName}
⚠️ ${error || 'Falha na ativação'}

💡 Seu pagamento está seguro. Você pode:
• Tentar novamente com o mesmo produto
• Escolher outro produto
• Entrar em contato com o suporte

Digite *menu* para fazer um novo pedido.`;
                    
                    await this.whatsappHandler.sendMessage(order.chatId, errorMessage);
                }
            }
            
        } catch (error) {
            this.logger.error('Erro ao processar resultado da ativação:', error);
            
            // 🔇 EMERGÊNCIA: Desativar silêncio em caso de erro crítico
            try {
                const userSession = await this.db.getUserSession(order.chatId);
                userSession.state = null;
                await this.db.saveUserSession(order.chatId, userSession);
                
                await this.whatsappHandler.sendMessage(order.chatId, 
                    '❌ Erro interno no processamento. Digite *menu* para tentar novamente.'
                );
            } catch (emergencyError) {
                this.logger.error('Erro crítico no processamento:', emergencyError);
            }
        }
    }

    // Reprocessar ativação (para casos de falha)
    async retryActivation(orderId) {
        try {
            const order = await this.db.getOrder(orderId);
            
            if (!order) {
                return { success: false, error: 'Pedido não encontrado' };
            }

            if (!order.activationData) {
                return { success: false, error: 'Dados de ativação não encontrados' };
            }

            this.logger.info(`🔄 Reprocessando ativação para pedido ${orderId}`);
            
            // Resetar status para processing
            order.status = 'processing';
            order.error = null;
            await this.db.saveOrder(order);
            
            // Tentar ativação novamente
            await this.sendToActivationModule(order);
            
            return { success: true, message: 'Ativação reprocessada' };
            
        } catch (error) {
            this.logger.error('Erro ao reprocessar ativação:', error);
            return { success: false, error: error.message };
        }
    }

    // Cancelar ativação
    async cancelActivation(orderId, reason = 'Cancelado pelo admin') {
        try {
            const order = await this.db.getOrder(orderId);
            
            if (!order) {
                return { success: false, error: 'Pedido não encontrado' };
            }

            // Atualizar status para cancelado
            order.status = 'cancelled';
            order.error = reason;
            order.completedAt = new Date().toISOString();
            await this.db.saveOrder(order);
            
            // 🔇 DESATIVAR SILÊNCIO SE ESTIVER ATIVO
            const userSession = await this.db.getUserSession(order.chatId);
            if (userSession.state === 'processing_activation') {
                userSession.state = null;
                userSession.currentOrderId = null;
                await this.db.saveUserSession(order.chatId, userSession);
                this.logger.info(`🔇 Silêncio desativado devido ao cancelamento para ${order.chatId}`);
            }
            
            // Notificar cliente
            const message = `🚫 *Ativação Cancelada*\n\n🎯 ${order.product.name}\n📋 Motivo: ${reason}\n\n💬 Entre em contato com o suporte se necessário.\n\nDigite *menu* para fazer um novo pedido.`;
            
            await this.whatsappHandler.sendMessage(order.chatId, message);
            
            this.logger.info(`🚫 Ativação cancelada para pedido ${orderId}: ${reason}`);
            
            return { success: true, message: 'Ativação cancelada' };
            
        } catch (error) {
            this.logger.error('Erro ao cancelar ativação:', error);
            return { success: false, error: error.message };
        }
    }

    // Obter ativações pendentes
    async getPendingActivations() {
        try {
            const pendingOrders = await this.db.all(`
                SELECT * FROM orders 
                WHERE status IN ('processing', 'paid') 
                AND activation_data IS NOT NULL
                ORDER BY created_at ASC
            `);
            
            return pendingOrders.map(row => ({
                id: row.id,
                chatId: row.chat_id,
                product: JSON.parse(row.product_data),
                selectedProductForActivation: row.selected_product_for_activation ? JSON.parse(row.selected_product_for_activation) : null,
                activationData: row.activation_data,
                status: row.status,
                createdAt: row.created_at,
                paidAt: row.paid_at
            }));
            
        } catch (error) {
            this.logger.error('Erro ao obter ativações pendentes:', error);
            return [];
        }
    }

    // Obter ativações falhadas
    async getFailedActivations() {
        try {
            const failedOrders = await this.db.all(`
                SELECT * FROM orders 
                WHERE status = 'failed'
                ORDER BY completed_at DESC
                LIMIT 50
            `);
            
            return failedOrders.map(row => ({
                id: row.id,
                chatId: row.chat_id,
                product: JSON.parse(row.product_data),
                selectedProductForActivation: row.selected_product_for_activation ? JSON.parse(row.selected_product_for_activation) : null,
                activationData: row.activation_data,
                error: row.error,
                completedAt: row.completed_at
            }));
            
        } catch (error) {
            this.logger.error('Erro ao obter ativações falhadas:', error);
            return [];
        }
    }

    // Estatísticas de ativação
    async getActivationStats() {
        try {
            const totalActivations = await this.db.get('SELECT COUNT(*) as count FROM orders WHERE status IN ("completed", "failed")');
            const successfulActivations = await this.db.get('SELECT COUNT(*) as count FROM orders WHERE status = "completed"');
            const failedActivations = await this.db.get('SELECT COUNT(*) as count FROM orders WHERE status = "failed"');
            const pendingActivations = await this.db.get('SELECT COUNT(*) as count FROM orders WHERE status IN ("processing", "paid") AND activation_data IS NOT NULL');
            
            const successRate = totalActivations.count > 0 
                ? (successfulActivations.count / totalActivations.count * 100).toFixed(2)
                : 0;
            
            return {
                total: totalActivations.count,
                successful: successfulActivations.count,
                failed: failedActivations.count,
                pending: pendingActivations.count,
                successRate: parseFloat(successRate)
            };
            
        } catch (error) {
            this.logger.error('Erro ao obter estatísticas de ativação:', error);
            return {
                total: 0,
                successful: 0,
                failed: 0,
                pending: 0,
                successRate: 0
            };
        }
    }

    // Testar módulo de ativação
    async testActivationModule(moduleId) {
        try {
            if (!this.activationManager) {
                return { success: false, error: 'Activation Manager não inicializado' };
            }
            
            const result = await this.activationManager.testModule(moduleId);
            return result;
            
        } catch (error) {
            this.logger.error(`Erro ao testar módulo ${moduleId}:`, error);
            return { success: false, error: error.message };
        }
    }

    // Listar módulos disponíveis
    getAvailableModules() {
        if (!this.activationManager) {
            return [];
        }
        
        return this.activationManager.getAvailableModules();
    }

    // Recarregar módulos de ativação
    async reloadModules() {
        try {
            if (!this.activationManager) {
                return { success: false, error: 'Activation Manager não inicializado' };
            }
            
            const result = await this.activationManager.reloadModules();
            this.logger.info('🔄 Módulos de ativação recarregados');
            return result;
            
        } catch (error) {
            this.logger.error('Erro ao recarregar módulos:', error);
            return { success: false, error: error.message };
        }
    }

    // 🔇 NOVO MÉTODO: Forçar desbloqueio de usuário em silêncio (emergência)
    async forceUnblockUser(chatId, reason = 'Desbloqueio forçado pelo admin') {
        try {
            this.logger.warn(`🔇 DESBLOQUEIO FORÇADO para ${chatId} - Motivo: ${reason}`);
            
            const userSession = await this.db.getUserSession(chatId);
            
            if (userSession.state === 'processing_activation') {
                userSession.state = null;
                await this.db.saveUserSession(chatId, userSession);
                
                await this.whatsappHandler.sendMessage(chatId, 
                    `🔓 *SISTEMA DESBLOQUEADO*\n\nO processamento foi interrompido pelo administrador.\n\nDigite *menu* para continuar.`
                );
                
                this.logger.info(`🔇 Usuário ${chatId} desbloqueado com sucesso`);
                return { success: true, message: 'Usuário desbloqueado' };
            } else {
                this.logger.info(`🔇 Usuário ${chatId} não estava em silêncio`);
                return { success: false, message: 'Usuário não estava em silêncio' };
            }
            
        } catch (error) {
            this.logger.error('Erro ao desbloquear usuário:', error);
            return { success: false, error: error.message };
        }
    }

    // 🔇 NOVO MÉTODO: Listar usuários em silêncio
    async getUsersInSilence() {
        try {
            const silentUsers = await this.db.all(`
                SELECT chat_id, state, current_order_id, updated_at 
                FROM user_sessions 
                WHERE state = 'processing_activation'
                ORDER BY updated_at DESC
            `);
            
            return silentUsers.map(user => ({
                chatId: user.chat_id.substring(0, 15) + '...',
                orderId: user.current_order_id?.substring(0, 8) + '...',
                silenceSince: user.updated_at,
                duration: Math.round((Date.now() - new Date(user.updated_at).getTime()) / 1000)
            }));
            
        } catch (error) {
            this.logger.error('Erro ao listar usuários em silêncio:', error);
            return [];
        }
    }

    // 🔇 NOVO MÉTODO: Estatísticas do silêncio
    async getSilenceStats() {
        try {
            const totalSilent = await this.db.get(`
                SELECT COUNT(*) as count 
                FROM user_sessions 
                WHERE state = 'processing_activation'
            `);

            const longestSilence = await this.db.get(`
                SELECT updated_at 
                FROM user_sessions 
                WHERE state = 'processing_activation' 
                ORDER BY updated_at ASC 
                LIMIT 1
            `);

            let longestDuration = 0;
            if (longestSilence) {
                longestDuration = Math.round((Date.now() - new Date(longestSilence.updated_at).getTime()) / 1000);
            }

            return {
                currentlySilent: totalSilent.count,
                longestSilenceDuration: longestDuration,
                silenceEnabled: true
            };
            
        } catch (error) {
            this.logger.error('Erro ao obter estatísticas de silêncio:', error);
            return {
                currentlySilent: 0,
                longestSilenceDuration: 0,
                silenceEnabled: true
            };
        }
    }
}

module.exports = ActivationService;
