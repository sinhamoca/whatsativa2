// clear-pending-orders.js - Script para limpar pedidos pendentes

const DatabaseService = require('./database-service');
const readline = require('readline');

class PendingOrdersCleaner {
    constructor() {
        this.db = null;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async run() {
        console.log('🧹 SCRIPT DE LIMPEZA DE PEDIDOS PENDENTES');
        console.log('=' * 50);
        
        try {
            // Conectar ao banco
            await this.connectDatabase();
            
            // Mostrar estatísticas atuais
            await this.showCurrentStats();
            
            // Mostrar opções
            await this.showOptions();
            
        } catch (error) {
            console.error('❌ Erro no script:', error);
        } finally {
            this.rl.close();
            if (this.db) {
                await this.db.close();
            }
        }
    }

    async connectDatabase() {
        console.log('🔌 Conectando ao banco de dados...');
        this.db = new DatabaseService('./database.sqlite');
        await this.db.initialize();
        console.log('✅ Conectado ao banco de dados');
    }

    async showCurrentStats() {
        console.log('\n📊 ESTATÍSTICAS ATUAIS:');
        console.log('-' * 30);
        
        // Total de pedidos
        const totalOrders = await this.db.get('SELECT COUNT(*) as count FROM orders');
        console.log(`📋 Total de pedidos: ${totalOrders.count}`);
        
        // Pedidos por status
        const statuses = await this.db.all(`
            SELECT status, COUNT(*) as count 
            FROM orders 
            GROUP BY status 
            ORDER BY count DESC
        `);
        
        statuses.forEach(status => {
            console.log(`   ${this.getStatusEmoji(status.status)} ${status.status}: ${status.count}`);
        });
        
        // Pedidos pendentes detalhados
        const pendingDetails = await this.db.all(`
            SELECT 
                COUNT(*) as count,
                MIN(created_at) as oldest,
                MAX(created_at) as newest,
                COUNT(CASE WHEN payment_id IS NOT NULL AND payment_id != '' THEN 1 END) as with_payment_id
            FROM orders 
            WHERE status = 'pending_payment'
        `);
        
        if (pendingDetails[0].count > 0) {
            const detail = pendingDetails[0];
            console.log('\n⏳ DETALHES DOS PEDIDOS PENDENTES:');
            console.log(`   📊 Total: ${detail.count}`);
            console.log(`   🆔 Com PaymentID: ${detail.with_payment_id}`);
            console.log(`   📅 Mais antigo: ${detail.oldest}`);
            console.log(`   📅 Mais recente: ${detail.newest}`);
            
            // Pedidos por tempo
            const timeGroups = await this.db.all(`
                SELECT 
                    CASE 
                        WHEN (julianday('now') - julianday(created_at)) * 24 * 60 <= 30 THEN 'Últimos 30 min'
                        WHEN (julianday('now') - julianday(created_at)) * 24 * 60 <= 60 THEN '30-60 min'
                        WHEN (julianday('now') - julianday(created_at)) * 24 <= 1 THEN '1-24 horas'
                        WHEN (julianday('now') - julianday(created_at)) * 24 <= 7 THEN '1-7 dias'
                        ELSE 'Mais de 7 dias'
                    END as time_group,
                    COUNT(*) as count
                FROM orders 
                WHERE status = 'pending_payment'
                GROUP BY time_group
                ORDER BY 
                    CASE time_group
                        WHEN 'Últimos 30 min' THEN 1
                        WHEN '30-60 min' THEN 2
                        WHEN '1-24 horas' THEN 3
                        WHEN '1-7 dias' THEN 4
                        ELSE 5
                    END
            `);
            
            console.log('\n⏰ DISTRIBUIÇÃO POR TEMPO:');
            timeGroups.forEach(group => {
                console.log(`   ${group.time_group}: ${group.count} pedidos`);
            });
        }
    }

    async showOptions() {
        console.log('\n🔧 OPÇÕES DE LIMPEZA:');
        console.log('=' * 30);
        console.log('1. 🕐 Limpar pedidos com mais de 1 hora (SEGURO)');
        console.log('2. 📅 Limpar pedidos com mais de 24 horas (RECOMENDADO)');
        console.log('3. 🗑️ Limpar pedidos com mais de 7 dias (CONSERVADOR)');
        console.log('4. ⚠️ Limpar TODOS os pedidos pendentes (PERIGOSO)');
        console.log('5. 🔍 Limpar apenas pedidos sem PaymentID (MUITO SEGURO)');
        console.log('6. 📋 Mostrar pedidos que seriam afetados (PREVIEW)');
        console.log('7. ❌ Cancelar');
        
        const choice = await this.askQuestion('\n👆 Escolha uma opção (1-7): ');
        
        switch (choice.trim()) {
            case '1':
                await this.cleanByTime(1, 'horas');
                break;
            case '2':
                await this.cleanByTime(24, 'horas');
                break;
            case '3':
                await this.cleanByTime(7, 'dias');
                break;
            case '4':
                await this.cleanAll();
                break;
            case '5':
                await this.cleanWithoutPaymentId();
                break;
            case '6':
                await this.previewClean();
                break;
            case '7':
                console.log('❌ Operação cancelada');
                break;
            default:
                console.log('❌ Opção inválida');
        }
    }

    async cleanByTime(amount, unit) {
        let whereClause;
        let description;
        
        if (unit === 'horas') {
            whereClause = `(julianday('now') - julianday(created_at)) * 24 > ${amount}`;
            description = `mais de ${amount} hora${amount > 1 ? 's' : ''}`;
        } else {
            whereClause = `(julianday('now') - julianday(created_at)) > ${amount}`;
            description = `mais de ${amount} dia${amount > 1 ? 's' : ''}`;
        }
        
        // Contar quantos serão afetados
        const count = await this.db.get(`
            SELECT COUNT(*) as count 
            FROM orders 
            WHERE status = 'pending_payment' AND ${whereClause}
        `);
        
        if (count.count === 0) {
            console.log(`ℹ️ Nenhum pedido encontrado com ${description}`);
            return;
        }
        
        console.log(`\n⚠️ CONFIRMAÇÃO:`);
        console.log(`📊 ${count.count} pedidos pendentes com ${description} serão marcados como "expired"`);
        
        const confirm = await this.askQuestion('🔴 Confirma a limpeza? (sim/não): ');
        
        if (confirm.toLowerCase() === 'sim' || confirm.toLowerCase() === 's') {
            console.log('🧹 Limpando pedidos...');
            
            const result = await this.db.run(`
                UPDATE orders 
                SET status = 'expired',
                    error = 'Pedido expirado automaticamente - limpeza em ${new Date().toISOString()}'
                WHERE status = 'pending_payment' AND ${whereClause}
            `);
            
            console.log(`✅ ${result.changes} pedidos marcados como expirados`);
            await this.showCurrentStats();
        } else {
            console.log('❌ Limpeza cancelada');
        }
    }

    async cleanAll() {
        console.log('\n🚨 ATENÇÃO: OPERAÇÃO PERIGOSA!');
        console.log('Isso irá limpar TODOS os pedidos pendentes, incluindo os recentes');
        
        const count = await this.db.get(`
            SELECT COUNT(*) as count 
            FROM orders 
            WHERE status = 'pending_payment'
        `);
        
        if (count.count === 0) {
            console.log('ℹ️ Nenhum pedido pendente encontrado');
            return;
        }
        
        console.log(`📊 ${count.count} pedidos pendentes serão afetados`);
        
        const confirm1 = await this.askQuestion('🔴 Tem certeza? Digite "CONFIRMO": ');
        
        if (confirm1 !== 'CONFIRMO') {
            console.log('❌ Operação cancelada');
            return;
        }
        
        const confirm2 = await this.askQuestion('🔴 Última chance! Digite "SIM, LIMPAR TUDO": ');
        
        if (confirm2 !== 'SIM, LIMPAR TUDO') {
            console.log('❌ Operação cancelada');
            return;
        }
        
        console.log('🧹 Limpando TODOS os pedidos pendentes...');
        
        const result = await this.db.run(`
            UPDATE orders 
            SET status = 'expired_bulk',
                error = 'Limpeza manual em massa - ${new Date().toISOString()}'
            WHERE status = 'pending_payment'
        `);
        
        console.log(`✅ ${result.changes} pedidos marcados como expirados`);
        await this.showCurrentStats();
    }

    async cleanWithoutPaymentId() {
        console.log('\n🔍 Limpando pedidos sem PaymentID (muito seguro)...');
        
        const count = await this.db.get(`
            SELECT COUNT(*) as count 
            FROM orders 
            WHERE status = 'pending_payment' 
            AND (payment_id IS NULL OR payment_id = '')
        `);
        
        if (count.count === 0) {
            console.log('ℹ️ Nenhum pedido sem PaymentID encontrado');
            return;
        }
        
        console.log(`📊 ${count.count} pedidos sem PaymentID serão marcados como "abandoned"`);
        
        const confirm = await this.askQuestion('✅ Confirma? (sim/não): ');
        
        if (confirm.toLowerCase() === 'sim' || confirm.toLowerCase() === 's') {
            const result = await this.db.run(`
                UPDATE orders 
                SET status = 'abandoned',
                    error = 'Pedido abandonado - sem PaymentID'
                WHERE status = 'pending_payment' 
                AND (payment_id IS NULL OR payment_id = '')
            `);
            
            console.log(`✅ ${result.changes} pedidos marcados como abandonados`);
            await this.showCurrentStats();
        } else {
            console.log('❌ Limpeza cancelada');
        }
    }

    async previewClean() {
        console.log('\n🔍 PREVIEW DOS PEDIDOS PENDENTES:');
        console.log('=' * 50);
        
        const orders = await this.db.all(`
            SELECT 
                id,
                chat_id,
                created_at,
                payment_id,
                (julianday('now') - julianday(created_at)) * 24 * 60 as minutes_old,
                JSON_EXTRACT(product_data, '$.name') as product_name,
                JSON_EXTRACT(product_data, '$.price') as product_price
            FROM orders 
            WHERE status = 'pending_payment'
            ORDER BY created_at DESC
            LIMIT 20
        `);
        
        if (orders.length === 0) {
            console.log('ℹ️ Nenhum pedido pendente encontrado');
            return;
        }
        
        console.log('📋 Últimos 20 pedidos pendentes:');
        console.log('');
        
        orders.forEach((order, index) => {
            const ageMinutes = Math.round(order.minutes_old);
            const ageDisplay = ageMinutes > 60 ? 
                `${Math.round(ageMinutes/60)}h${ageMinutes%60}m` : 
                `${ageMinutes}m`;
                
            console.log(`${index + 1}. 🆔 ${order.id.substring(0, 8)}... | ⏰ ${ageDisplay} | 🎯 ${order.product_name} | 💰 R$ ${order.product_price} | 💳 ${order.payment_id ? '✅' : '❌'}`);
        });
        
        if (orders.length === 20) {
            console.log('\n... (mostrando apenas os 20 mais recentes)');
        }
    }

    getStatusEmoji(status) {
        const emojis = {
            'pending_payment': '⏳',
            'paid': '✅',
            'completed': '🎉',
            'cancelled': '❌',
            'expired': '⏰',
            'abandoned': '🗑️',
            'failed': '💥'
        };
        return emojis[status] || '📋';
    }

    askQuestion(question) {
        return new Promise(resolve => {
            this.rl.question(question, resolve);
        });
    }
}

// Script de comando rápido para situações de emergência
async function quickCleanOldOrders(hours = 24) {
    console.log(`🚀 LIMPEZA RÁPIDA - Removendo pedidos com mais de ${hours} horas`);
    
    try {
        const db = new DatabaseService('./database.sqlite');
        await db.initialize();
        
        const result = await db.run(`
            UPDATE orders 
            SET status = 'expired_quick',
                error = 'Limpeza rápida automática - ${new Date().toISOString()}'
            WHERE status = 'pending_payment' 
            AND (julianday('now') - julianday(created_at)) * 24 > ?
        `, [hours]);
        
        console.log(`✅ ${result.changes} pedidos antigos limpos`);
        
        await db.close();
        
    } catch (error) {
        console.error('❌ Erro na limpeza rápida:', error);
    }
}

// Executar script
if (require.main === module) {
    // Verificar argumentos da linha de comando
    const args = process.argv.slice(2);
    
    if (args.includes('--quick')) {
        const hours = args.includes('--hours') ? 
            parseInt(args[args.indexOf('--hours') + 1]) || 24 : 24;
        quickCleanOldOrders(hours);
    } else if (args.includes('--help')) {
        console.log('📖 USO DO SCRIPT:');
        console.log('');
        console.log('Modo interativo:');
        console.log('  node clear-pending-orders.js');
        console.log('');
        console.log('Limpeza rápida:');
        console.log('  node clear-pending-orders.js --quick');
        console.log('  node clear-pending-orders.js --quick --hours 12');
        console.log('');
        console.log('Ajuda:');
        console.log('  node clear-pending-orders.js --help');
    } else {
        const cleaner = new PendingOrdersCleaner();
        cleaner.run();
    }
}

module.exports = { PendingOrdersCleaner, quickCleanOldOrders };
