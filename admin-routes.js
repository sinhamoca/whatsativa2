// admin-routes.js - Rotas Administrativas
const express = require('express');
const path = require('path');
const pino = require('pino');

class AdminRoutes {
    constructor(config = {}) {
        this.config = {
            ...config
        };
        
        this.logger = pino({ level: 'info' });
        this.router = express.Router();
        
        // Dependências serão injetadas
        this.db = null;
        this.mercadoPago = null;
        this.orderService = null;
        this.activationService = null;
        this.paymentMonitor = null;
    }

    // Inicializar com dependências
    initialize(dependencies) {
        this.db = dependencies.db;
        this.mercadoPago = dependencies.mercadoPago;
        this.orderService = dependencies.orderService;
        this.activationService = dependencies.activationService;
        this.paymentMonitor = dependencies.paymentMonitor;

        this.whatsappHandler = dependencies.whatsappHandler; // Para envio de mensagens
        
        this.setupRoutes();
        this.logger.info('🌐 Admin Routes inicializadas');
    }

    // Configurar todas as rotas administrativas
    setupRoutes() {
        // === ROTAS DE PRODUTOS ===
        this.router.get('/api/admin/products', this.getProducts.bind(this));
        this.router.post('/api/admin/products', this.saveProduct.bind(this));
        this.router.delete('/api/admin/products/:id', this.deleteProduct.bind(this));
        this.router.get('/api/admin/activations/completed', this.getCompletedActivations.bind(this));

        // === ROTAS DE PEDIDOS ===
        this.router.get('/api/admin/orders', this.getOrders.bind(this));
        this.router.post('/api/admin/orders/:id/approve', this.approvePayment.bind(this));
        this.router.post('/api/admin/orders/:id/retry', this.retryActivation.bind(this));
        this.router.post('/api/admin/orders/:id/cancel', this.cancelOrder.bind(this));

        // === ROTAS DE MENSAGENS ===
        this.router.get('/api/admin/messages', this.getMessages.bind(this));
        this.router.post('/api/admin/messages', this.saveMessage.bind(this));
        
        // NOVA: Testar mensagem específica de produto
        this.router.post('/api/admin/test-product-message/:productId', this.testProductMessage.bind(this));

        // === ROTAS DE CONFIGURAÇÕES ===
        this.router.get('/api/admin/settings', this.getSettings.bind(this));
        this.router.post('/api/admin/settings', this.saveSettings.bind(this));

        // === ROTAS DE ESTATÍSTICAS ===
        this.router.get('/api/admin/stats', this.getStats.bind(this));

        // === ROTAS DO PAYMENT MONITOR ===
        this.router.get('/api/admin/monitor-stats', this.getMonitorStats.bind(this));
        this.router.post('/api/admin/monitor/:action', this.controlMonitor.bind(this));

        // === ROTAS DE ATIVAÇÃO ===
        this.router.get('/api/admin/activations/pending', this.getPendingActivations.bind(this));
        this.router.get('/api/admin/activations/failed', this.getFailedActivations.bind(this));
        this.router.get('/api/admin/modules', this.getActivationModules.bind(this));
        this.router.post('/api/admin/modules/:id/test', this.testModule.bind(this));
        this.router.post('/api/admin/modules/reload', this.reloadModules.bind(this));

        // === ROTAS DE PAGAMENTO ===
        this.router.post('/api/payment/verify/:orderId', this.verifyPayment.bind(this));
        this.router.post('/api/admin/test-mercadopago', this.testMercadoPago.bind(this));

        // === ROTAS DE USUÁRIOS ===
        this.router.get('/api/admin/users', this.getUsers.bind(this));
        this.router.get('/api/admin/users/:chatId/history', this.getUserHistory.bind(this));
        this.router.post('/api/admin/users/:chatId/reset-session', this.resetUserSession.bind(this));
        this.router.post('/api/admin/users/:chatId/adjust-credit', this.adjustUserCredit.bind(this));
        this.router.post('/api/admin/users/:chatId/send-message', this.sendMessageToUser.bind(this));
        this.router.get('/api/admin/users/stats', this.getUsersStats.bind(this));
        this.router.post('/api/admin/users/:chatId/block', this.blockUser.bind(this));

        // === NOVAS ROTAS DE BROADCAST ===
        this.router.post('/api/admin/broadcast', this.sendBroadcastMessage.bind(this));
        this.router.get('/api/admin/broadcast/history', this.getBroadcastHistory.bind(this));

        // === ROTA DO PAINEL ADMIN ===
        this.router.get('/admin', this.serveAdminPanel.bind(this));
        this.router.get('/admin/', this.serveAdminPanel.bind(this));

        this.logger.info('🌐 Rotas administrativas configuradas');
    }

    // === PRODUTOS ===

