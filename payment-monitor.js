// payment-monitor.js - Monitor automático de pagamentos (VERSÃO CORRIGIDA)
const DatabaseService = require('./database-service');
const MercadoPagoService = require('./mercadopago-service');
const axios = require('axios');
const pino = require('pino');

class PaymentMonitor {
    constructor(config = {}) {
        this.config = {
            checkInterval: config.checkInterval || 30000, // 30 segundos
            maxRetries: config.maxRetries || 3,
            whatsappBotUrl: config.whatsappBotUrl || 'http://localhost:3000',
            coreSystemUrl: config.coreSystemUrl || 'http://localhost:3001',
            ...config
        };

        this.logger = pino({ level: 'info' });
        this.db = null;
        this.mercadoPago = null;
        this.isRunning = false;
        this.intervalId = null;
        this.messagesCache = new Map();
        
        this.stats = {
            checksPerformed: 0,
            paymentsApproved: 0,
            paymentsRejected: 0,
            paymentsCancelled: 0,
            ordersExpired: 0,        // 🧹 NOVO: Contador de pedidos expirados
            ordersAbandoned: 0,      // 🧹 NOVO: Contador de pedidos abandonados
            errorsCount: 0,
            lastCheck: null,
            lastCleanup: null        // 🧹 NOVO: Última limpeza
        };
    }

    async initialize() {
        try {
            this.logger.info('🤖 Inicializando Payment Monitor...');

            // Inicializar banco
            this.db = new DatabaseService('./database.sqlite');
            await this.db.initialize();
            
            // Carregar configurações e inicializar MP
            const settings = await this.db.getSettings();
            
            this.mercadoPago = new MercadoPagoService({
                publicKey: settings.mercadoPagoPublicKey || '',
                accessToken: settings.mercadoPagoAccessToken || '',
                environment: settings.mercadoPagoEnvironment || 'sandbox',
                webhookUrl: this.config.coreSystemUrl
            });

            // Carregar mensagens em cache
            const messages = await this.db.getMessages();
            Object.entries(messages).forEach(([type, message]) => {
                this.messagesCache.set(type, message);
            });

            this.logger.info('✅ Payment Monitor inicializado');
            this.logger.info(`⏰ Intervalo de verificação: ${this.config.checkInterval / 1000}s`);
            this.logger.info(`🔧 Mercado Pago configurado: ${this.mercadoPago.isConfigured()}`);

        } catch (error) {
            this.logger.error('❌ Erro ao inicializar Payment Monitor:', error);
            throw error;
        }
    }

    async start() {
        if (this.isRunning) {
            this.logger.warn('Monitor já está rodando');
            return;
        }

        this.isRunning = true;
        this.logger.info('🚀 Payment Monitor iniciado');

        // Verificação inicial
        await this.checkPendingPayments();

        // Agendar verificações periódicas
        this.intervalId = setInterval(async () => {
            await this.checkPendingPayments();
        }, this.config.checkInterval);

        // Log de status a cada minuto
        setInterval(() => {
            this.logStats();
        }, 60000);
    }

    async stop() {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        if (this.db) {
            await this.db.close();
        }

        this.logger.info('⏹️ Payment Monitor parado');
    }

