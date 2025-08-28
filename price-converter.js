// price-converter.js - Utilitário para Alterar Preços de Todos os Produtos
const DatabaseService = require('./database-service');
const fs = require('fs');
const path = require('path');

class PriceConverter {
    constructor() {
        this.db = new DatabaseService('./database.sqlite');
        this.backupDir = path.join(__dirname, 'backups');
    }

    async initialize() {
        await this.db.initialize();
        
        // Criar diretório de backup se não existir
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    async close() {
        await this.db.close();
    }

    /**
     * Criar backup do banco antes das modificações
     */
    async createBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `database-backup-prices-${timestamp}.sqlite`;
            const backupPath = path.join(this.backupDir, backupFileName);
            
            // Copiar arquivo do banco
            fs.copyFileSync('./database.sqlite', backupPath);
            
            console.log(`✅ Backup criado: ${backupFileName}`);
            console.log(`📁 Local: ${backupPath}`);
            
            return backupPath;
            
        } catch (error) {
            console.error('❌ Erro ao criar backup:', error.message);
            throw error;
        }
    }

    /**
     * Listar todos os produtos com seus preços atuais
     */
    async listCurrentPrices() {
        try {
            const products = await this.db.getProducts();
            
            console.log(`\n📱 PRODUTOS ENCONTRADOS: ${products.length}`);
            console.log('═'.repeat(80));
            
            if (products.length === 0) {
                console.log('❌ Nenhum produto encontrado.');
                return [];
            }
            
            let totalValue = 0;
            
            products.forEach((product, index) => {
                console.log(`\n${index + 1}. 🎯 ${product.name.toUpperCase()}`);
                console.log('─'.repeat(50));
                console.log(`📋 ID: ${product.id}`);
                console.log(`💰 Preço Atual: R$ ${product.price.toFixed(2)}`);
                console.log(`⚙️ Módulo: ${product.activationModule}`);
                console.log(`🔧 Status: ${product.active ? 'ATIVO' : 'INATIVO'}`);
                
                totalValue += product.price;
            });
            
            console.log(`\n💵 VALOR TOTAL ATUAL: R$ ${totalValue.toFixed(2)}`);
            console.log(`📊 PREÇO MÉDIO: R$ ${(totalValue / products.length).toFixed(2)}`);
            
            return products;
            
        } catch (error) {
            console.error('❌ Erro ao listar preços:', error.message);
            return [];
        }
    }

    /**
     * Alterar preço de um produto específico
     */
    async updateSinglePrice(productId, newPrice) {
        try {
            const product = await this.db.getProduct(productId);
            
            if (!product) {
                console.log(`❌ Produto ${productId} não encontrado.`);
                return false;
            }
            
            const oldPrice = product.price;
            
            // Atualizar preço no banco
            await this.db.run(
                'UPDATE products SET price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newPrice, productId]
            );
            
            console.log(`✅ ${product.name}: R$ ${oldPrice.toFixed(2)} → R$ ${newPrice.toFixed(2)}`);
            
            return {
                productId: productId,
                productName: product.name,
                oldPrice: oldPrice,
                newPrice: newPrice,
                updatedAt: new Date().toISOString()
            };
            
        } catch (error) {
            console.error(`❌ Erro ao atualizar preço do produto ${productId}:`, error.message);
            return false;
        }
    }

    /**
     * Alterar preços de todos os produtos para um valor fixo
     */
    async setAllPricesToFixed(newPrice, createBackup = true) {
        try {
            console.log('\n🔄 ALTERANDO TODOS OS PREÇOS PARA VALOR FIXO');
            console.log('═'.repeat(60));
            
            // Validar preço
            if (isNaN(newPrice) || newPrice < 0) {
                console.log('❌ Preço inválido. Use um valor numérico positivo.');
                return null;
            }
            
            // Criar backup se solicitado
            let backupPath = null;
            if (createBackup) {
                backupPath = await this.createBackup();
            }
            
            // Listar preços atuais
            const products = await this.listCurrentPrices();
            
            if (products.length === 0) {
                console.log('\n❌ Nenhum produto para atualizar!');
                return null;
            }
            
            // Mostrar o que será alterado
            console.log(`\n🎯 NOVO PREÇO PARA TODOS: R$ ${newPrice.toFixed(2)}`);
            console.log('─'.repeat(40));
            
            const totalNewValue = products.length * newPrice;
            const currentTotalValue = products.reduce((sum, p) => sum + p.price, 0);
            const difference = totalNewValue - currentTotalValue;
            
            console.log(`💵 Valor total atual: R$ ${currentTotalValue.toFixed(2)}`);
            console.log(`💵 Novo valor total: R$ ${totalNewValue.toFixed(2)}`);
            console.log(`📈 Diferença: ${difference >= 0 ? '+' : ''}R$ ${difference.toFixed(2)}`);
            
            // Confirmar alteração
            if (!await this.confirmPriceChange(products.length, newPrice, 'fixo')) {
                console.log('\n❌ Alteração cancelada pelo usuário.');
                return null;
            }
            
            // Executar alterações
            const results = {
                updated: 0,
                errors: 0,
                backup: backupPath,
                oldTotalValue: currentTotalValue,
                newTotalValue: totalNewValue,
                changes: []
            };
            
            console.log('\n🔄 EXECUTANDO ALTERAÇÕES...');
            console.log('─'.repeat(40));
            
            for (const product of products) {
                const change = await this.updateSinglePrice(product.id, newPrice);
                
                if (change) {
                    results.updated++;
                    results.changes.push(change);
                } else {
                    results.errors++;
                }
            }
            
            // Salvar backup das alterações
            if (results.changes.length > 0) {
                await this.savePriceChangesBackup(results.changes, 'fixed', newPrice);
            }
            
            // Mostrar resultado
            this.displayResults(results);
            
            return results;
            
        } catch (error) {
            console.error('❌ Erro na alteração de preços:', error.message);
            return null;
        }
    }

    /**
     * Aplicar porcentagem a todos os preços
     */
    async applyPercentageToAll(percentage, createBackup = true) {
        try {
            console.log('\n📊 APLICANDO PORCENTAGEM A TODOS OS PREÇOS');
            console.log('═'.repeat(60));
            
            // Validar porcentagem
            if (isNaN(percentage)) {
                console.log('❌ Porcentagem inválida. Use um valor numérico.');
                return null;
            }
            
            // Criar backup se solicitado
            let backupPath = null;
            if (createBackup) {
                backupPath = await this.createBackup();
            }
            
            // Listar preços atuais
            const products = await this.listCurrentPrices();
            
            if (products.length === 0) {
                console.log('\n❌ Nenhum produto para atualizar!');
                return null;
            }
            
            // Calcular novos preços
            const multiplier = 1 + (percentage / 100);
            console.log(`\n📊 APLICANDO ${percentage > 0 ? '+' : ''}${percentage}% (multiplicador: ${multiplier.toFixed(3)})`);
            console.log('─'.repeat(60));
            
            products.forEach((product, index) => {
                const newPrice = product.price * multiplier;
                console.log(`${index + 1}. ${product.name}: R$ ${product.price.toFixed(2)} → R$ ${newPrice.toFixed(2)}`);
            });
            
            const currentTotalValue = products.reduce((sum, p) => sum + p.price, 0);
            const newTotalValue = currentTotalValue * multiplier;
            const difference = newTotalValue - currentTotalValue;
            
            console.log(`\n💵 Valor total atual: R$ ${currentTotalValue.toFixed(2)}`);
            console.log(`💵 Novo valor total: R$ ${newTotalValue.toFixed(2)}`);
            console.log(`📈 Diferença: ${difference >= 0 ? '+' : ''}R$ ${difference.toFixed(2)}`);
            
            // Confirmar alteração
            if (!await this.confirmPriceChange(products.length, percentage, 'porcentagem')) {
                console.log('\n❌ Alteração cancelada pelo usuário.');
                return null;
            }
            
            // Executar alterações
            const results = {
                updated: 0,
                errors: 0,
                backup: backupPath,
                oldTotalValue: currentTotalValue,
                newTotalValue: newTotalValue,
                changes: []
            };
            
            console.log('\n🔄 EXECUTANDO ALTERAÇÕES...');
            console.log('─'.repeat(40));
            
            for (const product of products) {
                const newPrice = product.price * multiplier;
                const change = await this.updateSinglePrice(product.id, newPrice);
                
                if (change) {
                    results.updated++;
                    results.changes.push(change);
                } else {
                    results.errors++;
                }
            }
            
            // Salvar backup das alterações
            if (results.changes.length > 0) {
                await this.savePriceChangesBackup(results.changes, 'percentage', percentage);
            }
            
            // Mostrar resultado
            this.displayResults(results);
            
            return results;
            
        } catch (error) {
            console.error('❌ Erro na aplicação de porcentagem:', error.message);
            return null;
        }
    }

    /**
     * Adicionar/subtrair valor fixo a todos os preços
     */
    async addValueToAll(value, createBackup = true) {
        try {
            console.log('\n➕ ADICIONANDO VALOR FIXO A TODOS OS PREÇOS');
            console.log('═'.repeat(60));
            
            // Validar valor
            if (isNaN(value)) {
                console.log('❌ Valor inválido. Use um valor numérico.');
                return null;
            }
            
            // Criar backup se solicitado
            let backupPath = null;
            if (createBackup) {
                backupPath = await this.createBackup();
            }
            
            // Listar preços atuais
            const products = await this.listCurrentPrices();
            
            if (products.length === 0) {
                console.log('\n❌ Nenhum produto para atualizar!');
                return null;
            }
            
            // Mostrar preview das alterações
            console.log(`\n➕ ADICIONANDO ${value >= 0 ? '+' : ''}R$ ${value.toFixed(2)} A TODOS OS PREÇOS`);
            console.log('─'.repeat(60));
            
            let hasNegativePrice = false;
            products.forEach((product, index) => {
                const newPrice = Math.max(0, product.price + value); // Não permitir preços negativos
                if (product.price + value < 0) hasNegativePrice = true;
                console.log(`${index + 1}. ${product.name}: R$ ${product.price.toFixed(2)} → R$ ${newPrice.toFixed(2)}`);
            });
            
            if (hasNegativePrice) {
                console.log('\n⚠️ ATENÇÃO: Alguns preços ficariam negativos e serão ajustados para R$ 0,00');
            }
            
            const currentTotalValue = products.reduce((sum, p) => sum + p.price, 0);
            const newTotalValue = products.reduce((sum, p) => sum + Math.max(0, p.price + value), 0);
            const difference = newTotalValue - currentTotalValue;
            
            console.log(`\n💵 Valor total atual: R$ ${currentTotalValue.toFixed(2)}`);
            console.log(`💵 Novo valor total: R$ ${newTotalValue.toFixed(2)}`);
            console.log(`📈 Diferença: ${difference >= 0 ? '+' : ''}R$ ${difference.toFixed(2)}`);
            
            // Confirmar alteração
            if (!await this.confirmPriceChange(products.length, value, 'adição')) {
                console.log('\n❌ Alteração cancelada pelo usuário.');
                return null;
            }
            
            // Executar alterações
            const results = {
                updated: 0,
                errors: 0,
                backup: backupPath,
                oldTotalValue: currentTotalValue,
                newTotalValue: newTotalValue,
                changes: []
            };
            
            console.log('\n🔄 EXECUTANDO ALTERAÇÕES...');
            console.log('─'.repeat(40));
            
            for (const product of products) {
                const newPrice = Math.max(0, product.price + value);
                const change = await this.updateSinglePrice(product.id, newPrice);
                
                if (change) {
                    results.updated++;
                    results.changes.push(change);
                } else {
                    results.errors++;
                }
            }
            
            // Salvar backup das alterações
            if (results.changes.length > 0) {
                await this.savePriceChangesBackup(results.changes, 'addition', value);
            }
            
            // Mostrar resultado
            this.displayResults(results);
            
            return results;
            
        } catch (error) {
            console.error('❌ Erro na adição de valor:', error.message);
            return null;
        }
    }

    /**
     * Confirmar alteração de preços
     */
    async confirmPriceChange(count, value, type) {
        return new Promise((resolve) => {
            const readline = require('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            let message = '';
            switch (type) {
                case 'fixo':
                    message = `⚠️ ATENÇÃO: Todos os ${count} produtos terão preço R$ ${value.toFixed(2)}`;
                    break;
                case 'porcentagem':
                    message = `⚠️ ATENÇÃO: Aplicar ${value > 0 ? '+' : ''}${value}% em ${count} produtos`;
                    break;
                case 'adição':
                    message = `⚠️ ATENÇÃO: Adicionar ${value >= 0 ? '+' : ''}R$ ${value.toFixed(2)} em ${count} produtos`;
                    break;
            }
            
            console.log(`\n${message}`);
            console.log('   Um backup será criado automaticamente.');
            
            rl.question('\n🤔 Deseja continuar? (s/N): ', (answer) => {
                rl.close();
                const confirmed = answer.toLowerCase() === 's' || answer.toLowerCase() === 'sim';
                resolve(confirmed);
            });
        });
    }

    /**
     * Salvar backup das alterações
     */
    async savePriceChangesBackup(changes, type, value) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `price-changes-${type}-${timestamp}.json`;
            const backupPath = path.join(this.backupDir, backupFileName);
            
            const backupData = {
                timestamp: new Date().toISOString(),
                changeType: type,
                value: value,
                totalChanges: changes.length,
                changes: changes
            };
            
            fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
            
            console.log(`\n💾 Backup das alterações salvo: ${backupFileName}`);
            
        } catch (error) {
            console.error('❌ Erro ao salvar backup das alterações:', error.message);
        }
    }

    /**
     * Exibir resultados
     */
    displayResults(results) {
        console.log('\n🎯 RESULTADOS DA ALTERAÇÃO');
        console.log('═'.repeat(40));
        console.log(`✅ Produtos atualizados: ${results.updated}`);
        console.log(`❌ Erros: ${results.errors}`);
        
        if (results.backup) {
            console.log(`💾 Backup: ${path.basename(results.backup)}`);
        }
        
        console.log(`💵 Valor total: R$ ${results.oldTotalValue.toFixed(2)} → R$ ${results.newTotalValue.toFixed(2)}`);
        
        const difference = results.newTotalValue - results.oldTotalValue;
        console.log(`📈 Diferença: ${difference >= 0 ? '+' : ''}R$ ${difference.toFixed(2)}`);
        
        if (results.updated > 0) {
            console.log(`\n🎉 ${results.updated} produtos foram atualizados!`);
            console.log('📝 Para restaurar, use o arquivo de backup gerado.');
        }
    }

    /**
     * Restaurar preços de um backup
     */
    async restoreFromBackup(backupFilePath) {
        try {
            console.log('\n🔄 RESTAURANDO PREÇOS DO BACKUP');
            console.log('═'.repeat(50));
            
            if (!fs.existsSync(backupFilePath)) {
                console.log(`❌ Arquivo de backup não encontrado: ${backupFilePath}`);
                return false;
            }
            
            const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
            
            console.log(`📄 Backup de: ${new Date(backupData.timestamp).toLocaleString('pt-BR')}`);
            console.log(`📊 Tipo de alteração: ${backupData.changeType}`);
            console.log(`🔢 Valor aplicado: ${backupData.value}`);
            console.log(`📊 Preços para restaurar: ${backupData.totalChanges}`);
            
            // Confirmar restauração
            if (!await this.confirmRestore(backupData.totalChanges)) {
                console.log('\n❌ Restauração cancelada.');
                return false;
            }
            
            let restored = 0;
            let errors = 0;
            
            console.log('\n🔄 RESTAURANDO PREÇOS...');
            console.log('─'.repeat(40));
            
            for (const change of backupData.changes) {
                try {
                    await this.db.run(
                        'UPDATE products SET price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                        [change.oldPrice, change.productId]
                    );
                    
                    console.log(`✅ ${change.productName}: R$ ${change.newPrice.toFixed(2)} → R$ ${change.oldPrice.toFixed(2)}`);
                    restored++;
                    
                } catch (error) {
                    console.error(`❌ Erro ao restaurar ${change.productName}:`, error.message);
                    errors++;
                }
            }
            
            console.log('\n🎯 RESULTADO DA RESTAURAÇÃO');
            console.log('─'.repeat(30));
            console.log(`✅ Restaurados: ${restored}`);
            console.log(`❌ Erros: ${errors}`);
            
            return restored > 0;
            
        } catch (error) {
            console.error('❌ Erro na restauração:', error.message);
            return false;
        }
    }

    /**
     * Confirmar restauração
     */
    async confirmRestore(count) {
        return new Promise((resolve) => {
            const readline = require('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            rl.question(`\n🤔 Restaurar preços de ${count} produtos? (s/N): `, (answer) => {
                rl.close();
                const confirmed = answer.toLowerCase() === 's' || answer.toLowerCase() === 'sim';
                resolve(confirmed);
            });
        });
    }

    /**
     * Listar backups disponíveis
     */
    listBackups() {
        try {
            if (!fs.existsSync(this.backupDir)) {
                console.log('📁 Nenhum backup encontrado.');
                return [];
            }
            
            const files = fs.readdirSync(this.backupDir);
            const backupFiles = files.filter(file => 
                file.startsWith('price-changes-') && file.endsWith('.json')
            );
            
            console.log('\n💾 BACKUPS DE PREÇOS DISPONÍVEIS:');
            console.log('═'.repeat(50));
            
            if (backupFiles.length === 0) {
                console.log('Nenhum backup de preços encontrado.');
                return [];
            }
            
            backupFiles.forEach((file, index) => {
                const filePath = path.join(this.backupDir, file);
                const stats = fs.statSync(filePath);
                
                try {
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    console.log(`\n${index + 1}. ${file}`);
                    console.log(`   📅 Data: ${new Date(data.timestamp).toLocaleString('pt-BR')}`);
                    console.log(`   📊 Tipo: ${data.changeType}`);
                    console.log(`   🔢 Valor: ${data.value}`);
                    console.log(`   📱 Produtos: ${data.totalChanges}`);
                    console.log(`   📁 Tamanho: ${Math.round(stats.size / 1024)} KB`);
                } catch (error) {
                    console.log(`\n${index + 1}. ${file} (arquivo corrompido)`);
                }
            });
            
            return backupFiles.map(file => path.join(this.backupDir, file));
            
        } catch (error) {
            console.error('❌ Erro ao listar backups:', error.message);
            return [];
        }
    }
}

