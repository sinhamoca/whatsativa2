// debug-activation-flow.js - Script para debugar o fluxo de ativação
const DatabaseService = require('./database-service');

async function debugActivationFlow() {
    console.log('🔍 DEBUGANDO FLUXO DE ATIVAÇÃO');
    console.log('═'.repeat(50));

    const db = new DatabaseService('./database.sqlite');
    
    try {
        await db.initialize();
        
        // 1. Verificar pedidos recentes
        console.log('\n📋 PEDIDOS RECENTES:');
        const recentOrders = await db.all(`
            SELECT * FROM orders 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        
        recentOrders.forEach(order => {
            console.log(`📦 ${order.id.substring(0, 8)}... | ${order.status} | ${JSON.parse(order.product_data).name} | ${order.created_at}`);
            if (order.error) {
                console.log(`   ❌ Erro: ${order.error}`);
            }
        });
        
        // 2. Verificar sessões de usuário
        console.log('\n👥 SESSÕES DE USUÁRIO:');
        const sessions = await db.all(`
            SELECT * FROM user_sessions 
            ORDER BY updated_at DESC 
            LIMIT 5
        `);
        
        sessions.forEach(session => {
            console.log(`👤 ${session.chat_id.substring(0, 15)}... | Estado: ${session.state} | Crédito: R$ ${session.available_credit}`);
            if (session.current_order_id) {
                console.log(`   🛒 Pedido atual: ${session.current_order_id.substring(0, 8)}...`);
            }
        });
        
        // 3. Verificar se há erro específico
        console.log('\n🔍 VERIFICANDO POSSÍVEIS PROBLEMAS:');
        
        // Verificar pedidos com status estranho
        const problematicOrders = await db.all(`
            SELECT * FROM orders 
            WHERE status NOT IN ('pending_payment', 'paid', 'completed', 'failed', 'cancelled')
            ORDER BY created_at DESC 
            LIMIT 10
        `);
        
        if (problematicOrders.length > 0) {
            console.log('⚠️ Pedidos com status não padrão:');
            problematicOrders.forEach(order => {
                console.log(`   📦 ${order.id} | Status: ${order.status}`);
            });
        } else {
            console.log('✅ Todos os pedidos têm status válidos');
        }
        
        // Verificar estrutura das tabelas
        console.log('\n📊 ESTRUTURA DAS TABELAS:');
        
        const ordersColumns = await db.all("PRAGMA table_info(orders)");
        console.log('📋 Colunas da tabela orders:');
        ordersColumns.forEach(col => {
            console.log(`   • ${col.name} (${col.type})`);
        });
        
        const sessionsColumns = await db.all("PRAGMA table_info(user_sessions)");
        console.log('\n👥 Colunas da tabela user_sessions:');
        sessionsColumns.forEach(col => {
            console.log(`   • ${col.name} (${col.type})`);
        });
        
        // 4. Buscar último erro específico
        console.log('\n🔍 BUSCANDO ERROS RECENTES:');
        
        const errorOrders = await db.all(`
            SELECT * FROM orders 
            WHERE error IS NOT NULL AND error != ''
            ORDER BY created_at DESC 
            LIMIT 3
        `);
        
        if (errorOrders.length > 0) {
            console.log('❌ Pedidos com erro:');
            errorOrders.forEach(order => {
                console.log(`   📦 ${order.id.substring(0, 8)}... | ${order.status}`);
                console.log(`      💥 Erro: ${order.error}`);
                console.log(`      📅 Data: ${order.created_at}`);
            });
        } else {
            console.log('✅ Nenhum pedido com erro encontrado');
        }
        
        console.log('\n═'.repeat(50));
        console.log('🎯 DIAGNÓSTICO CONCLUÍDO');
        
    } catch (error) {
        console.error('❌ Erro no debug:', error);
    } finally {
        await db.close();
    }
}

// Função para limpar dados de teste
async function cleanTestData() {
    console.log('🧹 LIMPANDO DADOS DE TESTE');
    console.log('═'.repeat(50));

    const db = new DatabaseService('./database.sqlite');
    
    try {
        await db.initialize();
        
        // Limpar pedidos de teste
        const result1 = await db.run(`
            DELETE FROM orders 
            WHERE id LIKE 'credit_%' OR created_at < datetime('now', '-1 hour')
        `);
        console.log(`🗑️ ${result1.changes} pedidos antigos removidos`);
        
        // Limpar sessões problemáticas
        const result2 = await db.run(`
            UPDATE user_sessions 
            SET state = NULL, current_order_id = NULL 
            WHERE state = 'awaiting_activation_info'
        `);
        console.log(`🔄 ${result2.changes} sessões resetadas`);
        
        console.log('✅ Limpeza concluída');
        
    } catch (error) {
        console.error('❌ Erro na limpeza:', error);
    } finally {
        await db.close();
    }
}

// Executar baseado no argumento
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('clean')) {
        cleanTestData();
    } else {
        debugActivationFlow();
    }
}

module.exports = { debugActivationFlow, cleanTestData };
