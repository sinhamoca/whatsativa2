// debug-db.js - Script para verificar estado do banco
const DatabaseService = require('./database-service');

async function debugDatabase() {
    const db = new DatabaseService('./database.sqlite');
    
    try {
        console.log('🔍 Iniciando debug do banco...');
        
        await db.initialize();
        
        console.log('\n📊 ESTATÍSTICAS:');
        const stats = await db.getStats();
        console.log(stats);
        
        console.log('\n📱 PRODUTOS:');
        const products = await db.getProducts();
        console.log(`Total: ${products.length}`);
        products.forEach(p => console.log(`- ${p.id}: ${p.name} (R$ ${p.price})`));
        
        console.log('\n💬 MENSAGENS:');
        const messages = await db.getMessages();
        console.log(`Total: ${Object.keys(messages).length}`);
        Object.keys(messages).forEach(type => console.log(`- ${type}`));
        
        console.log('\n📋 PEDIDOS RECENTES:');
        const orders = await db.getOrders(5);
        console.log(`Total: ${orders.length}`);
        orders.forEach(order => {
            console.log(`- ${order.id.substring(0, 8)}: ${order.status} - ${order.product.name}`);
            console.log(`  Chat: ${order.chatId}`);
            console.log(`  Criado: ${order.createdAt}`);
            if (order.paymentId) console.log(`  PaymentID: ${order.paymentId}`);
            console.log();
        });
        
        console.log('\n👥 SESSÕES ATIVAS:');
        // Verificar algumas sessões de exemplo
        const testChatId = '558594021963@s.whatsapp.net';
        const session = await db.getUserSession(testChatId);
        console.log(`Sessão ${testChatId}:`, session);
        
        console.log('\n⚙️ CONFIGURAÇÕES:');
        const settings = await db.getSettings();
        console.log('Chaves configuradas:', Object.keys(settings));
        
        await db.close();
        console.log('\n✅ Debug concluído!');
        
    } catch (error) {
        console.error('❌ Erro no debug:', error);
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    debugDatabase();
}

module.exports = debugDatabase;
