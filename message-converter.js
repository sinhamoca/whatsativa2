// message-converter.js - Utilitário para Converter Mensagens Personalizadas para Padrão
const DatabaseService = require('./database-service');
const fs = require('fs');
const path = require('path');

class MessageConverter {
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
            const backupFileName = `database-backup-${timestamp}.sqlite`;
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
     * Listar todos os produtos com mensagens personalizadas
     */
    async listProductsWithCustomMessages() {
        try {
            const products = await this.db.getProducts();
            const customProducts = products.filter(product => product.paymentConfirmedMessage);
            
            console.log(`\n📱 PRODUTOS COM MENSAGENS PERSONALIZADAS: ${customProducts.length}`);
            console.log('═'.repeat(80));
            
            if (customProducts.length === 0) {
                console.log('✅ Nenhum produto possui mensagem personalizada.');
                return [];
            }
            
            customProducts.forEach((product, index) => {
                console.log(`\n${index + 1}. 🎯 ${product.name.toUpperCase()}`);
                console.log('─'.repeat(50));
                console.log(`📋 ID: ${product.id}`);
                console.log(`💰 Preço: R$ ${product.price.toFixed(2)}`);
                console.log(`⚙️ Módulo: ${product.activationModule}`);
                console.log(`🔧 Status: ${product.active ? 'ATIVO' : 'INATIVO'}`);
                
                // Preview da mensagem personalizada
                const messagePreview = product.paymentConfirmedMessage.length > 150 
                    ? product.paymentConfirmedMessage.substring(0, 150) + '...' 
                    : product.paymentConfirmedMessage;
                
                console.log(`💬 Mensagem Atual:`);
                console.log(`   ${messagePreview.replace(/\n/g, '\\n')}`);
            });
            
            return customProducts;
            
        } catch (error) {
            console.error('❌ Erro ao listar produtos:', error.message);
            return [];
        }
    }

    /**
     * Obter mensagem padrão do sistema
     */
    async getDefaultMessage() {
        try {
            const messages = await this.db.getMessages();
            return messages.payment_confirmed || '✅ *Pagamento confirmado!*\n\n🎯 {product_name}\n💰 R$ {price}\n\n📝 *Envie as informações para ativação.*';
        } catch (error) {
            console.error('❌ Erro ao obter mensagem padrão:', error.message);
            return '✅ *Pagamento confirmado!*\n\n🎯 {product_name}\n💰 R$ {price}\n\n📝 *Envie as informações para ativação.*';
        }
    }

    /**
     * Converter um produto específico para mensagem padrão
     */
    async convertSingleProduct(productId) {
        try {
            const product = await this.db.getProduct(productId);
            
            if (!product) {
                console.log(`❌ Produto ${productId} não encontrado.`);
                return false;
            }
            
            if (!product.paymentConfirmedMessage) {
                console.log(`✅ Produto ${product.name} já usa mensagem padrão.`);
                return true;
            }
            
            // Salvar mensagem atual como backup
            const backup = {
                productId: productId,
                productName: product.name,
                originalMessage: product.paymentConfirmedMessage,
                convertedAt: new Date().toISOString()
            };
            
            // Remover mensagem personalizada (definir como NULL)
            await this.db.run(
                'UPDATE products SET payment_confirmed_message = NULL WHERE id = ?',
                [productId]
            );
            
            console.log(`✅ ${product.name} convertido para mensagem padrão`);
            
            return backup;
            
        } catch (error) {
            console.error(`❌ Erro ao converter produto ${productId}:`, error.message);
            return false;
        }
    }

    /**
     * Converter todos os produtos para mensagem padrão
     */
    async convertAllProducts(createBackup = true) {
        try {
            console.log('\n🔄 INICIANDO CONVERSÃO PARA MENSAGEM PADRÃO');
            console.log('═'.repeat(60));
            
            // Criar backup se solicitado
            let backupPath = null;
            if (createBackup) {
                backupPath = await this.createBackup();
            }
            
            // Listar produtos com mensagem personalizada
            const customProducts = await this.listProductsWithCustomMessages();
            
            if (customProducts.length === 0) {
                console.log('\n✅ Nada para converter!');
                return {
                    converted: 0,
                    skipped: 0,
                    errors: 0,
                    backup: backupPath
                };
            }
            
            // Obter mensagem padrão
            const defaultMessage = await this.getDefaultMessage();
            console.log(`\n📝 MENSAGEM PADRÃO QUE SERÁ USADA:`);
            console.log('─'.repeat(50));
            console.log(defaultMessage);
            console.log('─'.repeat(50));
            
            // Confirmar conversão
            if (!await this.confirmConversion(customProducts.length)) {
                console.log('\n❌ Conversão cancelada pelo usuário.');
                return null;
            }
            
            // Executar conversão
            const results = {
                converted: 0,
                skipped: 0,
                errors: 0,
                backup: backupPath,
                conversions: []
            };
            
            console.log('\n🔄 EXECUTANDO CONVERSÕES...');
            console.log('─'.repeat(40));
            
            for (const product of customProducts) {
                try {
                    const backup = await this.convertSingleProduct(product.id);
                    
                    if (backup === true) {
                        results.skipped++;
                    } else if (backup) {
                        results.converted++;
                        results.conversions.push(backup);
                    } else {
                        results.errors++;
                    }
                    
                } catch (error) {
                    console.error(`❌ Erro ao converter ${product.name}:`, error.message);
                    results.errors++;
                }
            }
            
            // Salvar backup das mensagens convertidas
            if (results.conversions.length > 0) {
                await this.saveConversionsBackup(results.conversions);
            }
            
            // Mostrar resultado
            this.displayResults(results);
            
            return results;
            
        } catch (error) {
            console.error('❌ Erro na conversão:', error.message);
            return null;
        }
    }

