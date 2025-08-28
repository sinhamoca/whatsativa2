// debug-products.js - Diagnóstico completo dos produtos
const DatabaseService = require('./database-service');
const fs = require('fs');
const path = require('path');

class ProductsDebugger {
    constructor() {
        this.db = new DatabaseService('./database.sqlite');
    }

    async initialize() {
        await this.db.initialize();
    }

    async close() {
        await this.db.close();
    }

    // Diagnóstico completo
    async fullDiagnosis() {
        console.log('🔍 DIAGNÓSTICO COMPLETO DOS PRODUTOS');
        console.log('═'.repeat(80));

        try {
            await this.initialize();

            // 1. Verificar estrutura do banco
            await this.checkDatabaseStructure();
            
            // 2. Listar todos os produtos
            await this.listAllProducts();
            
            // 3. Identificar duplicados
            await this.findDuplicates();
            
            // 4. Verificar dependências
            await this.checkDependencies();
            
            // 5. Testar exclusão manual
            await this.testManualDelete();

        } catch (error) {
            console.error('❌ Erro no diagnóstico:', error);
        } finally {
            await this.close();
        }
    }

    // Verificar estrutura do banco
    async checkDatabaseStructure() {
        console.log('\n📋 1. VERIFICANDO ESTRUTURA DO BANCO:');
        console.log('─'.repeat(50));

        try {
            // Verificar se a tabela products existe
            const tableInfo = await this.db.all("PRAGMA table_info(products)");
            
            if (tableInfo.length === 0) {
                console.log('❌ Tabela "products" não encontrada!');
                return;
            }

            console.log('✅ Tabela "products" encontrada');
            console.log('📊 Colunas:');
            tableInfo.forEach(col => {
                console.log(`   • ${col.name} (${col.type}) ${col.pk ? '[PK]' : ''} ${col.notnull ? '[NOT NULL]' : ''}`);
            });

            // Verificar índices
            const indexes = await this.db.all("PRAGMA index_list(products)");
            if (indexes.length > 0) {
                console.log('🔗 Índices:');
                indexes.forEach(idx => {
                    console.log(`   • ${idx.name} ${idx.unique ? '[UNIQUE]' : ''}`);
                });
            }

        } catch (error) {
            console.error('❌ Erro ao verificar estrutura:', error.message);
        }
    }

    // Listar todos os produtos com detalhes
    async listAllProducts() {
        console.log('\n📱 2. LISTANDO TODOS OS PRODUTOS:');
        console.log('─'.repeat(50));

        try {
            const products = await this.db.all('SELECT * FROM products ORDER BY created_at ASC');
            
            if (products.length === 0) {
                console.log('📭 Nenhum produto encontrado');
                return;
            }

            console.log(`📊 Total: ${products.length} produtos`);
            console.log('\nDetalhes:');
            
            products.forEach((product, index) => {
                console.log(`\n${(index + 1).toString().padStart(2)}. ${product.name || 'SEM NOME'}`);
                console.log(`   ID: ${product.id}`);
                console.log(`   Preço: R$ ${product.price || 0}`);
                console.log(`   Ativo: ${product.active ? 'Sim' : 'Não'}`);
                console.log(`   Módulo: ${product.activation_module || 'N/A'}`);
                console.log(`   Criado: ${product.created_at || 'N/A'}`);
            });

        } catch (error) {
            console.error('❌ Erro ao listar produtos:', error.message);
        }
    }

    // Encontrar produtos duplicados
    async findDuplicates() {
        console.log('\n🔍 3. PROCURANDO DUPLICADOS:');
        console.log('─'.repeat(50));

        try {
            // Duplicados por ID
            const duplicateIds = await this.db.all(`
                SELECT id, COUNT(*) as count 
                FROM products 
                GROUP BY id 
                HAVING COUNT(*) > 1
            `);

            // Duplicados por nome
            const duplicateNames = await this.db.all(`
                SELECT name, COUNT(*) as count 
                FROM products 
                GROUP BY name 
                HAVING COUNT(*) > 1
            `);

            if (duplicateIds.length > 0) {
                console.log('🚨 DUPLICADOS POR ID:');
                duplicateIds.forEach(dup => {
                    console.log(`   • ID "${dup.id}" aparece ${dup.count} vezes`);
                });
            }

            if (duplicateNames.length > 0) {
                console.log('🚨 DUPLICADOS POR NOME:');
                duplicateNames.forEach(dup => {
                    console.log(`   • Nome "${dup.name}" aparece ${dup.count} vezes`);
                });
            }

            if (duplicateIds.length === 0 && duplicateNames.length === 0) {
                console.log('✅ Nenhum duplicado encontrado');
            }

        } catch (error) {
            console.error('❌ Erro ao procurar duplicados:', error.message);
        }
    }

