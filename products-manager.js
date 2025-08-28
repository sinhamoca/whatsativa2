// products-manager.js - Gerenciador de produtos via terminal
const DatabaseService = require('./database-service');
const readline = require('readline');

class ProductsManager {
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

    // Listar todos os produtos
    async listProducts() {
        try {
            const products = await this.db.getProducts();
            
            if (products.length === 0) {
                console.log('📭 Nenhum produto encontrado no banco de dados');
                return [];
            }

            console.log('\n📋 PRODUTOS CADASTRADOS:');
            console.log('═'.repeat(100));
            console.log('ID'.padEnd(20) + 'Nome'.padEnd(25) + 'Preço'.padEnd(12) + 'Status'.padEnd(10) + 'Módulo');
            console.log('─'.repeat(100));

            products.forEach((product, index) => {
                const status = product.active ? '✅ Ativo' : '❌ Inativo';
                const price = `R$ ${product.price.toFixed(2)}`;
                
                console.log(
                    `${(index + 1).toString().padEnd(3)}${product.id.padEnd(17)}` +
                    `${product.name.padEnd(25)}` +
                    `${price.padEnd(12)}` +
                    `${status.padEnd(10)}` +
                    `${product.activationModule}`
                );
            });

            console.log('═'.repeat(100));
            console.log(`📊 Total: ${products.length} produtos`);
            
            return products;
        } catch (error) {
            console.error('❌ Erro ao listar produtos:', error.message);
            return [];
        }
    }

    // Visualizar produto específico
    async viewProduct(productId) {
        try {
            const product = await this.db.getProduct(productId);
            
            if (!product) {
                console.log(`❌ Produto "${productId}" não encontrado`);
                return null;
            }

            console.log('\n📱 DETALHES DO PRODUTO:');
            console.log('═'.repeat(60));
            console.log(`🆔 ID: ${product.id}`);
            console.log(`📝 Nome: ${product.name}`);
            console.log(`📄 Descrição: ${product.description || 'N/A'}`);
            console.log(`💰 Preço: R$ ${product.price.toFixed(2)}`);
            console.log(`💱 Moeda: ${product.currency}`);
            console.log(`🔧 Módulo: ${product.activationModule}`);
            console.log(`📊 Status: ${product.active ? '✅ Ativo' : '❌ Inativo'}`);
            console.log(`📅 Criado em: ${new Date(product.createdAt).toLocaleString('pt-BR')}`);
            console.log(`🔄 Atualizado em: ${new Date(product.updatedAt).toLocaleString('pt-BR')}`);
            
            if (product.paymentConfirmedMessage) {
                console.log('\n💬 Mensagem personalizada:');
                console.log('─'.repeat(60));
                console.log(product.paymentConfirmedMessage);
                console.log('─'.repeat(60));
            }
            
            console.log('═'.repeat(60));
            
            return product;
        } catch (error) {
            console.error('❌ Erro ao visualizar produto:', error.message);
            return null;
        }
    }

    // Excluir produto
    async deleteProduct(productId) {
        try {
            // Primeiro verificar se existe
            const product = await this.db.getProduct(productId);
            if (!product) {
                console.log(`❌ Produto "${productId}" não encontrado`);
                return false;
            }

            // Mostrar detalhes antes de excluir
            console.log('\n⚠️ PRODUTO QUE SERÁ EXCLUÍDO:');
            console.log('─'.repeat(50));
            console.log(`📝 Nome: ${product.name}`);
            console.log(`💰 Preço: R$ ${product.price.toFixed(2)}`);
            console.log(`🔧 Módulo: ${product.activationModule}`);
            console.log('─'.repeat(50));

            // Confirmar exclusão
            const confirmed = await this.askConfirmation(
                `Tem certeza que deseja excluir o produto "${product.name}"? (s/N): `
            );

            if (!confirmed) {
                console.log('❌ Exclusão cancelada');
                return false;
            }

            // Excluir
            const deleted = await this.db.deleteProduct(productId);
            
            if (deleted) {
                console.log(`✅ Produto "${product.name}" excluído com sucesso!`);
                return true;
            } else {
                console.log('❌ Erro ao excluir produto');
                return false;
            }

        } catch (error) {
            console.error('❌ Erro ao excluir produto:', error.message);
            return false;
        }
    }

