// products-inspector.js - Utilitário para Capturar e Visualizar Produtos
const DatabaseService = require('./database-service');
const fs = require('fs');
const path = require('path');

class ProductsInspector {
    constructor() {
        this.db = new DatabaseService('./database.sqlite');
        this.modulesDir = path.join(__dirname, 'modules');
    }

    async initialize() {
        await this.db.initialize();
    }

    async close() {
        await this.db.close();
    }

    /**
     * Capturar todos os produtos do banco de dados
     */
    async captureProducts() {
        try {
            const products = await this.db.getProducts();
            
            console.log(`\n📱 PRODUTOS ENCONTRADOS: ${products.length}`);
            console.log('═'.repeat(80));
            
            const productsData = [];
            
            for (const product of products) {
                // Verificar se o módulo existe
                const moduleExists = await this.checkModuleExists(product.activationModule);
                
                // Obter informações da mensagem personalizada
                const messageInfo = await this.getMessageInfo(product.id);
                
                const productInfo = {
                    id: product.id,
                    name: product.name,
                    description: product.description || 'Sem descrição',
                    price: product.price,
                    currency: product.currency || 'BRL',
                    activationModule: product.activationModule,
                    status: product.active ? 'ATIVO' : 'INATIVO',
                    hasCustomMessage: !!product.paymentConfirmedMessage,
                    customMessage: product.paymentConfirmedMessage || null,
                    moduleExists: moduleExists,
                    createdAt: product.createdAt || 'N/A',
                    updatedAt: product.updatedAt || 'N/A'
                };
                
                productsData.push(productInfo);
                
                // Exibir informações no console
                this.displayProductInfo(productInfo);
            }
            
            return productsData;
            
        } catch (error) {
            console.error('❌ Erro ao capturar produtos:', error.message);
            return [];
        }
    }

    /**
     * Verificar se o módulo de ativação existe
     */
    async checkModuleExists(moduleId) {
        try {
            const modulePath = path.join(this.modulesDir, `module_${moduleId}.js`);
            return fs.existsSync(modulePath);
        } catch (error) {
            return false;
        }
    }

    /**
     * Obter informações da mensagem personalizada
     */
    async getMessageInfo(productId) {
        try {
            const messageData = await this.db.getPaymentConfirmedMessage(productId);
            return {
                isCustom: messageData.isCustom,
                content: messageData.content,
                preview: messageData.content ? messageData.content.substring(0, 100) + '...' : null
            };
        } catch (error) {
            return {
                isCustom: false,
                content: null,
                preview: null
            };
        }
    }

    /**
     * Exibir informações de um produto no console
     */
    displayProductInfo(product) {
        console.log(`\n🎯 ${product.name.toUpperCase()}`);
        console.log('─'.repeat(50));
        console.log(`📋 ID: ${product.id}`);
        console.log(`💰 Preço: R$ ${product.price.toFixed(2)} ${product.currency}`);
        console.log(`⚙️ Módulo: ${product.activationModule}`);
        console.log(`📁 Arquivo: module_${product.activationModule}.js ${product.moduleExists ? '✅' : '❌ NÃO ENCONTRADO'}`);
        console.log(`🔧 Status: ${product.status}`);
        console.log(`💬 Mensagem: ${product.hasCustomMessage ? '🎨 PERSONALIZADA' : '📝 PADRÃO'}`);
        
        if (product.description && product.description !== 'Sem descrição') {
            console.log(`📝 Descrição: ${product.description}`);
        }
        
        if (product.hasCustomMessage && product.customMessage) {
            const preview = product.customMessage.length > 100 
                ? product.customMessage.substring(0, 100) + '...' 
                : product.customMessage;
            console.log(`📄 Preview: ${preview}`);
        }
    }

    /**
     * Gerar relatório em JSON
     */
    async generateJsonReport() {
        try {
            const products = await this.captureProducts();
            
            const report = {
                timestamp: new Date().toISOString(),
                totalProducts: products.length,
                activeProducts: products.filter(p => p.status === 'ATIVO').length,
                inactiveProducts: products.filter(p => p.status === 'INATIVO').length,
                customMessages: products.filter(p => p.hasCustomMessage).length,
                missingModules: products.filter(p => !p.moduleExists).length,
                products: products
            };
            
            const fileName = `products-report-${new Date().toISOString().split('T')[0]}.json`;
            const filePath = path.join(__dirname, fileName);
            
            fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
            
            console.log(`\n📄 RELATÓRIO GERADO: ${fileName}`);
            console.log(`📁 Local: ${filePath}`);
            
            return { report, filePath };
            
        } catch (error) {
            console.error('❌ Erro ao gerar relatório JSON:', error.message);
            return null;
        }
    }

