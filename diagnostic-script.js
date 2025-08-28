// diagnostic-script.js - Script de Auto-Verificação do Sistema de Pagamentos
const DatabaseService = require('./database-service');
const MercadoPagoService = require('./mercadopago-service');
const PaymentMonitor = require('./payment-monitor');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class SystemDiagnostic {
    constructor() {
        this.results = {
            database: {},
            mercadoPago: {},
            paymentMonitor: {},
            coreSystem: {},
            webhook: {},
            summary: {
                passed: 0,
                failed: 0,
                warnings: 0,
                critical: 0
            }
        };
        
        this.coreSystemUrl = process.env.CORE_SYSTEM_URL || 'http://localhost:3001';
        this.whatsappBotUrl = process.env.WHATSAPP_BOT_URL || 'http://localhost:3000';
    }

    log(level, section, message, data = null) {
        const timestamp = new Date().toISOString();
        const emoji = {
            'SUCCESS': '✅',
            'ERROR': '❌',
            'WARNING': '⚠️',
            'INFO': 'ℹ️',
            'CRITICAL': '🚨'
        };
        
        console.log(`[${timestamp}] ${emoji[level]} ${section}: ${message}`);
        
        if (data) {
            console.log('   Data:', JSON.stringify(data, null, 2));
        }
        
        // Atualizar estatísticas
        if (level === 'SUCCESS') this.results.summary.passed++;
        else if (level === 'ERROR') this.results.summary.failed++;
        else if (level === 'WARNING') this.results.summary.warnings++;
        else if (level === 'CRITICAL') this.results.summary.critical++;
    }

    async run() {
        console.log('\n🔍 INICIANDO DIAGNÓSTICO COMPLETO DO SISTEMA DE PAGAMENTOS\n');
        console.log('=' * 80);
        
        try {
            // 1. Verificar estrutura de arquivos
            await this.checkFileStructure();
            
            // 2. Verificar banco de dados
            await this.checkDatabase();
            
            // 3. Verificar configurações do Mercado Pago
            await this.checkMercadoPagoConfig();
            
            // 4. Verificar Payment Monitor
            await this.checkPaymentMonitor();
            
            // 5. Verificar Core System
            await this.checkCoreSystem();
            
            // 6. Verificar webhooks
            await this.checkWebhooks();
            
            // 7. Testar fluxo completo
            await this.testCompleteFlow();
            
            // 8. Gerar relatório final
            this.generateReport();
            
        } catch (error) {
            this.log('CRITICAL', 'DIAGNOSTIC', 'Falha crítica no diagnóstico', error.message);
        }
    }

    async checkFileStructure() {
        this.log('INFO', 'FILES', 'Verificando estrutura de arquivos...');
        
        const requiredFiles = [
            'core-system/database-service.js',
            'core-system/mercadopago-service.js',
            'core-system/payment-monitor.js',
            'core-system/core-system.js',
            'core-system/whatsapp-handler.js',
            'core-system/order-service.js',
            'database.sqlite'
        ];
        
        for (const file of requiredFiles) {
            if (fs.existsSync(file)) {
                this.log('SUCCESS', 'FILES', `Arquivo encontrado: ${file}`);
            } else {
                this.log('ERROR', 'FILES', `Arquivo FALTANDO: ${file}`);
                this.results.database.missingFiles = this.results.database.missingFiles || [];
                this.results.database.missingFiles.push(file);
            }
        }
    }

    async checkDatabase() {
        this.log('INFO', 'DATABASE', 'Verificando banco de dados...');
        
        try {
            const db = new DatabaseService('./database.sqlite');
            await db.initialize();
            this.log('SUCCESS', 'DATABASE', 'Conexão com banco estabelecida');
            
            // Verificar tabelas
            const tables = ['orders', 'products', 'messages', 'settings', 'user_sessions'];
            for (const table of tables) {
                try {
                    const result = await db.all(`SELECT COUNT(*) as count FROM ${table}`);
                    this.log('SUCCESS', 'DATABASE', `Tabela ${table}: ${result[0].count} registros`);
                    this.results.database[`table_${table}`] = result[0].count;
                } catch (error) {
                    this.log('ERROR', 'DATABASE', `Erro na tabela ${table}`, error.message);
                    this.results.database.errors = this.results.database.errors || [];
                    this.results.database.errors.push(`${table}: ${error.message}`);
                }
            }
            
            // Verificar configurações críticas
            const settings = await db.getSettings();
            this.results.database.settings = settings;
            
            // Verificar pedidos pendentes
            const pendingOrders = await db.all(`
                SELECT COUNT(*) as count FROM orders 
                WHERE status = 'pending_payment' 
                AND payment_id IS NOT NULL 
                AND payment_id != ''
            `);
            
            this.results.database.pendingOrdersWithPaymentId = pendingOrders[0].count;
            this.log('INFO', 'DATABASE', `Pedidos pendentes com PaymentID: ${pendingOrders[0].count}`);
            
            await db.close();
            
        } catch (error) {
            this.log('CRITICAL', 'DATABASE', 'Falha ao conectar com banco', error.message);
            this.results.database.connectionError = error.message;
        }
    }

    async checkMercadoPagoConfig() {
        this.log('INFO', 'MERCADOPAGO', 'Verificando configuração do Mercado Pago...');
        
        try {
            const db = new DatabaseService('./database.sqlite');
            await db.initialize();
            const settings = await db.getSettings();
            await db.close();
            
            const requiredKeys = ['mercadoPagoPublicKey', 'mercadoPagoAccessToken', 'mercadoPagoEnvironment'];
            const mpConfig = {};
            
            for (const key of requiredKeys) {
                if (settings[key] && settings[key].trim() !== '') {
                    this.log('SUCCESS', 'MERCADOPAGO', `${key}: Configurado`);
                    mpConfig[key] = '***' + settings[key].slice(-4); // Mascarar para logs
                } else {
                    this.log('ERROR', 'MERCADOPAGO', `${key}: NÃO CONFIGURADO`);
                    mpConfig[key] = null;
                }
            }
            
            this.results.mercadoPago.config = mpConfig;
            
            // Testar inicialização do MP Service
            const mpService = new MercadoPagoService({
                publicKey: settings.mercadoPagoPublicKey || '',
                accessToken: settings.mercadoPagoAccessToken || '',
                environment: settings.mercadoPagoEnvironment || 'sandbox'
            });
            
            const isConfigured = mpService.isConfigured();
            this.results.mercadoPago.isConfigured = isConfigured;
            
            if (isConfigured) {
                this.log('SUCCESS', 'MERCADOPAGO', 'Serviço configurado corretamente');
                
                // Testar API (se access token estiver configurado)
                if (settings.mercadoPagoAccessToken) {
                    try {
                        // Fazer uma chamada de teste (buscar um payment inexistente)
                        await mpService.getPaymentStatus('999999999');
                    } catch (apiError) {
                        if (apiError.message.includes('not found') || apiError.message.includes('404')) {
                            this.log('SUCCESS', 'MERCADOPAGO', 'API respondendo corretamente');
                            this.results.mercadoPago.apiWorking = true;
                        } else if (apiError.message.includes('401') || apiError.message.includes('unauthorized')) {
                            this.log('ERROR', 'MERCADOPAGO', 'Token de acesso inválido');
                            this.results.mercadoPago.apiWorking = false;
                            this.results.mercadoPago.apiError = 'Token inválido';
                        } else {
                            this.log('WARNING', 'MERCADOPAGO', 'Erro inesperado na API', apiError.message);
                            this.results.mercadoPago.apiWorking = false;
                            this.results.mercadoPago.apiError = apiError.message;
                        }
                    }
                }
            } else {
                this.log('CRITICAL', 'MERCADOPAGO', 'Serviço NÃO CONFIGURADO - Motor automático não funcionará');
            }
            
        } catch (error) {
            this.log('CRITICAL', 'MERCADOPAGO', 'Erro ao verificar configuração', error.message);
            this.results.mercadoPago.error = error.message;
        }
    }

    async checkPaymentMonitor() {
        this.log('INFO', 'MONITOR', 'Verificando Payment Monitor...');
        
        try {
            // Simular inicialização do Payment Monitor
            const monitor = new PaymentMonitor({
                checkInterval: 30000,
                coreSystemUrl: this.coreSystemUrl
            });
            
            await monitor.initialize();
            this.log('SUCCESS', 'MONITOR', 'Inicialização bem-sucedida');
            this.results.paymentMonitor.initialized = true;
            this.results.paymentMonitor.mercadoPagoConfigured = monitor.mercadoPago.isConfigured();
            
            if (!monitor.mercadoPago.isConfigured()) {
                this.log('CRITICAL', 'MONITOR', 'Mercado Pago não configurado no monitor');
            }
            
            // Verificar configurações
            this.results.paymentMonitor.config = {
                checkInterval: monitor.config.checkInterval,
                coreSystemUrl: monitor.config.coreSystemUrl,
                whatsappBotUrl: monitor.config.whatsappBotUrl
            };
            
            this.log('INFO', 'MONITOR', `Intervalo de verificação: ${monitor.config.checkInterval}ms`);
            
            // Simular uma verificação
            await monitor.checkPendingPayments();
            this.log('SUCCESS', 'MONITOR', 'Verificação de teste executada');
            
        } catch (error) {
            this.log('CRITICAL', 'MONITOR', 'Falha na inicialização do monitor', error.message);
            this.results.paymentMonitor.error = error.message;
            this.results.paymentMonitor.initialized = false;
        }
    }

    async checkCoreSystem() {
        this.log('INFO', 'CORE', 'Verificando Core System...');
        
        try {
            // Testar health check
            const response = await axios.get(`${this.coreSystemUrl}/health`, {
                timeout: 10000
            });
            
            this.log('SUCCESS', 'CORE', 'Health check respondeu');
            this.results.coreSystem.healthCheck = response.data;
            
            if (response.data.paymentMonitor) {
                this.log('SUCCESS', 'CORE', 'Payment Monitor está rodando no Core System');
            } else {
                this.log('CRITICAL', 'CORE', 'Payment Monitor NÃO ESTÁ RODANDO no Core System');
            }
            
            if (response.data.mercadoPago) {
                this.log('SUCCESS', 'CORE', 'Mercado Pago configurado no Core System');
            } else {
                this.log('ERROR', 'CORE', 'Mercado Pago NÃO configurado no Core System');
            }
            
        } catch (error) {
            this.log('CRITICAL', 'CORE', 'Core System não está respondendo', error.message);
            this.results.coreSystem.error = error.message;
            this.results.coreSystem.running = false;
        }
    }

    async checkWebhooks() {
        this.log('INFO', 'WEBHOOK', 'Verificando webhooks...');
        
        try {
            // Testar webhook do WhatsApp
            const whatsappTest = {
                chatId: 'test_diagnostic',
                message: 'teste'
            };
            
            try {
                const whatsappResponse = await axios.post(
                    `${this.coreSystemUrl}/webhook/whatsapp`,
                    whatsappTest,
                    { timeout: 5000 }
                );
                this.log('SUCCESS', 'WEBHOOK', 'Webhook WhatsApp respondeu');
                this.results.webhook.whatsapp = true;
            } catch (error) {
                this.log('ERROR', 'WEBHOOK', 'Webhook WhatsApp falhou', error.message);
                this.results.webhook.whatsapp = false;
                this.results.webhook.whatsappError = error.message;
            }
            
            // Testar webhook do Mercado Pago
            const mpTest = {
                type: 'payment',
                data: { id: 'test_payment_id' }
            };
            
            try {
                const mpResponse = await axios.post(
                    `${this.coreSystemUrl}/webhook/mercadopago`,
                    mpTest,
                    { timeout: 5000 }
                );
                this.log('SUCCESS', 'WEBHOOK', 'Webhook Mercado Pago respondeu');
                this.results.webhook.mercadoPago = true;
            } catch (error) {
                this.log('ERROR', 'WEBHOOK', 'Webhook Mercado Pago falhou', error.message);
                this.results.webhook.mercadoPago = false;
                this.results.webhook.mercadoPagoError = error.message;
            }
            
        } catch (error) {
            this.log('ERROR', 'WEBHOOK', 'Erro geral nos webhooks', error.message);
        }
    }

    async testCompleteFlow() {
        this.log('INFO', 'FLOW', 'Testando fluxo completo...');
        
        try {
            const db = new DatabaseService('./database.sqlite');
            await db.initialize();
            
            // Criar um pedido de teste
            const testOrder = {
                id: 'diagnostic_test_' + Date.now(),
                chatId: 'diagnostic_user',
                productId: 'test_product',
                status: 'pending_payment',
                paymentId: '123456789',
                product: {
                    name: 'Produto Teste',
                    price: 1.00
                }
            };
            
            // Inserir pedido de teste
            await db.run(`
                INSERT INTO orders (id, chat_id, product_id, product_data, status, payment_id, pix_code, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                testOrder.id,
                testOrder.chatId,
                testOrder.productId,
                JSON.stringify(testOrder.product),
                testOrder.status,
                testOrder.paymentId,
                'test_pix_code'
            ]);
            
            this.log('SUCCESS', 'FLOW', 'Pedido de teste criado');
            
            // Simular verificação automática
            const monitor = new PaymentMonitor();
            await monitor.initialize();
            
            const testOrderFromDb = await db.get('SELECT * FROM orders WHERE id = ?', [testOrder.id]);
            
            if (testOrderFromDb) {
                this.log('SUCCESS', 'FLOW', 'Pedido encontrado no banco para verificação');
                
                // Tentar verificação (vai falhar por ser teste, mas testa o fluxo)
                await monitor.checkOrderPayment(testOrderFromDb);
                this.log('SUCCESS', 'FLOW', 'Fluxo de verificação executado');
            }
            
            // Limpar pedido de teste
            await db.run('DELETE FROM orders WHERE id = ?', [testOrder.id]);
            this.log('INFO', 'FLOW', 'Pedido de teste removido');
            
            await db.close();
            
        } catch (error) {
            this.log('ERROR', 'FLOW', 'Erro no teste de fluxo', error.message);
            this.results.flow = { error: error.message };
        }
    }

    generateReport() {
        console.log('\n' + '=' * 80);
        console.log('📊 RELATÓRIO FINAL DO DIAGNÓSTICO');
        console.log('=' * 80);
        
        // Estatísticas gerais
        console.log(`\n📈 ESTATÍSTICAS:`);
        console.log(`   ✅ Sucessos: ${this.results.summary.passed}`);
        console.log(`   ❌ Falhas: ${this.results.summary.failed}`);
        console.log(`   ⚠️  Avisos: ${this.results.summary.warnings}`);
        console.log(`   🚨 Críticos: ${this.results.summary.critical}`);
        
        // Problemas críticos
        console.log(`\n🚨 PROBLEMAS CRÍTICOS ENCONTRADOS:`);
        
        if (!this.results.mercadoPago.isConfigured) {
            console.log(`   - Mercado Pago NÃO CONFIGURADO (CAUSA PRINCIPAL)`);
        }
        
        if (!this.results.coreSystem.healthCheck?.paymentMonitor) {
            console.log(`   - Payment Monitor NÃO ESTÁ RODANDO`);
        }
        
        if (this.results.database.connectionError) {
            console.log(`   - Erro de conexão com banco: ${this.results.database.connectionError}`);
        }
        
        if (this.results.paymentMonitor.error) {
            console.log(`   - Erro na inicialização do monitor: ${this.results.paymentMonitor.error}`);
        }
        
        // Recomendações
        console.log(`\n💡 RECOMENDAÇÕES:`);
        
        if (!this.results.mercadoPago.isConfigured) {
            console.log(`   1. Configure as chaves do Mercado Pago no admin panel`);
            console.log(`      - Acesse: ${this.coreSystemUrl}/admin`);
            console.log(`      - Configure: Public Key, Access Token, Environment`);
        }
        
        if (!this.results.coreSystem.healthCheck?.paymentMonitor) {
            console.log(`   2. Reinicie o Core System para ativar o Payment Monitor`);
        }
        
        if (this.results.database.pendingOrdersWithPaymentId > 0) {
            console.log(`   3. Existem ${this.results.database.pendingOrdersWithPaymentId} pedidos pendentes para verificação`);
        }
        
        if (this.results.summary.critical > 0) {
            console.log(`\n🚨 STATUS: SISTEMA COM PROBLEMAS CRÍTICOS - MOTOR AUTOMÁTICO NÃO FUNCIONARÁ`);
        } else if (this.results.summary.failed > 0) {
            console.log(`\n⚠️  STATUS: SISTEMA COM PROBLEMAS - FUNCIONAMENTO PARCIAL`);
        } else {
            console.log(`\n✅ STATUS: SISTEMA FUNCIONANDO CORRETAMENTE`);
        }
        
        // Salvar relatório
        const reportFile = `diagnostic_report_${Date.now()}.json`;
        fs.writeFileSync(reportFile, JSON.stringify(this.results, null, 2));
        console.log(`\n📄 Relatório completo salvo em: ${reportFile}`);
        
        console.log('\n' + '=' * 80);
    }
}

// Executar diagnóstico se chamado diretamente
if (require.main === module) {
    const diagnostic = new SystemDiagnostic();
    diagnostic.run().catch(console.error);
}

module.exports = SystemDiagnostic;