/**
 * Funções de conveniência
 */

async function listPrices() {
    const converter = new PriceConverter();
    
    try {
        await converter.initialize();
        await converter.listCurrentPrices();
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await converter.close();
    }
}

async function setAllPrices(price) {
    const converter = new PriceConverter();
    
    try {
        await converter.initialize();
        const result = await converter.setAllPricesToFixed(parseFloat(price), true);
        return result;
    } catch (error) {
        console.error('❌ Erro:', error.message);
        return null;
    } finally {
        await converter.close();
    }
}

async function applyPercentage(percentage) {
    const converter = new PriceConverter();
    
    try {
        await converter.initialize();
        const result = await converter.applyPercentageToAll(parseFloat(percentage), true);
        return result;
    } catch (error) {
        console.error('❌ Erro:', error.message);
        return null;
    } finally {
        await converter.close();
    }
}

async function addValue(value) {
    const converter = new PriceConverter();
    
    try {
        await converter.initialize();
        const result = await converter.addValueToAll(parseFloat(value), true);
        return result;
    } catch (error) {
        console.error('❌ Erro:', error.message);
        return null;
    } finally {
        await converter.close();
    }
}

async function listBackups() {
    const converter = new PriceConverter();
    
    try {
        await converter.initialize();
        converter.listBackups();
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await converter.close();
    }
}

