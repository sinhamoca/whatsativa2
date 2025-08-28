// core-system-new.js - Sistema Principal Modularizado
const express = require('express');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

// Importar serviços modulares
const DatabaseService = require('./database-service');
const MercadoPagoService = require('./mercadopago-service');
const PaymentMonitor = require('./payment-monitor');
const ActivationManager = require('./activation-manager');

// Importar novos módulos
const WhatsAppHandler = require('./whatsapp-handler');
const OrderService = require('./order-service');
const ActivationService = require('./activation-service');
const AdminRoutes = require('./admin-routes');

class CoreSystem {
    constructor() {
        this.app = express();
        this.logger = pino({ level: 'info' });
        this.port = process.env.PORT || 3001;

        // Configurações
        this.config = {
            whatsappBotUrl: process.env.WHATSAPP_BOT_URL || 'http://localhost:3000',
            webhookUrl: process.env.WEBHOOK_URL || 'http://localhost:3001'
        };

        // Serviços principais
        this.db = null;
        this.mercadoPago = null;
        this.paymentMonitor = null;
        this.activationManager = null;

        // Novos módulos
        this.whatsappHandler = null;
        this.orderService = null;
        this.activationService = null;
        this.adminRoutes = null;
    }

    async initialize() {
        try {
            this.logger.info('🚀 Inicializando Core System Modularizado...');
            
            // 1. Inicializar serviços base
            await this.initializeBaseServices();
            
            // 2. Inicializar módulos
            await this.initializeModules();
            
            // 3. Configurar middleware e rotas
            this.setupMiddleware();
            this.setupRoutes();
            
            // 4. Carregar dados padrão
            await this.initializeDefaultData();
            
            // 5. Inicializar Payment Monitor
            await this.startPaymentMonitor();
            
            this.logger.info('✅ Core System inicializado com sucesso');
            
        } catch (error) {
            this.logger.error('❌ Erro ao inicializar Core System:', error);
            throw error;
        }
    }

    // Inicializar serviços base (banco, MP, etc.)
    async initializeBaseServices() {
        try {
            this.logger.info('🔧 Inicializando serviços base...');
            
            // Database Service
            this.db = new DatabaseService('./database.sqlite');
            await this.db.initialize();
            
            // Mercado Pago Service
            this.mercadoPago = new MercadoPagoService();
            await this.updateMercadoPagoConfig();
            
            // Activation Manager
            this.activationManager = new ActivationManager();
            await this.activationManager.initialize();
            
            // Payment Monitor
            this.paymentMonitor = new PaymentMonitor({
                checkInterval: 10000,
                whatsappBotUrl: this.config.whatsappBotUrl,
                coreSystemUrl: this.config.webhookUrl
            });
            
            this.logger.info('✅ Serviços base inicializados');
            
        } catch (error) {
            this.logger.error('❌ Erro ao inicializar serviços base:', error);
            throw error;
        }
    }

    // Inicializar módulos modulares
    async initializeModules() {
        try {
            this.logger.info('📦 Inicializando módulos...');
            
            // WhatsApp Handler
            this.whatsappHandler = new WhatsAppHandler({
                whatsappBotUrl: this.config.whatsappBotUrl
            });
            
            // Order Service
            this.orderService = new OrderService({
                whatsappBotUrl: this.config.whatsappBotUrl,
                coreSystemUrl: this.config.webhookUrl
            });
            
            // Activation Service
            this.activationService = new ActivationService();
            
            // Admin Routes
            this.adminRoutes = new AdminRoutes();
            
            // Injetar dependências entre módulos
            this.injectDependencies();
            
            // Carregar caches
            await this.whatsappHandler.loadCache();
            await this.orderService.loadProductsCache();
            
            this.logger.info('✅ Módulos inicializados');
            
        } catch (error) {
            this.logger.error('❌ Erro ao inicializar módulos:', error);
            throw error;
        }
    }