    /**
     * Confirmar conversão com o usuário
     */
    async confirmConversion(count) {
        return new Promise((resolve) => {
            const readline = require('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            console.log(`\n⚠️ ATENÇÃO: Você está prestes a converter ${count} produtos!`);
            console.log('   Todas as mensagens personalizadas serão removidas.');
            console.log('   Um backup será criado automaticamente.');
            
            rl.question('\n🤔 Deseja continuar? (s/N): ', (answer) => {
                rl.close();
                const confirmed = answer.toLowerCase() === 's' || answer.toLowerCase() === 'sim';
                resolve(confirmed);
            });
        });
    }

    /**
     * Salvar backup das conversões
     */
    async saveConversionsBackup(conversions) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `conversions-backup-${timestamp}.json`;
            const backupPath = path.join(this.backupDir, backupFileName);
            
            const backupData = {
                timestamp: new Date().toISOString(),
                totalConversions: conversions.length,
                conversions: conversions
            };
            
            fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
            
            console.log(`\n💾 Backup das mensagens salvo: ${backupFileName}`);
            
        } catch (error) {
            console.error('❌ Erro ao salvar backup das mensagens:', error.message);
        }
    }

    /**
     * Exibir resultados da conversão
     */
    displayResults(results) {
        console.log('\n🎯 RESULTADOS DA CONVERSÃO');
        console.log('═'.repeat(40));
        console.log(`✅ Convertidos: ${results.converted}`);
        console.log(`⏭️ Ignorados: ${results.skipped}`);
        console.log(`❌ Erros: ${results.errors}`);
        
        if (results.backup) {
            console.log(`💾 Backup: ${path.basename(results.backup)}`);
        }
        
        if (results.converted > 0) {
            console.log(`\n🎉 ${results.converted} produtos agora usam mensagem padrão!`);
            console.log('📝 Para restaurar, use o arquivo de backup gerado.');
        }
    }

    /**
     * Restaurar mensagens de um backup
     */
    async restoreFromBackup(backupFilePath) {
        try {
            console.log('\n🔄 RESTAURANDO MENSAGENS DO BACKUP');
            console.log('═'.repeat(50));
            
            if (!fs.existsSync(backupFilePath)) {
                console.log(`❌ Arquivo de backup não encontrado: ${backupFilePath}`);
                return false;
            }
            
            const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
            
            console.log(`📄 Backup de: ${new Date(backupData.timestamp).toLocaleString('pt-BR')}`);
            console.log(`📊 Mensagens para restaurar: ${backupData.totalConversions}`);
            
            // Confirmar restauração
            if (!await this.confirmRestore(backupData.totalConversions)) {
                console.log('\n❌ Restauração cancelada.');
                return false;
            }
            
            let restored = 0;
            let errors = 0;
            
            for (const conversion of backupData.conversions) {
                try {
                    await this.db.run(
                        'UPDATE products SET payment_confirmed_message = ? WHERE id = ?',
                        [conversion.originalMessage, conversion.productId]
                    );
                    
                    console.log(`✅ ${conversion.productName} restaurado`);
                    restored++;
                    
                } catch (error) {
                    console.error(`❌ Erro ao restaurar ${conversion.productName}:`, error.message);
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
            
            rl.question(`\n🤔 Restaurar ${count} mensagens personalizadas? (s/N): `, (answer) => {
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
                file.startsWith('conversions-backup-') && file.endsWith('.json')
            );
            
            console.log('\n💾 BACKUPS DISPONÍVEIS:');
            console.log('═'.repeat(40));
            
            if (backupFiles.length === 0) {
                console.log('Nenhum backup de conversões encontrado.');
                return [];
            }
            
            backupFiles.forEach((file, index) => {
                const filePath = path.join(this.backupDir, file);
                const stats = fs.statSync(filePath);
                
                try {
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    console.log(`\n${index + 1}. ${file}`);
                    console.log(`   📅 Data: ${new Date(data.timestamp).toLocaleString('pt-BR')}`);
                    console.log(`   📊 Mensagens: ${data.totalConversions}`);
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

async function convertAll() {
    const converter = new MessageConverter();
    
    try {
        await converter.initialize();
        const result = await converter.convertAllProducts(true);
        return result;
    } catch (error) {
        console.error('❌ Erro:', error.message);
        return null;
    } finally {
        await converter.close();
    }
}

async function listCustom() {
    const converter = new MessageConverter();
    
    try {
        await converter.initialize();
        await converter.listProductsWithCustomMessages();
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await converter.close();
    }
}

async function listBackups() {
    const converter = new MessageConverter();
    
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
    const converter = new MessageConverter();
    
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
    const command = args[0] || 'list';
    
    console.log('🔄 CONVERSOR DE MENSAGENS');
    console.log('═'.repeat(40));
    
    switch (command) {
        case 'convert':
        case 'all':
            console.log('🔄 Convertendo todas as mensagens para padrão...\n');
            convertAll();
            break;
            
        case 'restore':
            const backupFile = args[1];
            if (!backupFile) {
                console.log('❌ Especifique o arquivo de backup.');
                console.log('Uso: node message-converter.js restore [arquivo-backup]');
                console.log('\nBackups disponíveis:');
                listBackups();
            } else {
                console.log(`🔄 Restaurando do backup: ${backupFile}\n`);
                restore(backupFile);
            }
            break;
            
        case 'backups':
            console.log('💾 Listando backups disponíveis...\n');
            listBackups();
            break;
            
        case 'list':
        default:
            console.log('📋 Listando produtos com mensagens personalizadas...\n');
            listCustom();
            break;
    }
}

module.exports = {
    MessageConverter,
    convertAll,
    listCustom,
    listBackups,
    restore
};