async function restore(backupFile) {
    const converter = new PriceConverter();
    
    try {
        await converter.initialize();
        await converter.restoreFromBackup(backupFile);
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await converter.close();
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    const value = args[1];
    
    console.log('💰 CONVERSOR DE PREÇOS');
    console.log('═'.repeat(40));
    
    if (!command) {
        console.log('📋 Uso:');
        console.log('  node price-converter.js list                    # Listar preços atuais');
        console.log('  node price-converter.js set [valor]             # Definir preço fixo');
        console.log('  node price-converter.js percent [porcentagem]   # Aplicar porcentagem');
        console.log('  node price-converter.js add [valor]             # Adicionar valor');
        console.log('  node price-converter.js backups                 # Listar backups');
        console.log('  node price-converter.js restore [arquivo]       # Restaurar backup');
        console.log('\n📚 Exemplos:');
        console.log('  node price-converter.js set 15.00               # Todos produtos = R$ 15,00');
        console.log('  node price-converter.js percent 20              # Aumentar 20%');
        console.log('  node price-converter.js percent -10             # Diminuir 10%');
        console.log('  node price-converter.js add 5.00                # Adicionar R$ 5,00');
        console.log('  node price-converter.js add -2.50               # Subtrair R$ 2,50');
        return;
    }
    
    switch (command) {
        case 'list':
            console.log('📋 Listando preços atuais...\n');
            listPrices();
            break;
            
        case 'set':
            if (!value) {
                console.log('❌ Especifique o novo preço.');
                console.log('Uso: node price-converter.js set [valor]');
                return;
            }
            console.log(`💰 Definindo todos os preços para R$ ${value}...\n`);
            setAllPrices(value);
            break;
            
        case 'percent':
        case 'percentage':
            if (!value) {
                console.log('❌ Especifique a porcentagem.');
                console.log('Uso: node price-converter.js percent [porcentagem]');
                return;
            }
            console.log(`📊 Aplicando ${value}% em todos os preços...\n`);
            applyPercentage(value);
            break;
            
        case 'add':
            if (!value) {
                console.log('❌ Especifique o valor a adicionar.');
                console.log('Uso: node price-converter.js add [valor]');
                return;
            }
            console.log(`➕ Adicionando R$ ${value} a todos os preços...\n`);
            addValue(value);
            break;
            
        case 'backups':
            console.log('💾 Listando backups disponíveis...\n');
            listBackups();
            break;
            
        case 'restore':
            if (!value) {
                console.log('❌ Especifique o arquivo de backup.');
                console.log('Uso: node price-converter.js restore [arquivo-backup]');
                console.log('\nBackups disponíveis:');
                listBackups();
            } else {
                console.log(`🔄 Restaurando do backup: ${value}\n`);
                restore(value);
            }
            break;
            
        default:
            console.log(`❌ Comando desconhecido: ${command}`);
            console.log('Use "node price-converter.js" para ver a ajuda.');
            break;
    }
}

module.exports = {
    PriceConverter,
    listPrices,
    setAllPrices,
    applyPercentage,
    addValue,
    listBackups,
    restore
};