    /**
     * Gerar relatório em CSV
     */
    async generateCsvReport() {
        try {
            const products = await this.captureProducts();
            
            const csvHeader = 'ID,Nome,Preco,Modulo,Status,MensagemPersonalizada,ModuloExiste,Descricao\n';
            
            const csvRows = products.map(product => {
                const description = (product.description || '').replace(/"/g, '""').replace(/\n/g, ' ');
                return [
                    product.id,
                    `"${product.name}"`,
                    product.price,
                    product.activationModule,
                    product.status,
                    product.hasCustomMessage ? 'SIM' : 'NAO',
                    product.moduleExists ? 'SIM' : 'NAO',
                    `"${description}"`
                ].join(',');
            });
            
            const csvContent = csvHeader + csvRows.join('\n');
            
            const fileName = `products-report-${new Date().toISOString().split('T')[0]}.csv`;
            const filePath = path.join(__dirname, fileName);
            
            fs.writeFileSync(filePath, csvContent);
            
            console.log(`\n📊 RELATÓRIO CSV GERADO: ${fileName}`);
            console.log(`📁 Local: ${filePath}`);
            
            return filePath;
            
        } catch (error) {
            console.error('❌ Erro ao gerar relatório CSV:', error.message);
            return null;
        }
    }

    /**
     * Listar módulos disponíveis na pasta modules/
     */
    async listAvailableModules() {
        try {
            if (!fs.existsSync(this.modulesDir)) {
                console.log('❌ Pasta modules/ não encontrada');
                return [];
            }
            
            const files = fs.readdirSync(this.modulesDir);
            const moduleFiles = files.filter(file => 
                file.startsWith('module_') && file.endsWith('.js')
            );
            
            console.log(`\n📦 MÓDULOS DISPONÍVEIS: ${moduleFiles.length}`);
            console.log('═'.repeat(50));
            
            const modules = [];
            
            for (const file of moduleFiles) {
                const moduleId = file.replace('module_', '').replace('.js', '');
                const filePath = path.join(this.modulesDir, file);
                const stats = fs.statSync(filePath);
                
                // Tentar carregar o módulo para obter informações
                let moduleInfo = null;
                try {
                    const moduleExports = require(filePath);
                    if (moduleExports.createActivator) {
                        const activator = moduleExports.createActivator();
                        moduleInfo = activator.config || null;
                    }
                } catch (error) {
                    // Módulo com erro
                }
                
                const moduleData = {
                    id: moduleId,
                    file: file,
                    size: stats.size,
                    modified: stats.mtime.toISOString(),
                    hasError: !moduleInfo,
                    info: moduleInfo
                };
                
                modules.push(moduleData);
                
                console.log(`📁 ${file}`);
                console.log(`   ID: ${moduleId}`);
                console.log(`   Tamanho: ${Math.round(stats.size / 1024)} KB`);
                console.log(`   Modificado: ${stats.mtime.toLocaleDateString('pt-BR')}`);
                console.log(`   Status: ${moduleInfo ? '✅ OK' : '❌ ERRO'}`);
                
                if (moduleInfo) {
                    console.log(`   Nome: ${moduleInfo.name || 'N/A'}`);
                    console.log(`   Versão: ${moduleInfo.version || 'N/A'}`);
                }
                
                console.log('');
            }
            
            return modules;
            
        } catch (error) {
            console.error('❌ Erro ao listar módulos:', error.message);
            return [];
        }
    }

    /**
     * Verificar integridade do sistema
     */
    async checkSystemIntegrity() {
        try {
            console.log('\n🔍 VERIFICAÇÃO DE INTEGRIDADE DO SISTEMA');
            console.log('═'.repeat(60));
            
            const products = await this.db.getProducts();
            const modules = await this.listAvailableModules();
            
            const issues = [];
            
            // Verificar produtos sem módulos
            const productsWithoutModules = products.filter(product => {
                const moduleExists = modules.some(module => module.id === product.activationModule);
                return !moduleExists;
            });
            
            if (productsWithoutModules.length > 0) {
                console.log(`\n❌ PRODUTOS SEM MÓDULOS (${productsWithoutModules.length}):`);
                productsWithoutModules.forEach(product => {
                    console.log(`   • ${product.name} (${product.id}) → módulo: ${product.activationModule}`);
                });
                issues.push({
                    type: 'missing_modules',
                    count: productsWithoutModules.length,
                    items: productsWithoutModules
                });
            }
            
            // Verificar módulos sem produtos
            const modulesWithoutProducts = modules.filter(module => {
                const productExists = products.some(product => product.activationModule === module.id);
                return !productExists;
            });
            
            if (modulesWithoutProducts.length > 0) {
                console.log(`\n⚠️ MÓDULOS SEM PRODUTOS (${modulesWithoutProducts.length}):`);
                modulesWithoutProducts.forEach(module => {
                    console.log(`   • ${module.file} (${module.id})`);
                });
                issues.push({
                    type: 'orphan_modules',
                    count: modulesWithoutProducts.length,
                    items: modulesWithoutProducts
                });
            }
            
            // Verificar módulos com erro
            const brokenModules = modules.filter(module => module.hasError);
            
            if (brokenModules.length > 0) {
                console.log(`\n💥 MÓDULOS COM ERRO (${brokenModules.length}):`);
                brokenModules.forEach(module => {
                    console.log(`   • ${module.file} (${module.id})`);
                });
                issues.push({
                    type: 'broken_modules',
                    count: brokenModules.length,
                    items: brokenModules
                });
            }
            
            // Resumo final
            if (issues.length === 0) {
                console.log('\n✅ SISTEMA ÍNTEGRO - Nenhum problema encontrado!');
            } else {
                console.log(`\n⚠️ ENCONTRADOS ${issues.length} TIPOS DE PROBLEMAS`);
            }
            
            console.log(`\n📊 RESUMO:`);
            console.log(`   Produtos: ${products.length}`);
            console.log(`   Módulos: ${modules.length}`);
            console.log(`   Ativos: ${products.filter(p => p.active).length}`);
            console.log(`   Com mensagem personalizada: ${products.filter(p => p.paymentConfirmedMessage).length}`);
            
            return {
                products: products.length,
                modules: modules.length,
                issues: issues,
                isHealthy: issues.length === 0
            };
            
        } catch (error) {
            console.error('❌ Erro na verificação:', error.message);
            return null;
        }
    }

    /**
     * Executar inspeção completa
     */
    async runCompleteInspection() {
        try {
            console.log('🚀 INSPETOR DE PRODUTOS - RELATÓRIO COMPLETO');
            console.log('═'.repeat(80));
            console.log(`📅 Data: ${new Date().toLocaleString('pt-BR')}`);
            
            // 1. Capturar produtos
            const products = await this.captureProducts();
            
            // 2. Listar módulos
            const modules = await this.listAvailableModules();
            
            // 3. Verificar integridade
            const integrity = await this.checkSystemIntegrity();
            
            // 4. Gerar relatórios
            const jsonReport = await this.generateJsonReport();
            const csvReport = await this.generateCsvReport();
            
            console.log('\n🎯 INSPEÇÃO COMPLETA CONCLUÍDA!');
            console.log('═'.repeat(50));
            
            return {
                products,
                modules,
                integrity,
                reports: {
                    json: jsonReport,
                    csv: csvReport
                }
            };
            
        } catch (error) {
            console.error('❌ Erro na inspeção completa:', error.message);
            return null;
        }
    }
}

/**
 * Função para executar inspeção rápida
 */
async function quickInspection() {
    const inspector = new ProductsInspector();
    
    try {
        await inspector.initialize();
        await inspector.captureProducts();
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await inspector.close();
    }
}

/**
 * Função para executar inspeção completa
 */
async function fullInspection() {
    const inspector = new ProductsInspector();
    
    try {
        await inspector.initialize();
        const result = await inspector.runCompleteInspection();
        return result;
    } catch (error) {
        console.error('❌ Erro:', error.message);
        return null;
    } finally {
        await inspector.close();
    }
}

/**
 * Função para verificar apenas integridade
 */
async function checkIntegrity() {
    const inspector = new ProductsInspector();
    
    try {
        await inspector.initialize();
        await inspector.checkSystemIntegrity();
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await inspector.close();
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0] || 'quick';
    
    console.log('🔍 INSPETOR DE PRODUTOS');
    console.log('═'.repeat(40));
    
    switch (command) {
        case 'full':
        case 'complete':
            console.log('📋 Executando inspeção completa...\n');
            fullInspection();
            break;
            
        case 'integrity':
        case 'check':
            console.log('🔍 Verificando integridade...\n');
            checkIntegrity();
            break;
            
        case 'quick':
        case 'list':
        default:
            console.log('⚡ Executando inspeção rápida...\n');
            quickInspection();
            break;
    }
}

module.exports = {
    ProductsInspector,
    quickInspection,
    fullInspection,
    checkIntegrity
};