    // 🧹 NOVA FUNÇÃO: Auto-limpeza de pedidos expirados
    async cleanupExpiredOrders() {
        try {
            this.logger.info('🧹 Iniciando limpeza automática de pedidos expirados...');

            // 1. Limpar pedidos muito antigos (mais de 2 horas)
            const expiredResult = await this.db.run(`
                UPDATE orders 
                SET status = 'expired_timeout',
                    error = 'Pedido expirado automaticamente após 2 horas sem pagamento'
                WHERE status = 'pending_payment' 
                AND (julianday('now') - julianday(created_at)) * 24 > 2
            `);

            if (expiredResult.changes > 0) {
                this.logger.info(`🧹 ${expiredResult.changes} pedidos expirados por timeout (2h+)`);
            }

            // 2. Limpar pedidos abandonados (sem PaymentID, mais de 30 min)
            const abandonedResult = await this.db.run(`
                UPDATE orders 
                SET status = 'abandoned',
                    error = 'Pedido abandonado - sem PaymentID após 30 minutos'
                WHERE status = 'pending_payment' 
                AND (payment_id IS NULL OR payment_id = '')
                AND (julianday('now') - julianday(created_at)) * 24 * 60 > 30
            `);

            if (abandonedResult.changes > 0) {
                this.logger.info(`🧹 ${abandonedResult.changes} pedidos abandonados limpos (30min+)`);
            }

            // 3. Limpar sessões órfãs de pedidos que foram limpos
            try {
                const orphanSessionsResult = await this.db.run(`
                    UPDATE user_sessions 
                    SET current_order_id = NULL,
                        state = NULL
                    WHERE current_order_id IS NOT NULL 
                    AND current_order_id NOT IN (
                        SELECT id FROM orders WHERE status = 'pending_payment'
                    )
                `);

                if (orphanSessionsResult.changes > 0) {
                    this.logger.info(`🧹 ${orphanSessionsResult.changes} sessões órfãs limpas`);
                }
            } catch (sessionError) {
                this.logger.warn('⚠️ Erro ao limpar sessões órfãs:', sessionError.message);
            }

            const totalCleaned = expiredResult.changes + abandonedResult.changes;
            if (totalCleaned > 0) {
                this.logger.info(`✅ Limpeza automática concluída: ${totalCleaned} pedidos processados`);
                this.stats.ordersExpired += expiredResult.changes;
                this.stats.ordersAbandoned += abandonedResult.changes;
                this.stats.lastCleanup = new Date().toISOString();
            }

        } catch (error) {
            this.logger.error('❌ Erro na limpeza automática:', error);
        }
    }

    async checkPendingPayments() {
        try {
            this.stats.checksPerformed++;
            this.stats.lastCheck = new Date().toISOString();

            this.logger.info('🔍 Verificando pagamentos pendentes...');

            // 🧹 NOVO: Fazer limpeza automática primeiro (a cada 10 verificações = ~5 minutos)
            if (this.stats.checksPerformed % 10 === 0) {
                await this.cleanupExpiredOrders();
            }

            // Buscar pedidos pendentes com PaymentID (após limpeza)
            const pendingOrders = await this.db.all(`
                SELECT * FROM orders 
                WHERE status = 'pending_payment' 
                AND payment_id IS NOT NULL 
                AND payment_id != ''
                ORDER BY created_at DESC
                LIMIT 20
            `);

            if (pendingOrders.length === 0) {
                this.logger.info('📭 Nenhum pagamento pendente encontrado');
                return;
            }

            this.logger.info(`📋 Verificando ${pendingOrders.length} pagamento(s) pendente(s)`);

            for (const orderRow of pendingOrders) {
                await this.checkOrderPayment(orderRow);
                
                // Pequena pausa entre verificações para não sobrecarregar a API
                await this.sleep(1000);
            }

        } catch (error) {
            this.stats.errorsCount++;
            this.logger.error('❌ Erro na verificação geral:', error);
        }
    }