    // Excluir múltiplos produtos
    async deleteMultipleProducts(productIds) {
        let deletedCount = 0;
        let failedCount = 0;

        console.log(`\n🗑️ Excluindo ${productIds.length} produto(s)...`);
        
        for (const productId of productIds) {
            console.log(`\n─── Processando: ${productId} ───`);
            
            const success = await this.deleteProduct(productId);
            if (success) {
                deletedCount++;
            } else {
                failedCount++;
            }
        }

        console.log('\n📊 RESULTADO DA EXCLUSÃO:');
        console.log(`✅ Excluídos: ${deletedCount}`);
        console.log(`❌ Falharam: ${failedCount}`);
        console.log(`📋 Total processados: ${productIds.length}`);
    }

    // Excluir todos os produtos IboSol
    async deleteAllIboSolProducts() {
        try {
            const products = await this.db.getProducts();
            const iboSolProducts = products.filter(p => 
                p.activationModule.includes('ibo') || 
                p.activationModule.includes('bob') ||
                p.activationModule.includes('mac') ||
                p.name.toLowerCase().includes('player') ||
                p.name.toLowerCase().includes('ibo')
            );

            if (iboSolProducts.length === 0) {
                console.log('📭 Nenhum produto IboSol encontrado');
                return;
            }

            console.log(`\n🔍 PRODUTOS IBOSOL ENCONTRADOS (${iboSolProducts.length}):`);
            iboSolProducts.forEach((product, index) => {
                console.log(`${(index + 1).toString().padStart(2)}. ${product.name} (${product.id})`);
            });

            const confirmed = await this.askConfirmation(
                `\n⚠️ Excluir TODOS os ${iboSolProducts.length} produtos IboSol listados acima? (s/N): `
            );

            if (!confirmed) {
                console.log('❌ Exclusão cancelada');
                return;
            }

            const productIds = iboSolProducts.map(p => p.id);
            await this.deleteMultipleProducts(productIds);

        } catch (error) {
            console.error('❌ Erro ao excluir produtos IboSol:', error.message);
        }
    }

    // Perguntar confirmação
    askConfirmation(question) {
        return new Promise((resolve) => {
            this.rl.question(question, (answer) => {
                resolve(answer.toLowerCase().trim() === 's' || answer.toLowerCase().trim() === 'sim');
            });
        });
    }

    // Perguntar input
    askInput(question) {
        return new Promise((resolve) => {
            this.rl.question(question, (answer) => {
                resolve(answer.trim());
            });
        });
    }

    // Menu principal
    async showMenu() {
        console.log('\n🎯 GERENCIADOR DE PRODUTOS');
        console.log('═'.repeat(40));
        console.log('1. 📋 Listar todos os produtos');
        console.log('2. 👁️ Visualizar produto específico');
        console.log('3. 🗑️ Excluir produto específico');
        console.log('4. 🗑️ Excluir múltiplos produtos');
        console.log('5. 🧹 Excluir todos os produtos IboSol');
        console.log('6. 📊 Estatísticas');
        console.log('0. ❌ Sair');
        console.log('═'.repeat(40));

        const choice = await this.askInput('Escolha uma opção: ');
        return choice;
    }