    // Injetar dependências entre módulos
    injectDependencies() {
        // Dependências para WhatsApp Handler
        this.whatsappHandler.initialize({
            db: this.db,
            orderService: this.orderService,
            activationService: this.activationService
        });

        // Dependências para Order Service
        this.orderService.initialize({
            db: this.db,
            mercadoPago: this.mercadoPago,
            whatsappHandler: this.whatsappHandler
        });

        // Dependências para Activation Service
        this.activationService.initialize({
            db: this.db,
            activationManager: this.activationManager,
            whatsappHandler: this.whatsappHandler
        });

        // Dependências para Admin Routes
        this.adminRoutes.initialize({
            db: this.db,
            mercadoPago: this.mercadoPago,
            orderService: this.orderService,
            activationService: this.activationService,
            paymentMonitor: this.paymentMonitor
        });

        this.logger.info('🔗 Dependências injetadas entre módulos');
    }

    // Configurar middleware
    setupMiddleware() {
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(express.static(path.join(__dirname, 'admin')));
        
        // CORS
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            next();
        });

        // Log requests
        this.app.use((req, res, next) => {
            this.logger.info(`${req.method} ${req.path} - ${req.ip}`);
            next();
        });

        // Error handling
        this.app.use((err, req, res, next) => {
            this.logger.error('Erro na requisição:', err);
            res.status(500).json({ 
                success: false, 
                error: 'Erro interno do servidor' 
            });
        });
    }

    // Configurar rotas principais
    setupRoutes() {
        // Health check
        this.app.get('/health', this.healthCheck.bind(this));

        // Webhook do WhatsApp
        this.app.post('/webhook/whatsapp', this.handleWhatsAppWebhook.bind(this));

        // Webhook do Mercado Pago
        this.app.post('/webhook/mercadopago', this.handleMercadoPagoWebhook.bind(this));

        // Rotas administrativas (delegadas para AdminRoutes)
        this.app.use('/', this.adminRoutes.getRouter());

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                error: 'Rota não encontrada'
            });
        });

        this.logger.info('🛣️ Rotas principais configuradas');
    }

    // Health check
    async healthCheck(req, res) {
        try {
            const stats = await this.db.getStats();
            const products = await this.db.getProducts();
            const messages = await this.db.getMessages();
            
            res.json({
                success: true,
                status: 'running',
                database: this.db.isConnected,
                mercadoPago: this.mercadoPago.isConfigured(),
                paymentMonitor: this.paymentMonitor ? this.paymentMonitor.isRunning : false,
                modules: {
                    whatsappHandler: !!this.whatsappHandler,
                    orderService: !!this.orderService,
                    activationService: !!this.activationService,
                    adminRoutes: !!this.adminRoutes
                },
                stats: {
                    ...stats,
                    totalProducts: products.length,
                    totalMessages: Object.keys(messages).length
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            this.logger.error('Erro no health check:', error);
            res.status(500).json({
                success: false,
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Webhook do WhatsApp (delegado para WhatsAppHandler)
    async handleWhatsAppWebhook(req, res) {
        try {
            const { chatId, message } = req.body;
            
            this.logger.info(`📱 Mensagem recebida: ${chatId} - ${message}`);
            
            const response = await this.whatsappHandler.processMessage(chatId, message);
            
            res.json(response);
        } catch (error) {
            this.logger.error('Erro ao processar webhook WhatsApp:', error);
            res.status(500).json({
                reply: '❌ Erro interno. Tente novamente em alguns minutos.'
            });
        }
    }

    // Webhook do Mercado Pago
    async handleMercadoPagoWebhook(req, res) {
        try {
            this.logger.info('💳 Webhook MP recebido:', req.body);
            
            const { type, data } = req.body;
            
            if (type === 'payment') {
                const paymentId = data.id;
                
                // Buscar pedido com este paymentId
                const orders = await this.db.all(
                    'SELECT * FROM orders WHERE payment_id = ? AND status = "pending_payment"',
                    [paymentId]
                );
                
                if (orders.length > 0) {
                    const order = orders[0];
                    
                    // Verificar status do pagamento
                    const paymentStatus = await this.mercadoPago.getPaymentStatus(paymentId);
                    
                    if (['approved', 'authorized'].includes(paymentStatus.status)) {
                        // Delegar para OrderService
                        await this.orderService.processPaymentApproval(order.id, paymentStatus);
                    }
                }
            }
            
            res.status(200).send('OK');
        } catch (error) {
            this.logger.error('Erro no webhook MP:', error);
            res.status(500).send('Error');
        }
    }

    // Atualizar configuração do Mercado Pago
    async updateMercadoPagoConfig() {
        try {
            const settings = await this.db.getSettings();
            
            const mpConfig = {
                publicKey: settings.mercadoPagoPublicKey || '',
                accessToken: settings.mercadoPagoAccessToken || '',
                environment: settings.mercadoPagoEnvironment || 'sandbox',
                webhookUrl: settings.webhookUrl || this.config.webhookUrl
            };
            
            this.mercadoPago.updateConfig(mpConfig);
            this.logger.info('💳 Configuração Mercado Pago atualizada');
        } catch (error) {
            this.logger.error('Erro ao atualizar configuração MP:', error);
        }
    }

    // Inicializar dados padrão
    async initializeDefaultData() {
        try {
            // Verificar se já existem produtos
            const existingProducts = await this.db.getProducts();
            
            if (existingProducts.length === 0) {
                const defaultProducts = [
                    {
                        id: 'app_a',
                        name: 'Aplicativo A',
                        description: 'Ativação do Aplicativo A - Funcionalidades premium',
                        price: 1.00,
                        currency: 'BRL',
                        activationModule: 'module_app_a',
                        active: true
                    },
                    {
                        id: 'app_b',
                        name: 'Aplicativo B', 
                        description: 'Ativação do Aplicativo B - Versão completa',
                        price: 49.90,
                        currency: 'BRL',
                        activationModule: 'module_app_b',
                        active: true
                    },
                    {
                        id: 'ibo_pro',
                        name: 'IBO Pro',
                        description: 'Ativação do IBO Pro - Aplicativo premium',
                        price: 79.90,
                        currency: 'BRL',
                        activationModule: 'ibo_pro',
                        active: true
                    }
                ];

                for (const product of defaultProducts) {
                    await this.db.saveProduct(product);
                }

                this.logger.info('📱 Produtos padrão criados');
            }

            // Verificar se já existem mensagens
            const existingMessages = await this.db.getMessages();
            
            if (Object.keys(existingMessages).length === 0) {
                const defaultMessages = {
                    'welcome': '👋 Olá! Bem-vindo ao sistema de ativações!\n\nDigite *menu* para ver nossos produtos disponíveis.',
                    'menu': '🎯 *MENU DE ATIVAÇÕES*\n\n📱 Escolha o aplicativo que deseja ativar:\n\n{products_list}\n━━━━━━━━━━━━━━━━━━━\n👆 *Digite o número* ou nome do aplicativo\n📞 Para suporte: /suporte',
                    'payment_pending': '✅ *{product_name} selecionado!*\n\n💰 *Valor:* R$ {price}\n\n🔗 *PIX Copia e Cola:*\n`{pix_code}`\n\n━━━━━━━━━━━━━━━━━━━\n📋 *Instruções:*\n1. Copie o código PIX acima\n2. Faça o pagamento no seu banco\n3. ⚡ Sistema detectará automaticamente\n\n⏰ *Pedido:* {order_id}',
                    'payment_confirmed': '💳 *VOCÊ GANHOU CRÉDITO!*\n\n🎯 {product_name}\n💰 R$ {price}\n\n━━━━━━━━━━━━━━━━━━━\n🎉 *Parabéns! Seu pagamento foi confirmado.*\n\nVocê agora tem **R$ {price} em crédito** para ativar qualquer produto!\n\n💡 *Como funciona:*\n• Escolha qualquer produto disponível\n• Se a ativação falhar, pode tentar outro\n• Seu dinheiro está seguro até conseguir ativar\n\n📱 Aguarde que em instantes você verá o menu...',
                    'activation_success': '✅ *ATIVAÇÃO CONCLUÍDA!*\n\n🎯 {product_name}\n📋 Resultado: {result}\n\n🎉 Tudo pronto! Seu aplicativo foi ativado com sucesso.\n\nDigite *menu* para nova ativação.',
                    'activation_error': '❌ *ERRO NA ATIVAÇÃO*\n\n🎯 {product_name}\n⚠️ {error}\n\n💡 *Não se preocupe!* Seu crédito foi preservado.\nTente novamente ou escolha outro produto.',
                    'support': '🆘 *SUPORTE TÉCNICO*\n\n📧 Email: suporte@empresa.com\n📱 WhatsApp: +55 11 99999-9999\n⏰ Horário: 8h às 18h\n\n💳 *Tem crédito ativo?* Ele será preservado.\n\n🔄 Digite qualquer coisa para voltar ao menu.'
                };

                for (const [type, content] of Object.entries(defaultMessages)) {
                    await this.db.saveMessage(type, content);
                }

                this.logger.info('💬 Mensagens padrão criadas');
            }

        } catch (error) {
            this.logger.error('Erro ao inicializar dados padrão:', error);
        }
    }

    // Inicializar Payment Monitor
    async startPaymentMonitor() {
        try {
            await this.paymentMonitor.initialize();
            await this.paymentMonitor.start();
            this.logger.info('🤖 Payment Monitor iniciado');
        } catch (error) {
            this.logger.error('Erro ao iniciar Payment Monitor:', error);
        }
    }

    // Iniciar servidor
    async start() {
        try {
            // Inicializar sistema
            await this.initialize();
            
            // Criar diretório admin se não existir
            const adminDir = path.join(__dirname, 'admin');
            if (!fs.existsSync(adminDir)) {
                fs.mkdirSync(adminDir, { recursive: true });
            }

            this.app.listen(this.port, () => {
                this.logger.info(`🚀 Core System rodando na porta ${this.port}`);
                this.logger.info(`🌐 Admin Panel: http://localhost:${this.port}/admin`);
                this.logger.info(`💚 Health check: http://localhost:${this.port}/health`);
                this.logger.info(`📱 WhatsApp webhook: ${this.config.whatsappBotUrl}`);
                this.logger.info(`💳 Mercado Pago configurado: ${this.mercadoPago.isConfigured()}`);
                this.logger.info(`🤖 Payment Monitor: ${this.paymentMonitor.isRunning ? 'Ativo' : 'Inativo'}`);
                this.logger.info(`🗄️ Banco de dados: SQLite conectado`);
                this.logger.info(`📦 Módulos: WhatsApp ✅ Orders ✅ Activations ✅ Admin ✅`);
            });

            // Graceful shutdown
            process.on('SIGINT', async () => {
                this.logger.info('Recebido SIGINT. Fechando sistema...');
                await this.shutdown();
                process.exit(0);
            });

            process.on('SIGTERM', async () => {
                this.logger.info('Recebido SIGTERM. Fechando sistema...');
                await this.shutdown();
                process.exit(0);
            });

        } catch (error) {
            this.logger.error('Erro ao iniciar Core System:', error);
            process.exit(1);
        }
    }

    // Shutdown graceful
    async shutdown() {
        try {
            this.logger.info('🛑 Parando Payment Monitor...');
            if (this.paymentMonitor) {
                await this.paymentMonitor.stop();
            }
            
            this.logger.info('🗄️ Fechando banco de dados...');
            if (this.db) {
                await this.db.close();
            }
            
            this.logger.info('✅ Sistema fechado com sucesso');
        } catch (error) {
            this.logger.error('Erro durante shutdown:', error);
        }
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    const coreSystem = new CoreSystem();
    coreSystem.start();
}

module.exports = CoreSystem;