    async checkOrderPayment(orderRow) {
        try {
            // Converter dados do banco para objeto
            const order = {
                id: orderRow.id,
                chatId: orderRow.chat_id,
                productId: orderRow.product_id,
                product: JSON.parse(orderRow.product_data),
                pixCode: orderRow.pix_code,
                paymentId: orderRow.payment_id,
                status: orderRow.status,
                createdAt: orderRow.created_at
            };

            this.logger.info(`🔍 Verificando pedido ${order.id.substring(0, 8)} - PaymentId: ${order.paymentId}`);

            if (!this.mercadoPago.isConfigured()) {
                this.logger.warn('Mercado Pago não configurado - pulando verificação real');
                return;
            }

            // Limpar PaymentId (remover decimais se houver)
            const cleanPaymentId = String(order.paymentId).split('.')[0];

            // Verificar status no Mercado Pago
            const paymentStatus = await this.mercadoPago.getPaymentStatus(cleanPaymentId);
            
            this.logger.info(`💳 Status do pagamento ${cleanPaymentId}: ${paymentStatus.status}`);

            // Processar baseado no status
            if (['approved', 'authorized'].includes(paymentStatus.status)) {
                await this.approvePayment(order, paymentStatus);
            } else if (paymentStatus.status === 'rejected') {
                await this.rejectPayment(order, paymentStatus);
            } else if (paymentStatus.status === 'cancelled') {
                await this.cancelPayment(order, paymentStatus);
            } else {
                this.logger.info(`⏳ Pagamento ${cleanPaymentId} ainda pendente: ${paymentStatus.status}`);
            }

        } catch (error) {
            this.stats.errorsCount++;
            this.logger.error(`❌ Erro ao verificar pedido ${orderRow.id}:`, error);
        }
    }

    async approvePayment(order, paymentStatus) {
        try {
            this.logger.info(`✅ Aprovando pagamento automaticamente: ${order.id.substring(0, 8)}`);
            
            // 🔧 CORREÇÃO 1: Atualizar status do pedido no banco
            await this.db.run(`
                UPDATE orders 
                SET status = 'paid', 
                    paid_at = CURRENT_TIMESTAMP,
                    error = NULL
                WHERE id = ?
            `, [order.id]);

            // 🔧 CORREÇÃO 2: CONCEDER CRÉDITO (ERA ISSO QUE ESTAVA FALTANDO!)
            this.logger.info(`💳 Concedendo crédito de R$ ${order.product.price} para ${order.chatId}`);
            
            try {
                // Conceder crédito ao usuário
                await this.db.grantCredit(order.chatId, order.id, order.product.price);
                this.logger.info(`💳 Crédito concedido com sucesso: R$ ${order.product.price}`);
                
                // Verificar se crédito foi realmente concedido
                const userSession = await this.db.getUserSession(order.chatId);
                if (userSession.availableCredit > 0) {
                    this.logger.info(`✅ Verificação: Cliente ${order.chatId} agora tem R$ ${userSession.availableCredit} de crédito`);
                    
                    // 🔧 CORREÇÃO 3: Enviar menu de crédito em vez de mensagem simples
                    try {
                        // Buscar produtos para o menu de crédito
                        const products = await this.db.getProducts();
                        const activeProducts = products.filter(p => p.active);
                        
                        let productsList = '';
                        activeProducts.forEach((product, index) => {
                            const canAfford = product.price <= userSession.availableCredit;
                            const priceDisplay = canAfford ? `💚 R$ ${product.price.toFixed(2)}` : `❌ R$ ${product.price.toFixed(2)}`;
                            productsList += `*${index + 1}.* ${product.name}\n${priceDisplay}\n\n`;
                        });

                        const creditMenuMessage = `💳 *PAGAMENTO APROVADO! VOCÊ TEM CRÉDITO!*

🎉 *Pagamento confirmado automaticamente*
💰 *Crédito disponível:* R$ ${userSession.availableCredit.toFixed(2)}
📦 *Produto pago:* ${order.product.name}

━━━━━━━━━━━━━━━━━━━
📱 *ESCOLHA UM PRODUTO PARA ATIVAR:*

${productsList}━━━━━━━━━━━━━━━━━━━
💡 *Como funciona:*
• Você já pagou, então não será cobrado novamente
• Escolha qualquer produto que caiba no seu crédito
• Se a ativação falhar, pode tentar outro produto
• Seu crédito só é consumido quando a ativação der certo

👆 *Digite o número* do produto que deseja ativar
🆘 Para suporte: digite *suporte*`;

                        await this.sendWhatsAppMessage(order.chatId, creditMenuMessage);
                        
                    } catch (menuError) {
                        this.logger.warn('⚠️ Erro ao enviar menu de crédito, enviando mensagem simples:', menuError.message);
                        
                        // Fallback: mensagem simples
                        const simpleMessage = `✅ *PAGAMENTO APROVADO!*\n\n🎯 Produto: ${order.product.name}\n💳 Crédito: R$ ${userSession.availableCredit.toFixed(2)}\n\n💡 Digite *menu* para ver opções de ativação.`;
                        await this.sendWhatsAppMessage(order.chatId, simpleMessage);
                    }
                    
                } else {
                    this.logger.error(`❌ ERRO: Crédito não foi concedido corretamente para ${order.chatId}`);
                    throw new Error('Crédito não foi concedido');
                }
                
            } catch (creditError) {
                this.logger.error(`❌ Erro crítico ao conceder crédito:`, creditError);
                
                // Tentar notificar cliente sobre erro
                try {
                    const errorMessage = `❌ *ERRO NO PROCESSAMENTO*\n\n🎯 Produto: ${order.product.name}\n⚠️ Pagamento aprovado mas houve erro ao conceder crédito\n\n📞 Entre em contato com o suporte imediatamente!`;
                    await this.sendWhatsAppMessage(order.chatId, errorMessage);
                } catch (notifyError) {
                    this.logger.error(`❌ Erro ao notificar cliente sobre erro de crédito:`, notifyError);
                }
            }

            this.stats.paymentsApproved++;
            this.logger.info(`🎉 Pagamento aprovado automaticamente: ${order.id.substring(0, 8)}`);

        } catch (error) {
            this.logger.error('❌ Erro ao aprovar pagamento:', error);
        }
    }

