// database-service-with-credits.js - Adicionando sistema de créditos + CORREÇÃO PRODUTO SELECIONADO + ANTI-FLOOD
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class DatabaseService {
    constructor(dbPath = './database.sqlite') {
        this.dbPath = dbPath;
        this.db = null;
        this.isConnected = false;
        
        // Iniciar limpeza automática de dados de flood
        this.startFloodCleanup();
    }

    async initialize() {
        try {
            // Criar diretório se não existir
            const dir = path.dirname(this.dbPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Conectar ao banco
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Erro ao conectar SQLite:', err.message);
                    throw err;
                } else {
                    console.log('✅ SQLite conectado:', this.dbPath);
                    this.isConnected = true;
                }
            });

            // Habilitar foreign keys
            await this.run('PRAGMA foreign_keys = ON');

            // Criar tabelas
            await this.createTables();

        } catch (error) {
            console.error('Erro ao inicializar banco:', error);
            throw error;
        }
    }

    // 🔧 CORREÇÃO: Criar tabelas com campo para produto selecionado na ativação + ANTI-FLOOD
    async createTables() {
        try {
            // Tabela de produtos
            await this.run(`
                CREATE TABLE IF NOT EXISTS products (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    price REAL NOT NULL,
                    currency TEXT DEFAULT 'BRL',
                    activation_module TEXT NOT NULL,
                    payment_confirmed_message TEXT,
                    active BOOLEAN DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Verificar se a coluna payment_confirmed_message já existe
            const tableInfo = await this.all("PRAGMA table_info(products)");
            const hasPaymentConfirmedMessage = tableInfo.some(col => col.name === 'payment_confirmed_message');
            
            if (!hasPaymentConfirmedMessage) {
                await this.run('ALTER TABLE products ADD COLUMN payment_confirmed_message TEXT');
                console.log('✅ Coluna payment_confirmed_message adicionada à tabela products');
            }

            // Tabela de mensagens globais
            await this.run(`
                CREATE TABLE IF NOT EXISTS messages (
                    type TEXT PRIMARY KEY,
                    content TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Tabela de pedidos (com campos de crédito E produto selecionado)
            await this.run(`
                CREATE TABLE IF NOT EXISTS orders (
                    id TEXT PRIMARY KEY,
                    chat_id TEXT NOT NULL,
                    product_id TEXT NOT NULL,
                    product_data TEXT NOT NULL, -- JSON do produto original
                    selected_product_for_activation TEXT, -- 🔧 NOVO: JSON do produto selecionado para ativação
                    pix_code TEXT,
                    payment_id TEXT,
                    status TEXT DEFAULT 'pending_payment',
                    activation_data TEXT,
                    result TEXT,
                    error TEXT,
                    manual_approval BOOLEAN DEFAULT 0,
                    credit_amount REAL DEFAULT 0, -- NOVO: Valor do crédito
                    credit_used BOOLEAN DEFAULT 0, -- NOVO: Se o crédito foi usado
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    paid_at DATETIME,
                    completed_at DATETIME,
                    FOREIGN KEY (product_id) REFERENCES products (id)
                )
            `);

            // Verificar e adicionar novas colunas se não existirem
            const orderTableInfo = await this.all("PRAGMA table_info(orders)");
            const hasCreditAmount = orderTableInfo.some(col => col.name === 'credit_amount');
            const hasCreditUsed = orderTableInfo.some(col => col.name === 'credit_used');
            const hasSelectedProductForActivation = orderTableInfo.some(col => col.name === 'selected_product_for_activation');
            
            if (!hasCreditAmount) {
                await this.run('ALTER TABLE orders ADD COLUMN credit_amount REAL DEFAULT 0');
                console.log('✅ Coluna credit_amount adicionada à tabela orders');
            }
            
            if (!hasCreditUsed) {
                await this.run('ALTER TABLE orders ADD COLUMN credit_used BOOLEAN DEFAULT 0');
                console.log('✅ Coluna credit_used adicionada à tabela orders');
            }

            // 🔧 NOVA COLUNA PARA PRODUTO SELECIONADO
            if (!hasSelectedProductForActivation) {
                await this.run('ALTER TABLE orders ADD COLUMN selected_product_for_activation TEXT');
                console.log('✅ Coluna selected_product_for_activation adicionada à tabela orders');
            }

            // Tabela de sessões de usuário (com estado de crédito)
            await this.run(`
                CREATE TABLE IF NOT EXISTS user_sessions (
                    chat_id TEXT PRIMARY KEY,
                    state TEXT,
                    current_order_id TEXT,
                    credit_order_id TEXT, -- NOVO: ID do pedido que gerou crédito
                    available_credit REAL DEFAULT 0, -- NOVO: Crédito disponível
                    data TEXT, -- JSON para dados extras
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Verificar e adicionar novas colunas de crédito na sessão
            const sessionTableInfo = await this.all("PRAGMA table_info(user_sessions)");
            const hasCreditOrderId = sessionTableInfo.some(col => col.name === 'credit_order_id');
            const hasAvailableCredit = sessionTableInfo.some(col => col.name === 'available_credit');
            
            if (!hasCreditOrderId) {
                await this.run('ALTER TABLE user_sessions ADD COLUMN credit_order_id TEXT');
                console.log('✅ Coluna credit_order_id adicionada à tabela user_sessions');
            }
            
            if (!hasAvailableCredit) {
                await this.run('ALTER TABLE user_sessions ADD COLUMN available_credit REAL DEFAULT 0');
                console.log('✅ Coluna available_credit adicionada à tabela user_sessions');
            }

            // Tabela de configurações
            await this.run(`
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // 🔒 NOVA TABELA PARA SISTEMA ANTI-FLOOD
            await this.createFloodControlTable();

            // Índices para performance
            await this.run('CREATE INDEX IF NOT EXISTS idx_orders_chat_id ON orders(chat_id)');
            await this.run('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)');
            await this.run('CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)');
            await this.run('CREATE INDEX IF NOT EXISTS idx_orders_credit_used ON orders(credit_used)');

            console.log('✅ Tabelas SQLite criadas/verificadas com sistema de créditos + produto selecionado + anti-flood');

        } catch (error) {
            console.error('Erro ao criar tabelas:', error);
            throw error;
        }
    }

    // 🔒 NOVA TABELA PARA SISTEMA ANTI-FLOOD
    async createFloodControlTable() {
        try {
            await this.run(`
                CREATE TABLE IF NOT EXISTS flood_control (
                    chat_id TEXT PRIMARY KEY,
                    message_count INTEGER DEFAULT 0,
                    blocked_until DATETIME,
                    warning_shown BOOLEAN DEFAULT 0,
                    last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    total_blocks INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Índices para performance
            await this.run('CREATE INDEX IF NOT EXISTS idx_flood_blocked_until ON flood_control(blocked_until)');
            await this.run('CREATE INDEX IF NOT EXISTS idx_flood_last_message ON flood_control(last_message_at)');

            console.log('✅ Tabela flood_control criada/verificada');
            
        } catch (error) {
            console.error('Erro ao criar tabela flood_control:', error);
            throw error;
        }
    }

    // 🔒 LIMPEZA AUTOMÁTICA DOS DADOS DE FLOOD
    startFloodCleanup() {
        setInterval(async () => {
            if (this.isConnected) {
                try {
                    const cleaned = await this.cleanExpiredFloodData();
                    if (cleaned.clearedBlocks > 0 || cleaned.deletedOld > 0) {
                        console.log('🧹 Limpeza automática flood:', cleaned);
                    }
                } catch (error) {
                    console.error('Erro na limpeza automática de flood:', error);
                }
            }
        }, 5 * 60 * 1000); // A cada 5 minutos
    }

    // Método helper para executar queries
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    // Método helper para buscar um registro
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Método helper para buscar múltiplos registros
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // === PRODUTOS ===
    async saveProduct(product) {
        try {
            await this.run(`
                INSERT OR REPLACE INTO products 
                (id, name, description, price, currency, activation_module, payment_confirmed_message, active, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                product.id,
                product.name,
                product.description,
                product.price,
                product.currency || 'BRL',
                product.activationModule,
                product.paymentConfirmedMessage || null,
                product.active ? 1 : 0
            ]);

            return true;
        } catch (error) {
            console.error('Erro ao salvar produto:', error);
            throw error;
        }
    }

    async getProducts() {
        try {
            const rows = await this.all('SELECT * FROM products ORDER BY created_at DESC');
            
            return rows.map(row => ({
                id: row.id,
                name: row.name,
                description: row.description,
                price: row.price,
                currency: row.currency,
                activationModule: row.activation_module,
                paymentConfirmedMessage: row.payment_confirmed_message,
                active: Boolean(row.active),
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }));
        } catch (error) {
            console.error('Erro ao buscar produtos:', error);
            throw error;
        }
    }

    async getProduct(id) {
        try {
            const row = await this.get('SELECT * FROM products WHERE id = ?', [id]);
            
            if (!row) return null;

            return {
                id: row.id,
                name: row.name,
                description: row.description,
                price: row.price,
                currency: row.currency,
                activationModule: row.activation_module,
                paymentConfirmedMessage: row.payment_confirmed_message,
                active: Boolean(row.active),
                createdAt: row.created_at,
                updatedAt: row.updated_at
            };
        } catch (error) {
            console.error('Erro ao buscar produto:', error);
            throw error;
        }
    }

    async deleteProduct(id) {
        try {
            const result = await this.run('DELETE FROM products WHERE id = ?', [id]);
            return result.changes > 0;
        } catch (error) {
            console.error('Erro ao excluir produto:', error);
            throw error;
        }
    }

    // === MENSAGENS ===
    async saveMessage(type, content) {
        try {
            await this.run(`
                INSERT OR REPLACE INTO messages (type, content, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
            `, [type, content]);

            return true;
        } catch (error) {
            console.error('Erro ao salvar mensagem:', error);
            throw error;
        }
    }

    async getMessages() {
        try {
            const rows = await this.all('SELECT * FROM messages ORDER BY type');
            
            const messages = {};
            rows.forEach(row => {
                messages[row.type] = {
                    type: row.type,
                    content: row.content,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at
                };
            });

            return messages;
        } catch (error) {
            console.error('Erro ao buscar mensagens:', error);
            throw error;
        }
    }

    async getMessage(type) {
        try {
            const row = await this.get('SELECT * FROM messages WHERE type = ?', [type]);
            
            if (!row) return null;

            return {
                type: row.type,
                content: row.content,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            };
        } catch (error) {
            console.error('Erro ao buscar mensagem:', error);
            throw error;
        }
    }

    // === BUSCAR MENSAGEM DE CONFIRMAÇÃO ESPECÍFICA DO PRODUTO ===
    async getPaymentConfirmedMessage(productId) {
        try {
            // Primeiro tenta buscar mensagem específica do produto
            const product = await this.getProduct(productId);
            
            if (product && product.paymentConfirmedMessage) {
                return {
                    type: `payment_confirmed_${productId}`,
                    content: product.paymentConfirmedMessage,
                    isCustom: true
                };
            }
            
            // Se não tem específica, usa a padrão
            const defaultMessage = await this.getMessage('payment_confirmed');
            
            if (defaultMessage) {
                return {
                    type: 'payment_confirmed',
                    content: defaultMessage.content,
                    isCustom: false
                };
            }
            
            // Fallback absoluto
            return {
                type: 'payment_confirmed_fallback',
                content: '✅ *Pagamento confirmado!*\n\n🎯 {product_name}\n💰 R$ {price}\n\n📝 *Envie as informações para ativação.*',
                isCustom: false
            };
            
        } catch (error) {
            console.error('Erro ao buscar mensagem de confirmação:', error);
            throw error;
        }
    }

    // === PEDIDOS - 🔧 CORRIGIDO COM SUPORTE A PRODUTO SELECIONADO ===
    async saveOrder(order) {
        try {
            await this.run(`
                INSERT OR REPLACE INTO orders 
                (id, chat_id, product_id, product_data, selected_product_for_activation, pix_code, payment_id, status, 
                 activation_data, result, error, manual_approval, credit_amount, credit_used, paid_at, completed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                order.id,
                order.chatId,
                order.productId,
                JSON.stringify(order.product),
                order.selectedProductForActivation ? JSON.stringify(order.selectedProductForActivation) : null, // 🔧 NOVO
                order.pixCode,
                order.paymentId,
                order.status,
                order.activationData,
                order.result,
                order.error,
                order.manualApproval ? 1 : 0,
                order.creditAmount || 0,
                order.creditUsed ? 1 : 0,
                order.paidAt,
                order.completedAt
            ]);

            return true;
        } catch (error) {
            console.error('Erro ao salvar pedido:', error);
            throw error;
        }
    }

    // 🔧 CORREÇÃO: Método getOrders atualizado
    async getOrders(limit = 100) {
        try {
            const rows = await this.all(`
                SELECT * FROM orders 
                ORDER BY created_at DESC 
                LIMIT ?
            `, [limit]);
            
            return rows.map(row => ({
                id: row.id,
                chatId: row.chat_id,
                productId: row.product_id,
                product: JSON.parse(row.product_data),
                selectedProductForActivation: row.selected_product_for_activation ? JSON.parse(row.selected_product_for_activation) : null, // 🔧 NOVO
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
        } catch (error) {
            console.error('Erro ao buscar pedidos:', error);
            throw error;
        }
    }

    // 🔧 CORREÇÃO: Método getOrder atualizado
    async getOrder(id) {
        try {
            const row = await this.get('SELECT * FROM orders WHERE id = ?', [id]);
            
            if (!row) return null;

            return {
                id: row.id,
                chatId: row.chat_id,
                productId: row.product_id,
                product: JSON.parse(row.product_data),
                selectedProductForActivation: row.selected_product_for_activation ? JSON.parse(row.selected_product_for_activation) : null, // 🔧 NOVO
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
            };
        } catch (error) {
            console.error('Erro ao buscar pedido:', error);
            throw error;
        }
    }

    // === SESSÕES DE USUÁRIO COM CRÉDITOS ===
    async saveUserSession(chatId, session) {
        try {
            await this.run(`
                INSERT OR REPLACE INTO user_sessions 
                (chat_id, state, current_order_id, credit_order_id, available_credit, data, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                chatId,
                session.state,
                session.currentOrderId,
                session.creditOrderId || null,
                session.availableCredit || 0,
                JSON.stringify(session.data || {})
            ]);

            return true;
        } catch (error) {
            console.error('Erro ao salvar sessão:', error);
            throw error;
        }
    }

    async getUserSession(chatId) {
        try {
            const row = await this.get('SELECT * FROM user_sessions WHERE chat_id = ?', [chatId]);
            
            if (!row) {
                return { 
                    state: null, 
                    currentOrderId: null, 
                    creditOrderId: null,
                    availableCredit: 0,
                    data: {} 
                };
            }

            return {
                state: row.state,
                currentOrderId: row.current_order_id,
                creditOrderId: row.credit_order_id,
                availableCredit: row.available_credit || 0,
                data: JSON.parse(row.data || '{}'),
                createdAt: row.created_at,
                updatedAt: row.updated_at
            };
        } catch (error) {
            console.error('Erro ao buscar sessão:', error);
            return { 
                state: null, 
                currentOrderId: null, 
                creditOrderId: null,
                availableCredit: 0,
                data: {} 
            };
        }
    }

    // === NOVOS MÉTODOS PARA SISTEMA DE CRÉDITOS ===

    // Conceder crédito ao usuário após pagamento
    async grantCredit(chatId, orderId, creditAmount) {
        try {
            const userSession = await this.getUserSession(chatId);
            userSession.creditOrderId = orderId;
            userSession.availableCredit = creditAmount;
            userSession.state = 'credit_menu';
            
            await this.saveUserSession(chatId, userSession);
            
            // Atualizar pedido com informações de crédito
            const order = await this.getOrder(orderId);
            if (order) {
                order.creditAmount = creditAmount;
                order.creditUsed = false;
                await this.saveOrder(order);
            }
            
            console.log(`💳 Crédito concedido: ${chatId} - R$ ${creditAmount} (Pedido: ${orderId})`);
            return true;
        } catch (error) {
            console.error('Erro ao conceder crédito:', error);
            throw error;
        }
    }

    // Usar crédito para ativação
    async useCredit(chatId, productPrice) {
        try {
            const userSession = await this.getUserSession(chatId);
            
            if (userSession.availableCredit >= productPrice) {
                // Marcar crédito como usado
                const creditOrder = await this.getOrder(userSession.creditOrderId);
                if (creditOrder) {
                    creditOrder.creditUsed = true;
                    await this.saveOrder(creditOrder);
                }
                
                // Limpar crédito da sessão
                userSession.creditOrderId = null;
                userSession.availableCredit = 0;
                userSession.state = 'awaiting_activation_info';
                await this.saveUserSession(chatId, userSession);
                
                console.log(`💰 Crédito usado: ${chatId} - R$ ${productPrice}`);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Erro ao usar crédito:', error);
            throw error;
        }
    }

    // Verificar se usuário tem crédito suficiente
    async hasCredit(chatId, minimumAmount = 0) {
        try {
            const userSession = await this.getUserSession(chatId);
            return userSession.availableCredit >= minimumAmount;
        } catch (error) {
            console.error('Erro ao verificar crédito:', error);
            return false;
        }
    }

    // Limpar crédito (para casos especiais)
    async clearCredit(chatId, reason = 'Admin action') {
        try {
            const userSession = await this.getUserSession(chatId);
            
            if (userSession.creditOrderId) {
                const creditOrder = await this.getOrder(userSession.creditOrderId);
                if (creditOrder) {
                    creditOrder.creditUsed = true;
                    creditOrder.error = reason;
                    await this.saveOrder(creditOrder);
                }
            }
            
            userSession.creditOrderId = null;
            userSession.availableCredit = 0;
            userSession.state = null;
            await this.saveUserSession(chatId, userSession);
            
            console.log(`🧹 Crédito limpo: ${chatId} - Motivo: ${reason}`);
            return true;
        } catch (error) {
            console.error('Erro ao limpar crédito:', error);
            throw error;
        }
    }

    // === 🔒 MÉTODOS PARA SISTEMA ANTI-FLOOD ===

    // Registrar tentativa de flood no banco
    async recordFloodAttempt(chatId, messageCount, isBlocked = false, blockDuration = 60000) {
        try {
            const now = new Date().toISOString();
            const blockedUntil = isBlocked ? new Date(Date.now() + blockDuration).toISOString() : null;
            
            // Buscar dados existentes para incrementar total_blocks
            const existing = await this.get('SELECT total_blocks FROM flood_control WHERE chat_id = ?', [chatId]);
            const totalBlocks = isBlocked ? (existing?.total_blocks || 0) + 1 : (existing?.total_blocks || 0);
            
            await this.run(`
                INSERT OR REPLACE INTO flood_control 
                (chat_id, message_count, blocked_until, warning_shown, last_message_at, total_blocks, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                chatId,
                messageCount,
                blockedUntil,
                isBlocked ? 1 : 0,
                now,
                totalBlocks,
                now
            ]);

            return true;
        } catch (error) {
            console.error('Erro ao registrar flood attempt:', error);
            return false;
        }
    }

    // Obter dados de flood de um usuário
    async getFloodData(chatId) {
        try {
            const row = await this.get('SELECT * FROM flood_control WHERE chat_id = ?', [chatId]);
            
            if (!row) return null;

            return {
                chatId: row.chat_id,
                messageCount: row.message_count,
                blockedUntil: row.blocked_until,
                warningShown: Boolean(row.warning_shown),
                lastMessageAt: row.last_message_at,
                totalBlocks: row.total_blocks || 0,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            };
        } catch (error) {
            console.error('Erro ao buscar dados de flood:', error);
            return null;
        }
    }

    // Obter usuários atualmente bloqueados
    async getBlockedUsers() {
        try {
            const now = new Date().toISOString();
            const rows = await this.all(`
                SELECT * FROM flood_control 
                WHERE blocked_until IS NOT NULL 
                AND blocked_until > ? 
                ORDER BY blocked_until DESC
            `, [now]);
            
            return rows.map(row => ({
                chatId: row.chat_id,
                messageCount: row.message_count,
                blockedUntil: row.blocked_until,
                warningShown: Boolean(row.warning_shown),
                remainingTime: Math.ceil((new Date(row.blocked_until) - new Date()) / 1000),
                lastMessageAt: row.last_message_at,
                totalBlocks: row.total_blocks || 0
            }));
        } catch (error) {
            console.error('Erro ao buscar usuários bloqueados:', error);
            return [];
        }
    }

    // Limpar dados de flood expirados
    async cleanExpiredFloodData() {
        try {
            const now = new Date().toISOString();
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            
            // Limpar bloqueios expirados
            const clearedBlocks = await this.run(`
                UPDATE flood_control 
                SET blocked_until = NULL, warning_shown = 0 
                WHERE blocked_until IS NOT NULL AND blocked_until <= ?
            `, [now]);
            
            // Remover registros muito antigos
            const deletedOld = await this.run(`
                DELETE FROM flood_control 
                WHERE blocked_until IS NULL 
                AND last_message_at < ?
            `, [oneDayAgo]);

            return {
                clearedBlocks: clearedBlocks.changes,
                deletedOld: deletedOld.changes
            };
        } catch (error) {
            console.error('Erro ao limpar dados de flood:', error);
            return { clearedBlocks: 0, deletedOld: 0 };
        }
    }

    // Desbloquear usuário específico (admin)
    async adminUnblockUser(chatId, reason = 'Admin intervention') {
        try {
            const result = await this.run(`
                UPDATE flood_control 
                SET blocked_until = NULL, warning_shown = 0, updated_at = CURRENT_TIMESTAMP
                WHERE chat_id = ?
            `, [chatId]);

            if (result.changes > 0) {
                console.log(`🔓 ADMIN UNBLOCK: ${chatId} - ${reason}`);
            }

            return result.changes > 0;
        } catch (error) {
            console.error('Erro ao desbloquear usuário:', error);
            return false;
        }
    }

    // Estatísticas de flood
    async getFloodStats() {
        try {
            const now = new Date().toISOString();
            
            const totalUsers = await this.get('SELECT COUNT(*) as count FROM flood_control');
            const blockedUsers = await this.get(`
                SELECT COUNT(*) as count FROM flood_control 
                WHERE blocked_until IS NOT NULL AND blocked_until > ?
            `, [now]);
            
            const recentMessages = await this.get(`
                SELECT COUNT(*) as count FROM flood_control 
                WHERE last_message_at > ?
            `, [new Date(Date.now() - 60000).toISOString()]);

            const totalBlocks = await this.get('SELECT SUM(total_blocks) as total FROM flood_control');

            return {
                totalUsersTracked: totalUsers.count,
                currentlyBlocked: blockedUsers.count,
                recentActiveUsers: recentMessages.count,
                totalBlocksIssued: totalBlocks.total || 0,
                timestamp: now
            };
        } catch (error) {
            console.error('Erro ao obter estatísticas de flood:', error);
            return {
                totalUsersTracked: 0,
                currentlyBlocked: 0,
                recentActiveUsers: 0,
                totalBlocksIssued: 0,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Limpar TODOS os dados de flood (emergência)
    async clearAllFloodData() {
        try {
            const result = await this.run('DELETE FROM flood_control');
            console.log(`🧹 ADMIN: Todos os dados de flood limpos (${result.changes} registros)`);
            return result.changes;
        } catch (error) {
            console.error('Erro ao limpar todos os dados de flood:', error);
            return 0;
        }
    }

    // Obter usuários com mais bloqueios (top flooders)
    async getTopFlooders(limit = 10) {
        try {
            const rows = await this.all(`
                SELECT chat_id, total_blocks, last_message_at, created_at
                FROM flood_control 
                WHERE total_blocks > 0
                ORDER BY total_blocks DESC, last_message_at DESC
                LIMIT ?
            `, [limit]);
            
            return rows.map(row => ({
                chatId: row.chat_id.substring(0, 15) + '...',
                fullChatId: row.chat_id,
                totalBlocks: row.total_blocks,
                lastActivity: row.last_message_at,
                firstSeen: row.created_at
            }));
        } catch (error) {
            console.error('Erro ao buscar top flooders:', error);
            return [];
        }
    }

    // === CONFIGURAÇÕES ===
    async saveSetting(key, value) {
        try {
            await this.run(`
                INSERT OR REPLACE INTO settings (key, value, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
            `, [key, JSON.stringify(value)]);

            return true;
        } catch (error) {
            console.error('Erro ao salvar configuração:', error);
            throw error;
        }
    }

    async getSetting(key) {
        try {
            const row = await this.get('SELECT value FROM settings WHERE key = ?', [key]);
            
            if (!row) return null;

            return JSON.parse(row.value);
        } catch (error) {
            console.error('Erro ao buscar configuração:', error);
            return null;
        }
    }

    async getSettings() {
        try {
            const rows = await this.all('SELECT * FROM settings');
            
            const settings = {};
            rows.forEach(row => {
                settings[row.key] = JSON.parse(row.value);
            });

            return settings;
        } catch (error) {
            console.error('Erro ao buscar configurações:', error);
            return {};
        }
    }

    // === ESTATÍSTICAS GERAIS ===
    async getStats() {
        try {
            const totalOrders = await this.get('SELECT COUNT(*) as count FROM orders');
            const completedOrders = await this.get('SELECT COUNT(*) as count FROM orders WHERE status = "completed"');
            const pendingOrders = await this.get('SELECT COUNT(*) as count FROM orders WHERE status IN ("pending_payment", "paid", "processing")');
            const totalRevenue = await this.get('SELECT SUM(CAST(JSON_EXTRACT(product_data, "$.price") AS REAL)) as total FROM orders WHERE status = "completed"');
            const activeCreditUsers = await this.get('SELECT COUNT(*) as count FROM user_sessions WHERE available_credit > 0');

            // Estatísticas de flood
            const floodStats = await this.getFloodStats();

            return {
                // Estatísticas de pedidos
                totalOrders: totalOrders.count,
                completedOrders: completedOrders.count,
                pendingOrders: pendingOrders.count,
                totalRevenue: totalRevenue.total || 0,
                activeCreditUsers: activeCreditUsers.count || 0,
                
                // Estatísticas de flood
                floodProtection: {
                    totalUsersTracked: floodStats.totalUsersTracked,
                    currentlyBlocked: floodStats.currentlyBlocked,
                    recentActiveUsers: floodStats.recentActiveUsers,
                    totalBlocksIssued: floodStats.totalBlocksIssued
                }
            };
        } catch (error) {
            console.error('Erro ao buscar estatísticas:', error);
            return {
                totalOrders: 0,
                completedOrders: 0,
                pendingOrders: 0,
                totalRevenue: 0,
                activeCreditUsers: 0,
                floodProtection: {
                    totalUsersTracked: 0,
                    currentlyBlocked: 0,
                    recentActiveUsers: 0,
                    totalBlocksIssued: 0
                }
            };
        }
    }

    // === MÉTODOS ADMINISTRATIVOS AVANÇADOS ===

    // Obter relatório completo de um usuário
    async getUserReport(chatId) {
        try {
            // Dados básicos
            const userSession = await this.getUserSession(chatId);
            const floodData = await this.getFloodData(chatId);
            
            // Pedidos do usuário
            const orders = await this.all(`
                SELECT * FROM orders 
                WHERE chat_id = ? 
                ORDER BY created_at DESC 
                LIMIT 10
            `, [chatId]);
            
            // Estatísticas do usuário
            const totalOrders = await this.get('SELECT COUNT(*) as count FROM orders WHERE chat_id = ?', [chatId]);
            const completedOrders = await this.get('SELECT COUNT(*) as count FROM orders WHERE chat_id = ? AND status = "completed"', [chatId]);
            const totalSpent = await this.get('SELECT SUM(CAST(JSON_EXTRACT(product_data, "$.price") AS REAL)) as total FROM orders WHERE chat_id = ? AND status = "completed"', [chatId]);

            return {
                chatId: chatId.substring(0, 15) + '...',
                fullChatId: chatId,
                
                // Sessão atual
                currentSession: userSession,
                
                // Dados de flood
                floodData: floodData,
                
                // Estatísticas
                stats: {
                    totalOrders: totalOrders.count,
                    completedOrders: completedOrders.count,
                    totalSpent: totalSpent.total || 0,
                    successRate: totalOrders.count > 0 ? (completedOrders.count / totalOrders.count * 100).toFixed(1) : 0
                },
                
                // Pedidos recentes
                recentOrders: orders.map(order => ({
                    id: order.id.substring(0, 8) + '...',
                    productName: JSON.parse(order.product_data).name,
                    price: JSON.parse(order.product_data).price,
                    status: order.status,
                    createdAt: order.created_at,
                    completedAt: order.completed_at
                })),
                
                // Timestamp do relatório
                reportGeneratedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('Erro ao gerar relatório de usuário:', error);
            return null;
        }
    }

    // Backup de dados críticos
    async createBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupData = {
                timestamp,
                products: await this.getProducts(),
                messages: await this.getMessages(),
                settings: await this.getSettings(),
                stats: await this.getStats()
            };
            
            return backupData;
        } catch (error) {
            console.error('Erro ao criar backup:', error);
            throw error;
        }
    }

    // Fechar conexão
    async close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('Erro ao fechar banco:', err);
                    } else {
                        console.log('Banco SQLite fechado');
                    }
                    this.isConnected = false;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = DatabaseService;