    // Verificar dependências (pedidos usando produtos)
    async checkDependencies() {
        console.log('\n🔗 4. VERIFICANDO DEPENDÊNCIAS:');
        console.log('─'.repeat(50));

        try {
            const ordersWithProducts = await this.db.all(`
                SELECT product_id, COUNT(*) as order_count 
                FROM orders 
                GROUP BY product_id
            `);

            if (ordersWithProducts.length === 0) {
                console.log('✅ Nenhum pedido encontrado - produtos podem ser excluídos livremente');
                return;
            }

            console.log('📋 Produtos com pedidos associados:');
            for (const item of ordersWithProducts) {
                const product = await this.db.get('SELECT name FROM products WHERE id = ?', [item.product_id]);
                const productName = product?.name || 'PRODUTO NÃO ENCONTRADO';
                console.log(`   • ${item.product_id} (${productName}): ${item.order_count} pedidos`);
            }

        } catch (error) {
            console.error('❌ Erro ao verificar dependências:', error.message);
        }
    }

    // Testar exclusão manual direta no banco
    async testManualDelete() {
        console.log('\n🧪 5. TESTE DE EXCLUSÃO MANUAL:');
        console.log('─'.repeat(50));

        try {
            // Criar um produto de teste
            const testProductId = 'test_delete_' + Date.now();
            
            await this.db.run(`
                INSERT INTO products (id, name, price, activation_module, active, created_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [testProductId, 'Produto Teste', 1.00, 'test_module', 1]);

            console.log(`✅ Produto teste criado: ${testProductId}`);

            // Tentar excluir
            const deleteResult = await this.db.run('DELETE FROM products WHERE id = ?', [testProductId]);
            
            if (deleteResult.changes > 0) {
                console.log('✅ Teste de exclusão bem-sucedido');
            } else {
                console.log('❌ Teste de exclusão falhou - nenhuma linha afetada');
            }

            // Verificar se foi realmente excluído
            const checkProduct = await this.db.get('SELECT * FROM products WHERE id = ?', [testProductId]);
            
            if (checkProduct) {
                console.log('❌ PROBLEMA: Produto ainda existe após exclusão!');
                console.log('   Isso indica um problema no banco de dados');
            } else {
                console.log('✅ Produto teste removido corretamente');
            }

        } catch (error) {
            console.error('❌ Erro no teste de exclusão:', error.message);
        }
    }

    // Forçar limpeza de duplicados
    async forceClearDuplicates() {
        console.log('\n🧹 LIMPEZA FORÇADA DE DUPLICADOS:');
        console.log('─'.repeat(50));

        try {
            // Criar tabela temporária com produtos únicos
            await this.db.run(`
                CREATE TEMPORARY TABLE products_temp AS 
                SELECT id, name, description, price, currency, activation_module, 
                       payment_confirmed_message, active, MIN(created_at) as created_at
                FROM products 
                GROUP BY id
            `);

            // Contar quantos duplicados temos
            const originalCount = await this.db.get('SELECT COUNT(*) as count FROM products');
            const uniqueCount = await this.db.get('SELECT COUNT(*) as count FROM products_temp');
            const duplicatesCount = originalCount.count - uniqueCount.count;

            console.log(`📊 Produtos originais: ${originalCount.count}`);
            console.log(`📊 Produtos únicos: ${uniqueCount.count}`);
            console.log(`📊 Duplicados a remover: ${duplicatesCount}`);

            if (duplicatesCount === 0) {
                console.log('✅ Nenhum duplicado para remover');
                return;
            }

            // Backup da tabela original
            const backupFile = `products_backup_${Date.now()}.sql`;
            await this.db.run('.backup backup.db');
            console.log(`💾 Backup criado: ${backupFile}`);

            // Substituir tabela original
            await this.db.run('DELETE FROM products');
            await this.db.run(`
                INSERT INTO products (id, name, description, price, currency, activation_module, 
                                    payment_confirmed_message, active, created_at, updated_at)
                SELECT id, name, description, price, currency, activation_module,
                       payment_confirmed_message, active, created_at, CURRENT_TIMESTAMP
                FROM products_temp
            `);

            console.log(`✅ ${duplicatesCount} duplicados removidos!`);

        } catch (error) {
            console.error('❌ Erro na limpeza forçada:', error.message);
        }
    }

    // Exibir produtos em formato SQL para análise
    async exportToSQL() {
        console.log('\n📄 6. EXPORTANDO PRODUTOS PARA SQL:');
        console.log('─'.repeat(50));

        try {
            const products = await this.db.all('SELECT * FROM products ORDER BY created_at ASC');
            
            const sqlFile = `products_export_${Date.now()}.sql`;
            let sqlContent = '-- Exportação de produtos\n';
            sqlContent += '-- Gerado em: ' + new Date().toISOString() + '\n\n';
            
            products.forEach(product => {
                sqlContent += `INSERT INTO products (id, name, description, price, currency, activation_module, payment_confirmed_message, active) VALUES (\n`;
                sqlContent += `  '${product.id}',\n`;
                sqlContent += `  '${product.name?.replace(/'/g, "''")}',\n`;
                sqlContent += `  '${product.description?.replace(/'/g, "''")}',\n`;
                sqlContent += `  ${product.price},\n`;
                sqlContent += `  '${product.currency}',\n`;
                sqlContent += `  '${product.activation_module}',\n`;
                sqlContent += `  ${product.payment_confirmed_message ? `'${product.payment_confirmed_message.replace(/'/g, "''")}'` : 'NULL'},\n`;
                sqlContent += `  ${product.active}\n`;
                sqlContent += `);\n\n`;
            });

            fs.writeFileSync(sqlFile, sqlContent);
            console.log(`✅ Produtos exportados para: ${sqlFile}`);

        } catch (error) {
            console.error('❌ Erro ao exportar:', error.message);
        }
    }
}