    // Mostrar estatísticas
    async showStats() {
        try {
            const products = await this.db.getProducts();
            const stats = await this.db.getStats();
            
            const activeProducts = products.filter(p => p.active).length;
            const inactiveProducts = products.filter(p => !p.active).length;
            
            // Agrupar por módulo
            const moduleStats = {};
            products.forEach(product => {
                const module = product.activationModule;
                if (!moduleStats[module]) {
                    moduleStats[module] = { count: 0, totalPrice: 0 };
                }
                moduleStats[module].count++;
                moduleStats[module].totalPrice += product.price;
            });

            console.log('\n📊 ESTATÍSTICAS DOS PRODUTOS:');
            console.log('═'.repeat(60));
            console.log(`📦 Total de produtos: ${products.length}`);
            console.log(`✅ Produtos ativos: ${activeProducts}`);
            console.log(`❌ Produtos inativos: ${inactiveProducts}`);
            console.log(`💰 Valor médio: R$ ${products.length > 0 ? (products.reduce((sum, p) => sum + p.price, 0) / products.length).toFixed(2) : '0.00'}`);
            
            console.log('\n📋 ESTATÍSTICAS DO SISTEMA:');
            console.log(`📝 Total de pedidos: ${stats.totalOrders}`);
            console.log(`✅ Pedidos concluídos: ${stats.completedOrders}`);
            console.log(`⏳ Pedidos pendentes: ${stats.pendingOrders}`);
            console.log(`💵 Receita total: R$ ${stats.totalRevenue.toFixed(2)}`);
            
            if (Object.keys(moduleStats).length > 0) {
                console.log('\n🔧 PRODUTOS POR MÓDULO:');
                console.log('─'.repeat(60));
                Object.entries(moduleStats)
                    .sort(([,a], [,b]) => b.count - a.count)
                    .forEach(([module, data]) => {
                        console.log(`${module.padEnd(25)} ${data.count.toString().padStart(3)} produtos - R$ ${data.totalPrice.toFixed(2)}`);
                    });
            }
            
            console.log('═'.repeat(60));
            
        } catch (error) {
            console.error('❌ Erro ao obter estatísticas:', error.message);
        }
    }

    // Loop principal
    async run() {
        try {
            await this.initialize();
            console.log('🚀 Gerenciador de Produtos iniciado!');

            while (true) {
                const choice = await this.showMenu();

                switch (choice) {
                    case '1':
                        await this.listProducts();
                        break;

                    case '2':
                        const viewId = await this.askInput('Digite o ID do produto: ');
                        await this.viewProduct(viewId);
                        break;

                    case '3':
                        const deleteId = await this.askInput('Digite o ID do produto para excluir: ');
                        await this.deleteProduct(deleteId);
                        break;

                    case '4':
                        const multipleIds = await this.askInput('Digite os IDs separados por vírgula: ');
                        const ids = multipleIds.split(',').map(id => id.trim()).filter(id => id);
                        if (ids.length > 0) {
                            await this.deleteMultipleProducts(ids);
                        } else {
                            console.log('❌ Nenhum ID válido fornecido');
                        }
                        break;

                    case '5':
                        await this.deleteAllIboSolProducts();
                        break;

                    case '6':
                        await this.showStats();
                        break;

                    case '0':
                        console.log('👋 Encerrando...');
                        await this.close();
                        return;

                    default:
                        console.log('❌ Opção inválida!');
                }

                // Pausa antes de mostrar menu novamente
                await this.askInput('\nPressione Enter para continuar...');
            }

        } catch (error) {
            console.error('❌ Erro fatal:', error.message);
            await this.close();
            process.exit(1);
        }
    }
}

// Funções de conveniência para uso direto
async function listAllProducts() {
    const manager = new ProductsManager();
    await manager.initialize();
    const products = await manager.listProducts();
    await manager.close();
    return products;
}

async function deleteProductById(productId) {
    const manager = new ProductsManager();
    await manager.initialize();
    const success = await manager.deleteProduct(productId);
    await manager.close();
    return success;
}

async function quickStats() {
    const manager = new ProductsManager();
    await manager.initialize();
    await manager.showStats();
    await manager.close();
}

// Executar se chamado diretamente
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        // Modo interativo
        const manager = new ProductsManager();
        manager.run().catch(console.error);
    } else {
        // Modo comando direto
        const command = args[0];
        
        switch (command) {
            case 'list':
                listAllProducts().catch(console.error);
                break;
                
            case 'delete':
                if (args[1]) {
                    deleteProductById(args[1]).then(success => {
                        process.exit(success ? 0 : 1);
                    }).catch(console.error);
                } else {
                    console.log('❌ Uso: node products-manager.js delete <product_id>');
                    process.exit(1);
                }
                break;
                
            case 'stats':
                quickStats().catch(console.error);
                break;
                
            default:
                console.log('❌ Comandos disponíveis:');
                console.log('  node products-manager.js          # Modo interativo');
                console.log('  node products-manager.js list     # Listar produtos');
                console.log('  node products-manager.js delete <id>  # Excluir produto');
                console.log('  node products-manager.js stats    # Mostrar estatísticas');
                process.exit(1);
        }
    }
}

module.exports = {
    ProductsManager,
    listAllProducts,
    deleteProductById,
    quickStats
};
