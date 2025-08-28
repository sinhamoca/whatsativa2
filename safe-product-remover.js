// safe-product-remover.js - Remove produtos respeitando constraints
const DatabaseService = require('./database-service');
const readline = require('readline');

class SafeProductRemover {
    constructor() {
        this.db = new DatabaseService('./database.sqlite');
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async initialize() {
        await this.db.initialize();
    }

    async close() {
        this.rl.close();
        await this.db.close();
    }

    // Perguntar confirmação
    askConfirmation(question) {
        return new Promise((resolve) => {
            this.rl.question(question, (answer) => {
                resolve(answer.toLowerCase().trim() === 's' || answer.toLowerCase().trim() === 'sim');
            });
        });
    }

    // Analisar dependências de um produto
    async analyzeProductDependencies(productId) {
        try {
            console.log(`\n🔍 ANALISANDO DEPENDÊNCIAS: ${productId}`);
            console.log('═'.repeat(60));

            // Buscar produto
            const product = await this.db.get('SELECT * FROM products WHERE id = ?', [productId]);
            if (!product) {
                console.log(`❌ Produto "${productId}" não encontrado`);
                return null;
            }

            console.log(`📱 Produto: ${product.name}`);
            console.log(`💰 Preço: R$ ${product.price}`);
            console.log(`🔧 Módulo: ${product.activation_module}`);

            // Buscar pedidos relacionados
            const orders = await this.db.all(`
                SELECT id, status, created_at, paid_at, completed_at 
                FROM orders 
                WHERE product_id = ? 
                ORDER BY created_at DESC
            `, [productId]);

            console.log(`\n📋 PEDIDOS RELACIONADOS: ${orders.length}`);
            
            if (orders.length === 0) {
                console.log('✅ Nenhum pedido encontrado - produto pode ser excluído livremente');
                return { product, orders: [] };
            }

            // Agrupar pedidos por status
            const statusGroups = {};
            orders.forEach(order => {
                if (!statusGroups[order.status]) {
                    statusGroups[order.status] = [];
                }
                statusGroups[order.status].push(order);
            });

            console.log('\n📊 Pedidos por status:');
            Object.entries(statusGroups).forEach(([status, orderList]) => {
                console.log(`   ${status}: ${orderList.length} pedidos`);
            });

            console.log('\n📝 Detalhes dos pedidos:');
            orders.slice(0, 10).forEach((order, index) => {
                const date = new Date(order.created_at).toLocaleDateString('pt-BR');
                console.log(`   ${index + 1}. ${order.id.substring(0, 8)}... (${order.status}) - ${date}`);
            });

            if (orders.length > 10) {
                console.log(`   ... e mais ${orders.length - 10} pedidos`);
            }

            return { product, orders };

        } catch (error) {
            console.error('❌ Erro ao analisar dependências:', error.message);
            return null;
        }
    }

    // Opção 1: Remover produto e pedidos relacionados
    async removeProductWithOrders(productId) {
        try {
            const analysis = await this.analyzeProductDependencies(productId);
            if (!analysis) return false;

            const { product, orders } = analysis;

            if (orders.length === 0) {
                // Sem dependências, exclusão simples
                return await this.simpleProductDelete(productId);
            }

            console.log(`\n⚠️ ATENÇÃO: Isso irá excluir o produto E todos os ${orders.length} pedidos relacionados!`);
            console.log('🗑️ DADOS QUE SERÃO PERDIDOS:');
            console.log(`   • 1 produto: ${product.name}`);
            console.log(`   • ${orders.length} pedidos com histórico de pagamentos`);
            console.log(`   • Dados de ativação dos clientes`);

            const confirmed = await this.askConfirmation('\nTem certeza? Esta ação é IRREVERSÍVEL! (s/N): ');
            if (!confirmed) {
                console.log('❌ Operação cancelada');
                return false;
            }

            // Desabilitar foreign keys temporariamente
            await this.db.run('PRAGMA foreign_keys = OFF');

            console.log('\n🔄 Iniciando remoção...');

            // 1. Excluir pedidos primeiro
            console.log(`🗑️ Excluindo ${orders.length} pedidos...`);
            const deleteOrdersResult = await this.db.run('DELETE FROM orders WHERE product_id = ?', [productId]);
            console.log(`✅ ${deleteOrdersResult.changes} pedidos excluídos`);

            // 2. Excluir produto
            console.log('🗑️ Excluindo produto...');
            const deleteProductResult = await this.db.run('DELETE FROM products WHERE id = ?', [productId]);
            console.log(`✅ Produto excluído (${deleteProductResult.changes} linha afetada)`);

            // 3. Limpar sessões de usuário relacionadas (se existirem)
            const clearSessionsResult = await this.db.run(`
                UPDATE user_sessions 
                SET current_order_id = NULL, state = NULL 
                WHERE current_order_id IN (
                    SELECT id FROM orders WHERE product_id = ?
                )
            `, [productId]);
            
            if (clearSessionsResult.changes > 0) {
                console.log(`🧹 ${clearSessionsResult.changes} sessões de usuário limpas`);
            }

            // Reabilitar foreign keys
            await this.db.run('PRAGMA foreign_keys = ON');

            console.log('\n🎉 REMOÇÃO COMPLETA CONCLUÍDA!');
            console.log(`✅ Produto "${product.name}" e todos os dados relacionados foram excluídos`);

            return true;

        } catch (error) {
            console.error('❌ Erro na remoção completa:', error.message);
            // Reabilitar foreign keys em caso de erro
            await this.db.run('PRAGMA foreign_keys = ON');
            return false;
        }
    }

    // Opção 2: Manter pedidos mas "orfanar" eles
    async orphanProductOrders(productId) {
        try {
            const analysis = await this.analyzeProductDependencies(productId);
            if (!analysis) return false;

            const { product, orders } = analysis;

            if (orders.length === 0) {
                return await this.simpleProductDelete(productId);
            }

            console.log(`\n📋 ESTRATÉGIA: Manter pedidos mas remover produto`);
            console.log(`Os ${orders.length} pedidos ficarão órfãos (sem produto associado)`);
            console.log('Isso pode causar problemas no sistema, mas preserva o histórico');

            const confirmed = await this.askConfirmation('\nContinuar com esta estratégia? (s/N): ');
            if (!confirmed) {
                console.log('❌ Operação cancelada');
                return false;
            }

            // Desabilitar foreign keys
            await this.db.run('PRAGMA foreign_keys = OFF');

            console.log('\n🔄 Removendo produto (mantendo pedidos)...');

            // Excluir apenas o produto
            const deleteResult = await this.db.run('DELETE FROM products WHERE id = ?', [productId]);
            
            // Reabilitar foreign keys
            await this.db.run('PRAGMA foreign_keys = ON');

            if (deleteResult.changes > 0) {
                console.log(`✅ Produto "${product.name}" excluído`);
                console.log(`📋 ${orders.length} pedidos mantidos (órfãos)`);
                console.log('⚠️ ATENÇÃO: Pedidos órfãos podem causar problemas no sistema');
                return true;
            } else {
                console.log('❌ Falha na exclusão');
                return false;
            }

        } catch (error) {
            console.error('❌ Erro ao orfanar pedidos:', error.message);
            await this.db.run('PRAGMA foreign_keys = ON');
            return false;
        }
    }

    // Exclusão simples (sem dependências)
    async simpleProductDelete(productId) {
        try {
            const deleteResult = await this.db.run('DELETE FROM products WHERE id = ?', [productId]);
            
            if (deleteResult.changes > 0) {
                console.log(`✅ Produto "${productId}" excluído com sucesso!`);
                return true;
            } else {
                console.log('❌ Produto não encontrado ou não pôde ser excluído');
                return false;
            }

        } catch (error) {
            console.error('❌ Erro na exclusão simples:', error.message);
            return false;
        }
    }

    // Migrar pedidos para outro produto
    async migrateOrdersToAnotherProduct(fromProductId, toProductId) {
        try {
            console.log(`\n🔄 MIGRANDO PEDIDOS: ${fromProductId} → ${toProductId}`);
            console.log('═'.repeat(60));

            // Verificar produtos
            const fromProduct = await this.db.get('SELECT * FROM products WHERE id = ?', [fromProductId]);
            const toProduct = await this.db.get('SELECT * FROM products WHERE id = ?', [toProductId]);

            if (!fromProduct) {
                console.log(`❌ Produto origem "${fromProductId}" não encontrado`);
                return false;
            }

            if (!toProduct) {
                console.log(`❌ Produto destino "${toProductId}" não encontrado`);
                return false;
            }

            console.log(`📤 De: ${fromProduct.name}`);
            console.log(`📥 Para: ${toProduct.name}`);

            // Contar pedidos a migrar
            const ordersCount = await this.db.get('SELECT COUNT(*) as count FROM orders WHERE product_id = ?', [fromProductId]);
            
            if (ordersCount.count === 0) {
                console.log('📭 Nenhum pedido para migrar');
                return await this.simpleProductDelete(fromProductId);
            }

            console.log(`📋 ${ordersCount.count} pedidos serão migrados`);

            const confirmed = await this.askConfirmation('Continuar com a migração? (s/N): ');
            if (!confirmed) {
                console.log('❌ Migração cancelada');
                return false;
            }

            // Migrar pedidos
            const migrateResult = await this.db.run(`
                UPDATE orders 
                SET product_id = ?, 
                    product_data = ?
                WHERE product_id = ?
            `, [toProductId, JSON.stringify(toProduct), fromProductId]);

            console.log(`✅ ${migrateResult.changes} pedidos migrados`);

            // Agora excluir produto original
            const deleteResult = await this.db.run('DELETE FROM products WHERE id = ?', [fromProductId]);
            
            if (deleteResult.changes > 0) {
                console.log(`✅ Produto "${fromProduct.name}" excluído após migração`);
                return true;
            } else {
                console.log('⚠️ Pedidos migrados, mas falha ao excluir produto original');
                return false;
            }

        } catch (error) {
            console.error('❌ Erro na migração:', error.message);
            return false;
        }
    }

    // Limpar produtos duplicados preservando pedidos
    async cleanDuplicates() {
        try {
            console.log('\n🧹 LIMPEZA DE PRODUTOS DUPLICADOS');
            console.log('═'.repeat(60));

            // Buscar duplicados por nome
            const duplicates = await this.db.all(`
                SELECT name, COUNT(*) as count, GROUP_CONCAT(id) as ids
                FROM products 
                GROUP BY name 
                HAVING COUNT(*) > 1
            `);

            if (duplicates.length === 0) {
                console.log('✅ Nenhum duplicado encontrado');
                return;
            }

            console.log(`🔍 Encontrados ${duplicates.length} grupos de duplicados:`);
            
            for (const dup of duplicates) {
                console.log(`\n📱 ${dup.name} (${dup.count} cópias)`);
                const ids = dup.ids.split(',');
                
                // Para cada grupo, manter o primeiro e migrar pedidos dos outros
                const keepId = ids[0];
                const removeIds = ids.slice(1);
                
                console.log(`   ✅ Manter: ${keepId}`);
                console.log(`   🗑️ Remover: ${removeIds.join(', ')}`);
                
                // Migrar pedidos dos duplicados para o primeiro
                for (const removeId of removeIds) {
                    const ordersCount = await this.db.get('SELECT COUNT(*) as count FROM orders WHERE product_id = ?', [removeId]);
                    
                    if (ordersCount.count > 0) {
                        console.log(`   🔄 Migrando ${ordersCount.count} pedidos de ${removeId} para ${keepId}`);
                        await this.db.run('UPDATE orders SET product_id = ? WHERE product_id = ?', [keepId, removeId]);
                    }
                    
                    // Excluir duplicado
                    await this.db.run('DELETE FROM products WHERE id = ?', [removeId]);
                    console.log(`   ✅ ${removeId} excluído`);
                }
            }

            console.log('\n🎉 Limpeza de duplicados concluída!');

        } catch (error) {
            console.error('❌ Erro na limpeza de duplicados:', error.message);
        }
    }
}

// Funções de conveniência
async function removeProductSafely(productId, strategy = 'analyze') {
    const remover = new SafeProductRemover();
    await remover.initialize();
    
    try {
        switch (strategy) {
            case 'analyze':
                await remover.analyzeProductDependencies(productId);
                break;
            case 'remove-all':
                await remover.removeProductWithOrders(productId);
                break;
            case 'orphan':
                await remover.orphanProductOrders(productId);
                break;
            default:
                console.log('❌ Estratégia inválida. Use: analyze, remove-all, orphan');
        }
    } finally {
        await remover.close();
    }
}

// Executar
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    const productId = args[1];