    async rejectPayment(order, paymentStatus) {
        try {
            this.logger.info(`❌ Rejeitando pagamento automaticamente: ${order.id.substring(0, 8)}`);
            
            // Atualizar status do pedido
            await this.db.run(`
                UPDATE orders 
                SET status = 'payment_rejected',
                    error = ?
                WHERE id = ?
            `, [`Pagamento rejeitado no Mercado Pago: ${paymentStatus.status}`, order.id]);

            // Limpar sessão do usuário
            try {
                const userSession = await this.db.getUserSession(order.chatId);
                if (userSession) {
                    userSession.state = null;
                    userSession.currentOrderId = null;
                    await this.db.saveUserSession(order.chatId, userSession);
                }
            } catch (sessionError) {
                this.logger.warn('⚠️ Erro ao limpar sessão do usuário:', sessionError.message);
            }

            // Notificar cliente
            try {
                const message = `❌ *Pagamento rejeitado*\n\n📋 Pedido: ${order.id.substring(0, 8)}...\n🎯 Produto: ${order.product.name}\n\n💳 Tente novamente com outro método de pagamento ou entre em contato com o suporte.\n\nDigite *menu* para nova tentativa.`;
                await this.sendWhatsAppMessage(order.chatId, message);
            } catch (messageError) {
                this.logger.warn('⚠️ Erro ao enviar mensagem WhatsApp:', messageError.message);
            }

            this.stats.paymentsRejected++;
            this.logger.info(`💔 Pagamento rejeitado: ${order.id.substring(0, 8)}`);

        } catch (error) {
            this.logger.error('❌ Erro ao rejeitar pagamento:', error);
        }
    }

