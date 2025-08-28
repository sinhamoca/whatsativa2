// show-current-order.js - Mostra ordem atual dos produtos no menu
const DatabaseService = require('./database-service');

async function showCurrentOrder() {
    const db = new DatabaseService('./database.sqlite');
    
    try {
        console.log('📋 ORDEM ATUAL DOS PRODUTOS NO MENU');
        console.log('═'.repeat(60));
        
        await db.initialize();
        
        // Buscar produtos na mesma ordem que aparece no menu
        const products = await db.all('SELECT * FROM products WHERE active = 1 ORDER BY created_at DESC');
        
        console.log('📱 Como aparece no WhatsApp:\n');
        
        products.forEach((product, index) => {
            const number = index + 1;
            const price = parseFloat(product.price).toFixed(2);
            
            console.log(`*${number}.* ${product.name} ${price} R$`);
            console.log(`    ID: ${product.id}`);
            console.log(`    Módulo: ${product.activation_module}`);
            console.log(`    Criado: ${new Date(product.created_at).toLocaleDateString('pt-BR')}`);
            console.log('');
        });
        
        console.log('═'.repeat(60));
        console.log(`Total: ${products.length} produtos ativos`);
        
        await db.close();
        
        return products.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            created: p.created_at
        }));
        
    } catch (error) {
        console.error('❌ Erro:', error);
        await db.close();
    }
}

if (require.main === module) {
    showCurrentOrder();
}

module.exports = { showCurrentOrder };