    if (command === 'analyze' && productId) {
        removeProductSafely(productId, 'analyze');
    } else if (command === 'remove-all' && productId) {
        removeProductSafely(productId, 'remove-all');
    } else if (command === 'orphan' && productId) {
        removeProductSafely(productId, 'orphan');
    } else if (command === 'clean-duplicates') {
        const remover = new SafeProductRemover();
        remover.initialize().then(() => remover.cleanDuplicates()).finally(() => remover.close());
    } else if (command === 'migrate' && args[2]) {
        const remover = new SafeProductRemover();
        remover.initialize()
            .then(() => remover.migrateOrdersToAnotherProduct(productId, args[2]))
            .finally(() => remover.close());
    } else {
        console.log('🗑️ REMOVEDOR SEGURO DE PRODUTOS');
        console.log('═'.repeat(50));
        console.log('Uso:');
        console.log('  node safe-product-remover.js analyze <product_id>');
        console.log('  node safe-product-remover.js remove-all <product_id>');
        console.log('  node safe-product-remover.js orphan <product_id>');
        console.log('  node safe-product-remover.js migrate <from_id> <to_id>');
        console.log('  node safe-product-remover.js clean-duplicates');
        console.log('');
        console.log('Estratégias:');
        console.log('  analyze     - Apenas analisa dependências');
        console.log('  remove-all  - Remove produto E pedidos');
        console.log('  orphan      - Remove produto mas mantém pedidos');
        console.log('  migrate     - Migra pedidos para outro produto');
        console.log('  clean-duplicates - Remove duplicados preservando pedidos');
    }
}

module.exports = {
    SafeProductRemover,
    removeProductSafely
};