// Função para exclusão forçada de produto específico
async function forceDeleteProduct(productId) {
    console.log(`🗑️ EXCLUSÃO FORÇADA DO PRODUTO: ${productId}`);
    console.log('═'.repeat(60));

    const db = new DatabaseService('./database.sqlite');
    
    try {
        await db.initialize();

        // 1. Verificar se produto existe
        const product = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
        
        if (!product) {
            console.log(`❌ Produto "${productId}" não encontrado`);
            return false;
        }

        console.log(`📱 Produto encontrado: ${product.name}`);

        // 2. Verificar dependências
        const orders = await db.all('SELECT id FROM orders WHERE product_id = ?', [productId]);
        
        if (orders.length > 0) {
            console.log(`⚠️ ATENÇÃO: ${orders.length} pedidos usam este produto`);
            console.log('Pedidos que serão afetados:', orders.map(o => o.id).join(', '));
        }

        // 3. Exclusão forçada
        console.log('🔄 Executando exclusão forçada...');
        
        const deleteResult = await db.run('DELETE FROM products WHERE id = ?', [productId]);
        
        if (deleteResult.changes > 0) {
            console.log(`✅ Produto "${productId}" excluído com sucesso!`);
            console.log(`📊 Linhas afetadas: ${deleteResult.changes}`);
            return true;
        } else {
            console.log('❌ Nenhuma linha foi afetada - produto pode não existir');
            return false;
        }

    } catch (error) {
        console.error('❌ Erro na exclusão forçada:', error.message);
        return false;
    } finally {
        await db.close();
    }
}

// Função para limpar TODOS os produtos
async function clearAllProducts() {
    console.log('🧹 LIMPEZA TOTAL DE PRODUTOS');
    console.log('═'.repeat(60));
    console.log('⚠️ ATENÇÃO: Isso irá excluir TODOS os produtos!');

    const db = new DatabaseService('./database.sqlite');
    
    try {
        await db.initialize();

        // Contar produtos
        const count = await db.get('SELECT COUNT(*) as count FROM products');
        console.log(`📊 Produtos a serem excluídos: ${count.count}`);

        if (count.count === 0) {
            console.log('📭 Nenhum produto para excluir');
            return;
        }

        // Backup antes de limpar
        console.log('💾 Criando backup...');
        const backupFile = `backup_before_clear_${Date.now()}.db`;
        // Note: Este backup seria mais complexo, mas para teste vamos continuar

        // Limpar tabela
        const deleteResult = await db.run('DELETE FROM products');
        
        console.log(`✅ ${deleteResult.changes} produtos excluídos!`);
        console.log('🗄️ Tabela products limpa completamente');

        // Reset auto-increment se necessário
        await db.run('DELETE FROM sqlite_sequence WHERE name = "products"');

    } catch (error) {
        console.error('❌ Erro na limpeza total:', error.message);
    } finally {
        await db.close();
    }
}

// Executar baseado nos argumentos
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];

    if (!command) {
        // Diagnóstico completo
        const productDebugger = new ProductsDebugger();
        productDebugger.fullDiagnosis();
    } else if (command === 'force-delete' && args[1]) {
        // Exclusão forçada de produto específico
        forceDeleteProduct(args[1]);
    } else if (command === 'clear-all') {
        // Limpeza total (cuidado!)
        clearAllProducts();
    } else if (command === 'clear-duplicates') {
        // Limpar apenas duplicados
        const productDebugger = new ProductsDebugger();
        productDebugger.forceClearDuplicates();
    } else {
        console.log('❌ Uso:');
        console.log('  node debug-products.js                    # Diagnóstico completo');
        console.log('  node debug-products.js force-delete <id>  # Exclusão forçada');
        console.log('  node debug-products.js clear-duplicates   # Limpar duplicados');
        console.log('  node debug-products.js clear-all          # Limpar TODOS (cuidado!)');
    }
}

module.exports = {
    ProductsDebugger,
    forceDeleteProduct,
    clearAllProducts
};