    // 🔧 FUNÇÃO CORRIGIDA - Esta era a causa do problema!
    async cancelPayment(order, paymentStatus) {
        try {
            this.logger.info(`🚫 Cancelando pagamento: ${order.id.substring(0, 8)}`);
            
            // 🔧 CORREÇÃO: Usar apenas campos que sabemos que existem
            await this.db.run(`
                UPDATE orders 
                SET status = 'payment_cancelled',
                    error = ?
                WHERE id = ?
            `, [`Pagamento cancelado no Mercado Pago: ${paymentStatus.status}`, order.id]);

            // 🔧 CORREÇÃO: Não falhar se sessão der erro
            try {
                const userSession = await this.db.getUserSession(order.chatId);
                if (userSession) {
                    userSession.state = null;
                    userSession.currentOrderId = null;
                    await this.db.saveUserSession(order.chatId, userSession);
                }
            } catch (sessionError) {
                this.logger.warn('⚠️ Erro ao limpar sessão do usuário:', sessionError.message);
                // Não falhar o cancelamento por causa da sessão
            }

            // 🔧 CORREÇÃO: Não falhar se WhatsApp der erro
            try {
                const message = `🚫 *Pagamento cancelado*\n\n📋 Pedido: ${order.id.substring(0, 8)}...\n🎯 Produto: ${order.product.name}\n\nDigite *menu* para fazer um novo pedido.`;
                await this.sendWhatsAppMessage(order.chatId, message);
            } catch (messageError) {
                this.logger.warn('⚠️ Erro ao enviar mensagem WhatsApp:', messageError.message);
                // Não falhar o cancelamento por causa da mensagem
            }

            this.stats.paymentsCancelled++;
            this.logger.info(`🚫 Pagamento cancelado com sucesso: ${order.id.substring(0, 8)}`);

        } catch (error) {
            // 🔧 CORREÇÃO: Log mais detalhado e fallback
            this.logger.error('❌ Erro ao cancelar pagamento:', {
                orderId: order.id,
                error: error.message,
                stack: error.stack
            });
            
            // Tentar pelo menos marcar como erro no banco
            try {
                await this.db.run(`
                    UPDATE orders 
                    SET error = ? 
                    WHERE id = ?`, 
                    [`Erro ao cancelar: ${error.message}`, order.id]
                );
            } catch (fallbackError) {
                this.logger.error('❌ Erro crítico - não foi possível nem marcar erro no banco:', fallbackError);
            }
        }
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

    async sendWhatsAppMessage(chatId, message) {
        try {
            await axios.post(`${this.config.whatsappBotUrl}/send`, {
                chatId,
                message,
                type: 'text'
            });

            this.logger.info(`📱 Mensagem enviada para ${chatId.substring(0, 15)}...`);
        } catch (error) {
            this.logger.error('❌ Erro ao enviar mensagem WhatsApp:', error);
        }
    }

    logStats() {
        const uptime = process.uptime();
        const uptimeMinutes = Math.floor(uptime / 60);

        this.logger.info('📊 ESTATÍSTICAS DO MONITOR:', {
            uptime: `${uptimeMinutes} minutos`,
            verificacoesRealizadas: this.stats.checksPerformed,
            pagamentosAprovados: this.stats.paymentsApproved,
            pagamentosRejeitados: this.stats.paymentsRejected,
            pagamentosCancelados: this.stats.paymentsCancelled,
            pedidosExpirados: this.stats.ordersExpired,      // 🧹 NOVO
            pedidosAbandonados: this.stats.ordersAbandoned,  // 🧹 NOVO
            erros: this.stats.errorsCount,
            ultimaVerificacao: this.stats.lastCheck,
            ultimaLimpeza: this.stats.lastCleanup            // 🧹 NOVO
        });
    }

    getStats() {
        return {
            ...this.stats,
            isRunning: this.isRunning,
            uptime: process.uptime()
        };
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    const monitor = new PaymentMonitor({
        checkInterval: 30000, // 30 segundos
        whatsappBotUrl: process.env.WHATSAPP_BOT_URL || 'http://localhost:3000',
        coreSystemUrl: process.env.CORE_SYSTEM_URL || 'http://localhost:3001'
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Recebido SIGINT. Parando monitor...');
        await monitor.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('\n🛑 Recebido SIGTERM. Parando monitor...');
        await monitor.stop();
        process.exit(0);
    });

    // Iniciar monitor
    monitor.initialize()
        .then(() => monitor.start())
        .then(() => {
            console.log('✅ Payment Monitor iniciado com sucesso!');
            console.log('📊 Pressione Ctrl+C para parar');
        })
        .catch(error => {
            console.error('❌ Erro ao iniciar monitor:', error);
            process.exit(1);
        });
}

module.exports = PaymentMonitor;