    async getProducts(req, res) {
        try {
            const products = await this.db.getProducts();
            res.json(products);
        } catch (error) {
            this.logger.error('Erro ao buscar produtos:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async saveProduct(req, res) {
        try {
            const product = req.body;
            product.active = product.active !== false;
            product.currency = product.currency || 'BRL';
            
            // NOVA: Incluir mensagem personalizada de confirmação
            if (product.paymentConfirmedMessage) {
                product.paymentConfirmedMessage = product.paymentConfirmedMessage.trim();
            }
            
            await this.db.saveProduct(product);
            
            // Atualizar cache do order service
            await this.orderService.updateProductsCache();
            
            this.logger.info(`Produto ${product.id} salvo/atualizado${product.paymentConfirmedMessage ? ' com mensagem personalizada' : ''}`);
            
            res.json({ success: true, product });
        } catch (error) {
            this.logger.error('Erro ao salvar produto:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async deleteProduct(req, res) {
        try {
            const { id } = req.params;
            
            // Verificar se há pedidos vinculados ao produto
            const orders = await this.db.all('SELECT COUNT(*) as count FROM orders WHERE product_id = ?', [id]);
            
            if (orders[0].count > 0) {
                return res.status(400).json({
                    success: false,
                    error: `Não é possível excluir o produto. Existem ${orders[0].count} pedido(s) vinculado(s) a ele.`
                });
            }
            
            await this.db.run('DELETE FROM products WHERE id = ?', [id]);
            
            // Atualizar cache do order service
            await this.orderService.updateProductsCache();
            
            this.logger.info(`Produto ${id} excluído`);
            
            res.json({ success: true });
        } catch (error) {
            this.logger.error('Erro ao excluir produto:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // === PEDIDOS ===

    async getOrders(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 50;
            const status = req.query.status;
            
            let query = 'SELECT * FROM orders';
            let params = [];
            
            if (status && status !== 'all') {
                query += ' WHERE status = ?';
                params.push(status);
            }
            
            query += ' ORDER BY created_at DESC LIMIT ?';
            params.push(limit);
            
            const rows = await this.db.all(query, params);
            
            const orders = rows.map(row => ({
                id: row.id,
                chatId: row.chat_id,
                productId: row.product_id,
                product: JSON.parse(row.product_data),
                selectedProductForActivation: row.selected_product_for_activation ? 
                    JSON.parse(row.selected_product_for_activation) : null,
                pixCode: row.pix_code,
                paymentId: row.payment_id,
                status: row.status,
                activationData: row.activation_data,
                result: row.result,
                error: row.error,
                manualApproval: Boolean(row.manual_approval),
                creditAmount: row.credit_amount || 0,
                creditUsed: Boolean(row.credit_used),
                createdAt: row.created_at,
                paidAt: row.paid_at,
                completedAt: row.completed_at
            }));
            
            res.json(orders);
        } catch (error) {
            this.logger.error('Erro ao buscar pedidos:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async approvePayment(req, res) {
        try {
            const { id } = req.params;
            const { reason = 'Aprovação manual do administrador' } = req.body;
            
            this.logger.info(`💳 Aprovação manual do pagamento: ${id}`);
            
            const order = await this.db.getOrder(id);
            if (!order) {
                return res.status(404).json({ success: false, error: 'Pedido não encontrado' });
            }
            
            // Marcar como aprovado manualmente
            await this.db.run(`
                UPDATE orders 
                SET status = 'paid', manual_approval = 1, paid_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `, [id]);
            
            // Processar ativação
            const result = await this.orderService.processPaymentConfirmation(id, {
                manual: true,
                reason: reason
            });
            
            res.json({ success: true, result });
        } catch (error) {
            this.logger.error('Erro ao aprovar pagamento:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async retryActivation(req, res) {
        try {
            const { id } = req.params;
            
            this.logger.info(`🔄 Tentativa manual de ativação: ${id}`);
            
            const order = await this.db.getOrder(id);
            if (!order) {
                return res.status(404).json({ success: false, error: 'Pedido não encontrado' });
            }
            
            if (order.status !== 'paid') {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Pedido deve estar com status "paid" para tentar ativação' 
                });
            }
            
            // Tentar ativação novamente
            const result = await this.activationService.processActivation(order);
            
            res.json({ success: true, result });
        } catch (error) {
            this.logger.error('Erro ao tentar ativação:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async cancelOrder(req, res) {
        try {
            const { id } = req.params;
            const { reason = 'Cancelado pelo administrador' } = req.body;
            
            this.logger.info(`❌ Cancelamento de pedido: ${id}`);
            
            await this.db.run(`
                UPDATE orders 
                SET status = 'cancelled', error = ? 
                WHERE id = ?
            `, [reason, id]);
            
            res.json({ success: true });
        } catch (error) {
            this.logger.error('Erro ao cancelar pedido:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // === MENSAGENS ===

    async getMessages(req, res) {
        try {
            const messages = await this.db.getMessages();
            
            // Converter formato do banco para array
            const messagesArray = Object.entries(messages).map(([type, content]) => ({
                type,
                content
            }));
            
            res.json(messagesArray);
        } catch (error) {
            this.logger.error('Erro ao buscar mensagens:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async saveMessage(req, res) {
        try {
            const { type, content } = req.body;
            
            await this.db.run(`
                INSERT OR REPLACE INTO messages (type, content, updated_at) 
                VALUES (?, ?, CURRENT_TIMESTAMP)
            `, [type, content]);
            
            this.logger.info(`Mensagem ${type} salva`);
            
            res.json({ success: true });
        } catch (error) {
            this.logger.error('Erro ao salvar mensagem:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Testar mensagem específica de produto
    async testProductMessage(req, res) {
        try {
            const { productId } = req.params;
            const { messageType, testChatId } = req.body;
            
            if (!testChatId) {
                return res.status(400).json({
                    success: false,
                    error: 'testChatId é obrigatório'
                });
            }
            
            this.logger.info(`🧪 Testando mensagem ${messageType} do produto ${productId} para ${testChatId}`);
            
            // Buscar produto
            const product = await this.db.get('SELECT * FROM products WHERE id = ?', [productId]);
            if (!product) {
                return res.status(404).json({
                    success: false,
                    error: 'Produto não encontrado'
                });
            }
            
            // Buscar WhatsApp Handler
            const whatsappHandler = this.whatsappHandler || this.orderService?.whatsappHandler;
            
            if (!whatsappHandler) {
                return res.status(500).json({
                    success: false,
                    error: 'WhatsApp Handler não disponível'
                });
            }
            
            // Preparar mensagem de teste
            let testMessage = '';
            
            if (messageType === 'payment_confirmed' && product.payment_confirmed_message) {
                testMessage = `🧪 *TESTE - MENSAGEM PERSONALIZADA*\n\n${product.payment_confirmed_message}\n\n━━━━━━━━━━━━━━━━━━━\n💡 Esta é uma mensagem de teste da confirmação de pagamento personalizada para o produto "${product.name}".`;
            } else {
                // Usar mensagem padrão
                const messages = await this.db.getMessages();
                const defaultMessage = messages[messageType] || 'Mensagem não encontrada';
                testMessage = `🧪 *TESTE - MENSAGEM PADRÃO*\n\n${defaultMessage}\n\n━━━━━━━━━━━━━━━━━━━\n💡 Esta é uma mensagem de teste do tipo "${messageType}".`;
            }
            
            // Enviar mensagem de teste
            const result = await whatsappHandler.sendMessage(testChatId, testMessage);
            
            if (result.success) {
                res.json({
                    success: true,
                    message: 'Mensagem de teste enviada com sucesso'
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Falha ao enviar mensagem de teste: ' + result.error
                });
            }
            
        } catch (error) {
            this.logger.error('Erro ao testar mensagem de produto:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // === CONFIGURAÇÕES ===

    async getSettings(req, res) {
        try {
            const settings = await this.db.getSettings();
            res.json(settings);
        } catch (error) {
            this.logger.error('Erro ao buscar configurações:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async saveSettings(req, res) {
        try {
            const settings = req.body;
            
            for (const [key, value] of Object.entries(settings)) {
                await this.db.run(`
                    INSERT OR REPLACE INTO settings (key, value, updated_at) 
                    VALUES (?, ?, CURRENT_TIMESTAMP)
                `, [key, value]);
            }
            
            // Atualizar configurações do Mercado Pago
            if (settings.mercadopago_public_key || settings.mercadopago_access_token) {
                this.mercadoPago.updateConfig({
                    publicKey: settings.mercadopago_public_key,
                    accessToken: settings.mercadopago_access_token,
                    webhookUrl: settings.webhook_url
                });
            }
            
            this.logger.info('Configurações salvas');
            
            res.json({ success: true });
        } catch (error) {
            this.logger.error('Erro ao salvar configurações:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // === ESTATÍSTICAS ===

    async getStats(req, res) {
        try {
            const stats = await this.db.getStats();
            
            // Estatísticas adicionais
            const totalRevenue = await this.db.get(`
                SELECT SUM(JSON_EXTRACT(product_data, '$.price')) as total 
                FROM orders 
                WHERE status IN ('paid', 'completed')
            `);
            
            const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const ordersLast24h = await this.db.get(`
                SELECT COUNT(*) as count 
                FROM orders 
                WHERE created_at > ?
            `, [last24h]);
            
            res.json({
                ...stats,
                totalRevenue: totalRevenue.total || 0,
                ordersLast24h: ordersLast24h.count || 0,
                services: {
                    database: this.db.isConnected,
                    mercadoPago: this.mercadoPago.isConfigured(),
                    paymentMonitor: this.paymentMonitor ? this.paymentMonitor.isRunning : false
                }
            });
        } catch (error) {
            this.logger.error('Erro ao buscar estatísticas:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // === PAYMENT MONITOR ===

    async getMonitorStats(req, res) {
        try {
            if (!this.paymentMonitor) {
                return res.status(503).json({
                    success: false,
                    error: 'Payment Monitor não disponível'
                });
            }
            
            const stats = this.paymentMonitor.getStats();
            res.json(stats);
        } catch (error) {
            this.logger.error('Erro ao buscar stats do monitor:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async controlMonitor(req, res) {
        try {
            const { action } = req.params;
            
            if (!this.paymentMonitor) {
                return res.status(503).json({
                    success: false,
                    error: 'Payment Monitor não disponível'
                });
            }
            
            let result;
            switch (action) {
                case 'start':
                    result = await this.paymentMonitor.start();
                    break;
                case 'stop':
                    result = await this.paymentMonitor.stop();
                    break;
                case 'restart':
                    await this.paymentMonitor.stop();
                    result = await this.paymentMonitor.start();
                    break;
                default:
                    return res.status(400).json({
                        success: false,
                        error: 'Ação inválida. Use: start, stop ou restart'
                    });
            }
            
            res.json({ success: true, result });
        } catch (error) {
            this.logger.error('Erro ao controlar monitor:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // === ATIVAÇÕES ===

    async getPendingActivations(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 50;
            
            const rows = await this.db.all(`
                SELECT * FROM orders 
                WHERE status = 'paid' 
                ORDER BY paid_at DESC 
                LIMIT ?
            `, [limit]);
            
            const pendingActivations = rows.map(row => ({
                id: row.id,
                chatId: row.chat_id,
                productId: row.product_id,
                product: JSON.parse(row.product_data),
                selectedProductForActivation: row.selected_product_for_activation ? 
                    JSON.parse(row.selected_product_for_activation) : null,
                paidAt: row.paid_at,
                activationData: row.activation_data,
                error: row.error
            }));
            
            res.json(pendingActivations);
        } catch (error) {
            this.logger.error('Erro ao buscar ativações pendentes:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getFailedActivations(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 50;
            
            const rows = await this.db.all(`
                SELECT * FROM orders 
                WHERE status = 'failed' 
                ORDER BY created_at DESC 
                LIMIT ?
            `, [limit]);
            
            const failedActivations = rows.map(row => ({
                id: row.id,
                chatId: row.chat_id,
                productId: row.product_id,
                product: JSON.parse(row.product_data),
                selectedProductForActivation: row.selected_product_for_activation ? 
                    JSON.parse(row.selected_product_for_activation) : null,
                error: row.error,
                createdAt: row.created_at,
                paidAt: row.paid_at
            }));
            
            res.json(failedActivations);
        } catch (error) {
            this.logger.error('Erro ao buscar ativações falhadas:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getCompletedActivations(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 100;
            
            // Buscar pedidos com status 'completed'
            const rows = await this.db.all(`
                SELECT * FROM orders 
                WHERE status = 'completed'
                ORDER BY completed_at DESC 
                LIMIT ?
            `, [limit]);
            
            const completedActivations = rows.map(row => ({
                id: row.id,
                chatId: row.chat_id,
                productId: row.product_id,
                product: JSON.parse(row.product_data),
                selectedProductForActivation: row.selected_product_for_activation ? 
                    JSON.parse(row.selected_product_for_activation) : null,
                activationData: row.activation_data,
                result: row.result,
                activatedProduct: row.selected_product_for_activation ? 
                    JSON.parse(row.selected_product_for_activation).name : 
                    JSON.parse(row.product_data).name,
                completedAt: row.completed_at,
                paidAt: row.paid_at,
                createdAt: row.created_at
            }));
            
            res.json(completedActivations);
        } catch (error) {
            this.logger.error('Erro ao buscar ativações concluídas:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getActivationModules(req, res) {
        try {
            if (!this.activationService) {
                return res.status(503).json({
                    success: false,
                    error: 'Activation Service não disponível'
                });
            }
            
            const modules = this.activationService.getAvailableModules();
            res.json(modules);
        } catch (error) {
            this.logger.error('Erro ao buscar módulos:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async testModule(req, res) {
        try {
            const { id } = req.params;
            const { testData } = req.body;
            
            if (!this.activationService) {
                return res.status(503).json({
                    success: false,
                    error: 'Activation Service não disponível'
                });
            }
            
            const result = await this.activationService.testModule(id, testData);
            res.json(result);
        } catch (error) {
            this.logger.error('Erro ao testar módulo:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async reloadModules(req, res) {
        try {
            if (!this.activationService) {
                return res.status(503).json({
                    success: false,
                    error: 'Activation Service não disponível'
                });
            }
            
            const result = await this.activationService.reloadModules();
            res.json(result);
        } catch (error) {
            this.logger.error('Erro ao recarregar módulos:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // === PAGAMENTOS ===

    async verifyPayment(req, res) {
        try {
            const { orderId } = req.params;
            
            const order = await this.db.getOrder(orderId);
            if (!order) {
                return res.status(404).json({
                    success: false,
                    error: 'Pedido não encontrado'
                });
            }
            
            if (!order.paymentId) {
                return res.status(400).json({
                    success: false,
                    error: 'Pedido não possui payment_id'
                });
            }
            
            // Verificar status no Mercado Pago
            const cleanPaymentId = order.paymentId.replace(/[^0-9]/g, '').split('?')[0];
            const paymentStatus = await this.mercadoPago.getPaymentStatus(cleanPaymentId);
            
            res.json({
                success: true,
                order: {
                    id: order.id,
                    status: order.status,
                    product: order.product.name
                },
                paymentStatus: paymentStatus
            });
            
        } catch (error) {
            this.logger.error('Erro ao verificar pagamento via API:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async testMercadoPago(req, res) {
        try {
            const testResult = await this.mercadoPago.testConnection();
            res.json(testResult);
        } catch (error) {
            this.logger.error('Erro ao testar Mercado Pago:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // === USUÁRIOS ===

    async getUsers(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const status = req.query.status || 'all';
            const offset = (page - 1) * limit;
            
            this.logger.info(`📋 Buscando usuários - Página: ${page}, Limite: ${limit}, Status: ${status}`);
            
            // Query base
            let baseQuery = `
                SELECT us.*, 
                       COUNT(DISTINCT o.id) as total_orders,
                       SUM(CASE WHEN o.status IN ('paid', 'completed') THEN JSON_EXTRACT(o.product_data, '$.price') ELSE 0 END) as total_spent
                FROM user_sessions us
                LEFT JOIN orders o ON us.chat_id = o.chat_id
            `;
            
            let whereClause = '';
            let params = [];
            
            // Aplicar filtros
            if (status !== 'all') {
                switch (status) {
                    case 'with_credit':
                        whereClause = 'WHERE us.available_credit > 0';
                        break;
                    case 'active':
                        const last30days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
                        whereClause = 'WHERE us.updated_at > ?';
                        params.push(last30days);
                        break;
                    case 'pending_payment':
                        whereClause = 'WHERE EXISTS (SELECT 1 FROM orders o2 WHERE o2.chat_id = us.chat_id AND o2.status = "pending_payment")';
                        break;
                    case 'inactive':
                        const last60days = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
                        whereClause = 'WHERE us.updated_at <= ?';
                        params.push(last60days);
                        break;
                }
            }
            
            // Contar total
            const countQuery = `
                SELECT COUNT(DISTINCT us.chat_id) as total
                FROM user_sessions us
                LEFT JOIN orders o ON us.chat_id = o.chat_id
                ${whereClause}
            `;
            
            const totalResult = await this.db.get(countQuery, params);
            const total = totalResult.total;
            
            // Buscar usuários com paginação
            const usersQuery = `
                ${baseQuery}
                ${whereClause}
                GROUP BY us.chat_id
                ORDER BY us.updated_at DESC
                LIMIT ? OFFSET ?
            `;
            
            const users = await this.db.all(usersQuery, [...params, limit, offset]);
            
            // Processar dados dos usuários
            const processedUsers = users.map(user => {
                // Determinar status do usuário
                let userStatus = 'inactive';
                const now = new Date();
                const lastActivity = new Date(user.updated_at);
                const daysSinceActivity = (now - lastActivity) / (1000 * 60 * 60 * 24);
                
                if (user.available_credit > 0) {
                    userStatus = 'with_credit';
                } else if (daysSinceActivity <= 30) {
                    userStatus = 'active';
                } else if (user.total_orders > 0) {
                    // Verificar se tem pedidos pendentes
                    userStatus = 'pending_payment'; // Será verificado depois se necessário
                }
                
                // Calcular score baseado em atividade
                let score = 0;
                score += Math.min(user.total_orders * 10, 50); // Máximo 50 pontos por pedidos
                score += Math.min((user.total_spent || 0), 100); // Máximo 100 pontos por gasto
                score += user.available_credit > 0 ? 20 : 0; // 20 pontos se tem crédito
                score += daysSinceActivity <= 7 ? 30 : daysSinceActivity <= 30 ? 15 : 0; // Pontos por atividade recente

                // ✅ CORREÇÃO: Criar objeto stats completo para evitar erros no frontend
                const stats = {
                    totalOrders: user.total_orders || 0,
                    completedOrders: 0, // Será calculado depois se necessário
                    failedOrders: 0,
                    pendingOrders: 0,
                    totalSpent: user.total_spent || 0,
                    creditOrders: 0,
                    averageProcessingTime: null
                };
                
                return {
                    chatId: user.chat_id,
                    chatIdDisplay: user.chat_id.substring(0, 15) + '...',
                    state: user.state,
                    availableCredit: user.available_credit || 0,
                    totalOrders: user.total_orders || 0,
                    totalSpent: user.total_spent || 0,
                    lastActivity: user.updated_at,
                    daysSinceActivity: Math.floor(daysSinceActivity),
                    status: userStatus,
                    score: Math.round(score),
                    createdAt: user.created_at,
                    stats: stats // ✅ ADICIONADO: objeto stats completo
                };
            });
            
            // Filtrar por status se necessário (para casos mais complexos)
            const filteredUsers = status === 'all' ? 
                processedUsers : 
                processedUsers.filter(user => user.status === status);
            
            res.json({
                users: filteredUsers,
                pagination: {
                    page: page,
                    limit: limit,
                    total: total,
                    totalPages: Math.ceil(total / limit)
                },
                summary: {
                    totalUsers: total,
                    withCredit: processedUsers.filter(u => u.status === 'with_credit').length,
                    active: processedUsers.filter(u => u.status === 'active').length,
                    pendingPayment: processedUsers.filter(u => u.status === 'pending_payment').length,
                    inactive: processedUsers.filter(u => u.status === 'inactive').length
                }
            });
            
        } catch (error) {
            this.logger.error('Erro ao buscar usuários:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Histórico detalhado do usuário
    async getUserHistory(req, res) {
        try {
            const { chatId } = req.params;
            
            this.logger.info(`📋 Buscando histórico completo para usuário: ${chatId}`);
            
            // Buscar dados da sessão
            const session = await this.db.getUserSession(chatId);
            
            // Buscar todos os pedidos do usuário
            const orders = await this.db.all(`
                SELECT * FROM orders 
                WHERE chat_id = ? 
                ORDER BY created_at DESC
            `, [chatId]);
            
            // Processar pedidos com informações detalhadas
            const processedOrders = orders.map(order => ({
                id: order.id,
                productId: order.product_id,
                product: JSON.parse(order.product_data),
                selectedProductForActivation: order.selected_product_for_activation ?
                    JSON.parse(order.selected_product_for_activation) : null,
                pixCode: order.pix_code,
                paymentId: order.payment_id,
                status: order.status,
                activationData: order.activation_data,
                result: order.result,
                error: order.error,
                manualApproval: Boolean(order.manual_approval),
                creditAmount: order.credit_amount || 0,
                creditUsed: Boolean(order.credit_used),
                createdAt: order.created_at,
                paidAt: order.paid_at,
                completedAt: order.completed_at,
                processingTime: this.calculateProcessingTime(order.created_at, order.completed_at)
            }));
            
            // Calcular estatísticas detalhadas
            const stats = {
                totalOrders: orders.length,
                completedOrders: orders.filter(o => o.status === 'completed').length,
                failedOrders: orders.filter(o => o.status === 'failed').length,
                pendingOrders: orders.filter(o => o.status === 'pending_payment').length,
                totalSpent: orders
                    .filter(o => ['paid', 'completed'].includes(o.status))
                    .reduce((sum, o) => sum + JSON.parse(o.product_data).price, 0),
                creditOrders: orders.filter(o => o.credit_used).length,
                avgOrderValue: 0,
                successRate: 0,
                averageProcessingTime: null
            };
            
            if (stats.totalOrders > 0) {
                stats.avgOrderValue = stats.totalSpent / Math.max(stats.completedOrders, 1);
                stats.successRate = (stats.completedOrders / stats.totalOrders) * 100;
            }

            // Calcular tempo médio de processamento
            const completedOrdersWithTime = processedOrders.filter(o => o.processingTime);
            if (completedOrdersWithTime.length > 0) {
                const avgTime = completedOrdersWithTime.reduce((sum, o) => sum + o.processingTime, 0) / completedOrdersWithTime.length;
                stats.averageProcessingTime = `${Math.round(avgTime / 60)} min`;
            }

            // Gerar insights
            const insights = this.generateUserInsights(session, orders, stats);
            
            res.json({
                chatId: chatId,
                session: session,
                orders: processedOrders,
                stats: stats,
                insights: insights
            });
            
        } catch (error) {
            this.logger.error('Erro ao buscar histórico do usuário:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // ✅ NOVO: Método auxiliar para calcular tempo de processamento
    calculateProcessingTime(createdAt, completedAt) {
        if (!createdAt || !completedAt) return null;
        
        try {
            const created = new Date(createdAt);
            const completed = new Date(completedAt);
            return Math.floor((completed - created) / 1000); // segundos
        } catch (error) {
            return null;
        }
    }

    // ✅ NOVO: Gerar insights do usuário
    generateUserInsights(session, orders, stats) {
        const insights = [];
        
        // Insights baseados em crédito
        if (session.availableCredit > 0) {
            insights.push({
                type: 'credit',
                level: 'info',
                message: `Usuário possui R$ ${session.availableCredit.toFixed(2)} em crédito ativo`
            });
        }
        
        // Insights de comportamento
        if (stats.completedOrders === 0 && stats.totalOrders > 0) {
            insights.push({
                type: 'behavior',
                level: 'warning',
                message: `Usuário tem ${stats.totalOrders} pedido(s) mas nenhuma ativação concluída`
            });
        }
        
        if (stats.totalOrders > 5) {
            insights.push({
                type: 'behavior',
                level: 'success',
                message: 'Cliente frequente - alto valor'
            });
        }
        
        if (stats.totalSpent > 100) {
            insights.push({
                type: 'revenue',
                level: 'success',
                message: `Cliente premium - gastou R$ ${stats.totalSpent.toFixed(2)}`
            });
        }

        // Insights de tempo
        if (stats.averageProcessingTime) {
            insights.push({
                type: 'performance',
                level: 'info',
                message: `Tempo médio de processamento: ${stats.averageProcessingTime}`
            });
        }
        
        return insights;
    }

    // Resetar sessão do usuário
    async resetUserSession(req, res) {
        try {
            const { chatId } = req.params;
            
            this.logger.info(`🔄 Resetando sessão do usuário: ${chatId}`);
            
            // Limpar sessão mantendo crédito
            const currentSession = await this.db.getUserSession(chatId);
            const newSession = {
                state: null,
                currentOrderId: null,
                creditOrderId: currentSession.creditOrderId,
                availableCredit: currentSession.availableCredit,
                data: {}
            };
            
            await this.db.saveUserSession(chatId, newSession);
            
            res.json({
                success: true,
                message: 'Sessão resetada com sucesso',
                session: newSession
            });
            
        } catch (error) {
            this.logger.error('Erro ao resetar sessão:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Ajustar crédito do usuário
    async adjustUserCredit(req, res) {
        try {
            const { chatId } = req.params;
            const { amount, operation, reason = 'Ajuste manual do admin' } = req.body;
            
            if (!['add', 'subtract', 'set'].includes(operation)) {
                return res.status(400).json({
                    success: false,
                    error: 'Operação inválida. Use: add, subtract ou set'
                });
            }
            
            const creditAmount = parseFloat(amount);
            if (isNaN(creditAmount) || creditAmount < 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Valor inválido'
                });
            }
            
            this.logger.info(`💳 Ajustando crédito para ${chatId}: ${operation} ${creditAmount}`);
            
            const session = await this.db.getUserSession(chatId);
            let newCredit = session.availableCredit || 0;
            
            switch (operation) {
                case 'add':
                    newCredit += creditAmount;
                    break;
                case 'subtract':
                    newCredit = Math.max(0, newCredit - creditAmount);
                    break;
                case 'set':
                    newCredit = creditAmount;
                    break;
            }
            
            session.availableCredit = newCredit;
            await this.db.saveUserSession(chatId, session);
            
            // Log da operação
            this.logger.info(`💳 Crédito ajustado: ${session.availableCredit} → ${newCredit} (${reason})`);
            
            res.json({
                success: true,
                message: 'Crédito ajustado com sucesso',
                previousCredit: session.availableCredit,
                newCredit: newCredit,
                operation: operation,
                amount: creditAmount,
                reason: reason
            });
            
        } catch (error) {
            this.logger.error('Erro ao ajustar crédito:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Enviar mensagem para usuário específico
    async sendMessageToUser(req, res) {
        try {
            const { chatId } = req.params;
            const { message, type = 'admin_message' } = req.body;
            
            this.logger.info(`📱 Enviando mensagem admin para ${chatId}`);
            
            // Buscar WhatsApp Handler através das dependências
            if (!this.whatsappHandler) {
                // Se não tem referência direta, tentar através do OrderService
                const whatsappHandler = this.orderService?.whatsappHandler;
                
                if (!whatsappHandler) {
                    return res.status(500).json({ 
                        success: false, 
                        error: 'WhatsApp Handler não disponível' 
                    });
                }
                
                this.whatsappHandler = whatsappHandler;
            }
            
            // Preparar mensagem com cabeçalho admin
            const adminMessage = `🔧 *MENSAGEM DO ADMIN*\n\n${message}\n\n━━━━━━━━━━━━━━━━━━━\n💡 Esta é uma mensagem oficial do suporte.`;
            
            // Enviar mensagem
            const result = await this.whatsappHandler.sendMessage(chatId, adminMessage);
            
            if (result.success) {
                res.json({
                    success: true,
                    message: 'Mensagem enviada com sucesso',
                    sentAt: new Date().toISOString()
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Falha ao enviar mensagem: ' + result.error
                });
            }
            
        } catch (error) {
            this.logger.error('Erro ao enviar mensagem:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Estatísticas gerais dos usuários
    async getUsersStats(req, res) {
        try {
            this.logger.info('📊 Gerando estatísticas de usuários');
            
            // Stats básicas
            const totalUsers = await this.db.get('SELECT COUNT(*) as count FROM user_sessions');
            const usersWithCredit = await this.db.get('SELECT COUNT(*) as count FROM user_sessions WHERE available_credit > 0');
            const totalCredit = await this.db.get('SELECT SUM(available_credit) as total FROM user_sessions WHERE available_credit > 0');
            
            // Atividade por período
            const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const last7days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const last30days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            
            const activeUsers24h = await this.db.get('SELECT COUNT(*) as count FROM user_sessions WHERE updated_at > ?', [last24h]);
            const activeUsers7d = await this.db.get('SELECT COUNT(*) as count FROM user_sessions WHERE updated_at > ?', [last7days]);
            const activeUsers30d = await this.db.get('SELECT COUNT(*) as count FROM user_sessions WHERE updated_at > ?', [last30days]);
            
            // Top spenders
            const topSpenders = await this.db.all(`
                SELECT us.chat_id, 
                       SUM(CASE WHEN o.status IN ('paid', 'completed') THEN JSON_EXTRACT(o.product_data, '$.price') ELSE 0 END) as total_spent,
                       COUNT(o.id) as total_orders
                FROM user_sessions us
                LEFT JOIN orders o ON us.chat_id = o.chat_id
                GROUP BY us.chat_id
                HAVING total_spent > 0
                ORDER BY total_spent DESC
                LIMIT 10
            `);
            
            // Estados mais comuns
            const commonStates = await this.db.all(`
                SELECT state, COUNT(*) as count
                FROM user_sessions 
                WHERE state IS NOT NULL
                GROUP BY state
                ORDER BY count DESC
                LIMIT 10
            `);
            
            // Distribuição de créditos
            const creditDistribution = await this.db.all(`
                SELECT 
                    CASE 
                        WHEN available_credit = 0 THEN 'Sem crédito'
                        WHEN available_credit <= 10 THEN 'R$ 1-10'
                        WHEN available_credit <= 50 THEN 'R$ 11-50'
                        WHEN available_credit <= 100 THEN 'R$ 51-100'
                        ELSE 'R$ 100+'
                    END as credit_range,
                    COUNT(*) as count
                FROM user_sessions
                GROUP BY credit_range
                ORDER BY 
                    CASE credit_range
                        WHEN 'Sem crédito' THEN 1
                        WHEN 'R$ 1-10' THEN 2
                        WHEN 'R$ 11-50' THEN 3
                        WHEN 'R$ 51-100' THEN 4
                        WHEN 'R$ 100+' THEN 5
                    END
            `);
            
            res.json({
                totalUsers: totalUsers.count,
                usersWithCredit: usersWithCredit.count,
                totalCredit: totalCredit.total || 0,
                averageCredit: usersWithCredit.count > 0 ? 
                    (totalCredit.total / usersWithCredit.count).toFixed(2) : 0,
                activity: {
                    last24h: activeUsers24h.count,
                    last7days: activeUsers7d.count,
                    last30days: activeUsers30d.count,
                    retentionRate: totalUsers.count > 0 ? 
                        ((activeUsers30d.count / totalUsers.count) * 100).toFixed(2) : 0
                },
                topSpenders: topSpenders,
                commonStates: commonStates,
                creditDistribution: creditDistribution
            });
            
        } catch (error) {
            this.logger.error('Erro ao gerar estatísticas de usuários:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Bloquear/Desbloquear usuário
    async blockUser(req, res) {
        try {
            const { chatId } = req.params;
            const { blocked = true, reason = 'Bloqueado pelo admin' } = req.body;
            
            this.logger.info(`🚫 ${blocked ? 'Bloqueando' : 'Desbloqueando'} usuário: ${chatId}`);
            
            const session = await this.db.getUserSession(chatId);
            
            if (!session.data) {
                session.data = {};
            }
            
            session.data.blocked = blocked;
            session.data.blockReason = reason;
            session.data.blockedAt = blocked ? new Date().toISOString() : null;
            
            await this.db.saveUserSession(chatId, session);
            
            res.json({
                success: true,
                message: blocked ? 'Usuário bloqueado com sucesso' : 'Usuário desbloqueado com sucesso',
                blocked: blocked,
                reason: reason
            });
            
        } catch (error) {
            this.logger.error('Erro ao bloquear/desbloquear usuário:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // === SISTEMA DE BROADCAST COM PAUSA CONFIGURÁVEL ===

    // Método para envio de broadcast com pausa configurável
    async sendBroadcastMessage(req, res) {
        try {
            const { message, pauseBetweenMessages } = req.body;
            
            if (!message || !message.trim()) {
                return res.status(400).json({
                    success: false,
                    error: 'Mensagem é obrigatória'
                });
            }

            if (message.length > 2000) {
                return res.status(400).json({
                    success: false,
                    error: 'Mensagem muito longa (máximo 2000 caracteres)'
                });
            }

            // Configurar pausa entre mensagens (padrão: 3 segundos = 20 msg/min)
            const pauseMs = pauseBetweenMessages ? 
                Math.max(1000, Math.min(10000, pauseBetweenMessages * 1000)) : // Min 1s, Max 10s
                3000; // Padrão 3 segundos para 20 mensagens por minuto

            this.logger.info('🔥 INICIANDO BROADCAST para todos os usuários');
            this.logger.info(`📝 Mensagem: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`);
            this.logger.info(`⏱️ Pausa entre mensagens: ${pauseMs}ms (${Math.round(60000 / pauseMs)} mensagens por minuto)`);

            // Buscar todos os usuários que já interagiram com o bot
            const users = await this.db.all(`
                SELECT DISTINCT chat_id, 
                       updated_at,
                       available_credit
                FROM user_sessions 
                ORDER BY updated_at DESC
            `);

            this.logger.info(`👥 Total de usuários encontrados: ${users.length}`);
            this.logger.info(`⏰ Tempo estimado: ${Math.ceil((users.length * pauseMs) / 1000 / 60)} minutos`);

            if (users.length === 0) {
                return res.json({
                    success: true,
                    message: 'Nenhum usuário encontrado para envio',
                    stats: {
                        totalUsers: 0,
                        messagesSent: 0,
                        errors: 0,
                        successRate: 0,
                        pauseUsed: pauseMs,
                        estimatedTime: 0,
                        totalTimeSeconds: 0,
                        messagesPerSecond: 0
                    }
                });
            }

            // Buscar WhatsApp Handler
            const whatsappHandler = this.whatsappHandler || this.orderService?.whatsappHandler;
            
            if (!whatsappHandler) {
                return res.status(500).json({
                    success: false,
                    error: 'WhatsApp Handler não disponível'
                });
            }

            // Preparar mensagem com cabeçalho de broadcast
            const broadcastMessage = `📢 *MENSAGEM GERAL*\n\n${message}\n\n━━━━━━━━━━━━━━━━━━━\n💡 Esta é uma mensagem oficial do sistema.`;

            // Variáveis para estatísticas
            let messagesSent = 0;
            let errors = 0;
            const errorDetails = [];
            const startTime = Date.now();

            // Enviar mensagem para cada usuário COM PAUSA CONTROLADA
            for (let i = 0; i < users.length; i++) {
                const user = users[i];
                
                try {
                    this.logger.info(`📱 [${i + 1}/${users.length}] Enviando para ${user.chat_id.substring(0, 15)}...`);
                    
                    const result = await whatsappHandler.sendMessage(user.chat_id, broadcastMessage);
                    
                    if (result && result.success !== false) {
                        messagesSent++;
                        this.logger.info(`✅ [${i + 1}/${users.length}] Enviado para ${user.chat_id.substring(0, 15)}...`);
                    } else {
                        throw new Error(result?.error || 'Falha no envio');
                    }
                    
                } catch (error) {
                    errors++;
                    this.logger.error(`❌ [${i + 1}/${users.length}] Erro ao enviar para ${user.chat_id.substring(0, 15)}...:`, error.message);
                    errorDetails.push({
                        chatId: user.chat_id.substring(0, 15) + '...',
                        error: error.message,
                        position: i + 1
                    });
                }

                // PAUSA ENTRE MENSAGENS (exceto na última)
                if (i < users.length - 1) {
                    this.logger.info(`⏸️ Aguardando ${pauseMs}ms antes da próxima mensagem... (${Math.round(60000 / pauseMs)} msg/min)`);
                    await new Promise(resolve => setTimeout(resolve, pauseMs));
                }

                // Log de progresso a cada 10 mensagens
                if ((i + 1) % 10 === 0) {
                    const elapsed = (Date.now() - startTime) / 1000;
                    const remaining = users.length - (i + 1);
                    const estimatedRemaining = (remaining * pauseMs) / 1000;
                    
                    this.logger.info(`📊 Progresso: ${i + 1}/${users.length} (${((i + 1) / users.length * 100).toFixed(1)}%)`);
                    this.logger.info(`⏱️ Tempo decorrido: ${elapsed.toFixed(1)}s | Estimado restante: ${estimatedRemaining.toFixed(1)}s`);
                    this.logger.info(`🚀 Taxa atual: ${((i + 1) / elapsed * 60).toFixed(1)} mensagens por minuto`);
                }
            }

            const totalTime = (Date.now() - startTime) / 1000;

            // Calcular taxa de sucesso
            const successRate = users.length > 0 ? ((messagesSent / users.length) * 100).toFixed(1) : 0;

            this.logger.info('🎉 BROADCAST CONCLUÍDO!');
            this.logger.info(`📊 Estatísticas: ${messagesSent}/${users.length} enviadas (${successRate}% sucesso)`);
            this.logger.info(`⏰ Tempo total: ${totalTime.toFixed(1)} segundos (${(totalTime / 60).toFixed(1)} minutos)`);
            this.logger.info(`⚡ Taxa final: ${(messagesSent / totalTime * 60).toFixed(2)} mensagens por minuto`);

            // Salvar log do broadcast
            await this.saveBroadcastLog({
                message: message,
                totalUsers: users.length,
                messagesSent: messagesSent,
                errors: errors,
                successRate: parseFloat(successRate),
                pauseBetweenMessages: pauseMs,
                totalTimeSeconds: totalTime,
                messagesPerMinute: parseFloat((messagesSent / totalTime * 60).toFixed(2)),
                messagesPerSecond: parseFloat((messagesSent / totalTime).toFixed(2)),
                timestamp: new Date().toISOString(),
                errorDetails: errorDetails
            });

            res.json({
                success: true,
                message: 'Broadcast enviado com sucesso',
                stats: {
                    totalUsers: users.length,
                    messagesSent: messagesSent,
                    errors: errors,
                    successRate: parseFloat(successRate),
                    pauseUsed: pauseMs,
                    totalTimeSeconds: totalTime,
                    messagesPerMinute: parseFloat((messagesSent / totalTime * 60).toFixed(2)),
                    messagesPerSecond: parseFloat((messagesSent / totalTime).toFixed(2))
                },
                errorDetails: errorDetails.length > 0 ? errorDetails : undefined
            });

        } catch (error) {
            this.logger.error('❌ Erro no broadcast:', error);
            res.status(500).json({
                success: false,
                error: `Erro interno: ${error.message}`
            });
        }
    }

    // Método auxiliar para salvar log do broadcast
    async saveBroadcastLog(logData) {
        try {
            // Salvar como configuração especial no banco
            await this.db.run(`
                INSERT OR REPLACE INTO settings (key, value, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
            `, [
                `broadcast_log_${Date.now()}`,
                JSON.stringify(logData)
            ]);
            
            this.logger.info('📝 Log do broadcast salvo no banco de dados');
        } catch (error) {
            this.logger.error('❌ Erro ao salvar log do broadcast:', error);
        }
    }

    // Método para buscar histórico de broadcasts (opcional)
    async getBroadcastHistory(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 10;
            
            const logs = await this.db.all(`
                SELECT * FROM settings 
                WHERE key LIKE 'broadcast_log_%' 
                ORDER BY updated_at DESC 
                LIMIT ?
            `, [limit]);
            
            const broadcasts = logs.map(log => {
                try {
                    return {
                        id: log.key.replace('broadcast_log_', ''),
                        timestamp: log.updated_at,
                        ...JSON.parse(log.value)
                    };
                } catch (error) {
                    return null;
                }
            }).filter(Boolean);
            
            res.json({
                success: true,
                broadcasts: broadcasts
            });
            
        } catch (error) {
            this.logger.error('Erro ao buscar histórico de broadcast:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // === PAINEL ADMIN ===

    serveAdminPanel(req, res) {
        try {
            res.sendFile(path.join(__dirname, 'admin', 'index.html'));
        } catch (error) {
            this.logger.error('Erro ao servir painel admin:', error);
            res.status(500).send('Erro ao carregar painel administrativo');
        }
    }

    // === OBTER ROUTER ===

    getRouter() {
        return this.router;
    }
}

module.exports = AdminRoutes;
