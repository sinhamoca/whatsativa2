// quick-test.js - Teste rápido do sistema após correções
const DatabaseService = require('./database-service');

async function quickTest() {
    console.log('🧪 TESTE RÁPIDO DO SISTEMA');
    console.log('═'.repeat(50));

    const db = new DatabaseService('./database.sqlite');
    
    try {
        await db.initialize();
        
        // 1. Verificar se há erros críticos recentes
        console.log('🔍 Verificando erros recentes...');
        
        const recentErrors = await db.all(`
            SELECT * FROM orders 
            WHERE error LIKE '%erro interno critico%' 
            OR error LIKE '%crítico%'
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        
        if (recentErrors.length > 0) {
            console.log('❌ ERROS CRÍTICOS ENCONTRADOS:');
            recentErrors.forEach(order => {
                console.log(`   📦 ${order.id.substring(0, 8)}... | ${order.status}`);
                console.log(`      💥 ${order.error}`);
                console.log(`      📅 ${order.created_at}`);
                console.log('');
            });
        } else {
            console.log('✅ Nenhum erro crítico recente encontrado');
        }
        
        // 2. Verificar estado das tabelas
        console.log('\n📊 Estado das tabelas:');
        
        const ordersCount = await db.get('SELECT COUNT(*) as count FROM orders');
        const sessionsCount = await db.get('SELECT COUNT(*) as count FROM user_sessions');
        const productsCount = await db.get('SELECT COUNT(*) as count FROM products');
        
        console.log(`   📋 Pedidos: ${ordersCount.count}`);
        console.log(`   👥 Sessões: ${sessionsCount.count}`);
        console.log(`   📱 Produtos: ${productsCount.count}`);
        
        // 3. Verificar produtos ativos
        console.log('\n📱 Produtos ativos:');
        const activeProducts = await db.all('SELECT * FROM products WHERE active = 1');
        activeProducts.forEach(product => {
            console.log(`   ✅ ${product.name} - R$ ${product.price} (${product.activation_module || 'sem módulo'})`);
        });
        
        // 4. Verificar últimas sessões
        console.log('\n👥 Últimas sessões:');
        const recentSessions = await db.all(`
            SELECT * FROM user_sessions 
            ORDER BY updated_at DESC 
            LIMIT 3
        `);
        
        recentSessions.forEach(session => {
            console.log(`   👤 ${session.chat_id.substring(0, 15)}...`);
            console.log(`      Estado: ${session.state || 'null'}`);
            console.log(`      Crédito: R$ ${session.available_credit || 0}`);
            console.log(`      Atualizado: ${session.updated_at}`);
        });
        
        // 5. Sugestões de correção
        console.log('\n💡 SUGESTÕES:');
        
        if (recentErrors.length > 0) {
            console.log('🔧 Para corrigir erros:');
            console.log('   1. Execute: node debug-activation-flow.js');
            console.log('   2. Reinicie o sistema: pm2 restart all');
            console.log('   3. Verifique logs: pm2 logs core-system');
        }
        
        // Verificar sessões problemáticas
        const problemSessions = await db.all(`
            SELECT COUNT(*) as count FROM user_sessions 
            WHERE state = 'awaiting_activation_info'
        `);
        
        if (problemSessions[0].count > 0) {
            console.log(`⚠️ ${problemSessions[0].count} sessões aguardando ativação`);
            console.log('   Execute: node debug-activation-flow.js clean');
        }
        
        console.log('\n═'.repeat(50));
        console.log('🏁 TESTE CONCLUÍDO');
        
    } catch (error) {
        console.error('❌ Erro no teste:', error);
    } finally {
        await db.close();
    }
}

// Executar teste
if (require.main === module) {
    quickTest();
}

module.exports = quickTest;
