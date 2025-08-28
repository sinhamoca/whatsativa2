// activation-manager.js - Gerenciador de Módulos de Ativação
const path = require('path');
const fs = require('fs').promises;
const pino = require('pino');

class ActivationManager {
    constructor() {
        this.logger = pino({ level: 'info' });
        this.modules = new Map();
        this.modulesDir = path.join(__dirname, 'modules');
        
        this.stats = {
            totalActivations: 0,
            successfulActivations: 0,
            failedActivations: 0,
            moduleStats: {}
        };
    }

    async initialize() {
        try {
            this.logger.info('🔧 Inicializando Activation Manager...');
            
            // Criar diretório de módulos se não existir
            await fs.mkdir(this.modulesDir, { recursive: true });
            
            // Carregar módulos disponíveis
            await this.loadModules();
            
            this.logger.info(`✅ Activation Manager inicializado - ${this.modules.size} módulos carregados`);
            
        } catch (error) {
            this.logger.error('❌ Erro ao inicializar Activation Manager:', error);
            throw error;
        }
    }

    async loadModules() {
        try {
            const moduleFiles = await fs.readdir(this.modulesDir);
            const jsFiles = moduleFiles.filter(file => file.endsWith('.js') && file.startsWith('module_'));
            
            for (const file of jsFiles) {
                try {
                    const modulePath = path.join(this.modulesDir, file);
                    
                    // Limpar cache do require para reload
                    delete require.cache[require.resolve(modulePath)];
                    
                    const moduleExports = require(modulePath);
                    const moduleId = file.replace('module_', '').replace('.js', '');
                    
                    // Criar instância do módulo
                    let moduleInstance;
                    if (typeof moduleExports.createActivator === 'function') {
                        moduleInstance = moduleExports.createActivator();
                    } else if (typeof moduleExports === 'function') {
                        moduleInstance = new moduleExports();
                    } else {
                        throw new Error('Módulo não exporta createActivator ou classe');
                    }
                    
                    // Validar se tem método activate
                    if (typeof moduleInstance.activate !== 'function') {
                        throw new Error('Módulo não possui método activate');
                    }
                    
                    this.modules.set(moduleId, {
                        instance: moduleInstance,
                        file: file,
                        loadedAt: new Date(),
                        stats: {
                            activations: 0,
                            successes: 0,
                            failures: 0
                        }
                    });
                    
                    this.logger.info(`📦 Módulo carregado: ${moduleId} (${file})`);
                    
                } catch (error) {
                    this.logger.error(`❌ Erro ao carregar módulo ${file}:`, error.message);
                }
            }
            
        } catch (error) {
            this.logger.error('❌ Erro ao carregar módulos:', error);
        }
    }

    async activateProduct(order, activationData) {
        try {
            this.logger.info(`🚀 Iniciando ativação - Pedido: ${order.id}, Produto: ${order.product.id}`);
            
            const moduleId = order.product.activationModule || order.product.id;
            const module = this.modules.get(moduleId);
            
            if (!module) {
                const error = `Módulo de ativação não encontrado: ${moduleId}`;
                this.logger.error(`❌ ${error}`);
                
                this.stats.totalActivations++;
                this.stats.failedActivations++;
                
                return {
                    success: false,
                    error: error,
                    suggestion: `Módulos disponíveis: ${Array.from(this.modules.keys()).join(', ')}`
                };
            }
            
            // Atualizar estatísticas
            this.stats.totalActivations++;
            module.stats.activations++;
            
            // Executar ativação
            this.logger.info(`⚙️ Executando módulo: ${moduleId}`);
            const startTime = Date.now();
            
            const result = await module.instance.activate(activationData, order);
            
            const duration = Date.now() - startTime;
            this.logger.info(`⏱️ Ativação concluída em ${duration}ms`);
            
            // Atualizar estatísticas baseado no resultado
            if (result.success) {
                this.stats.successfulActivations++;
                module.stats.successes++;
                this.logger.info(`✅ Ativação bem-sucedida - ${order.product.name}`);
            } else {
                this.stats.failedActivations++;
                module.stats.failures++;
                this.logger.warn(`❌ Ativação falhada - ${result.error}`);
            }
            
            // Adicionar metadados ao resultado
            result.moduleId = moduleId;
            result.duration = duration;
            result.timestamp = new Date().toISOString();
            
            return result;
            
        } catch (error) {
            this.logger.error('❌ Erro durante ativação:', error);
            
            this.stats.totalActivations++;
            this.stats.failedActivations++;
            
            return {
                success: false,
                error: 'Erro interno no sistema de ativação',
                details: error.message
            };
        }
    }

    async testModule(moduleId) {
        try {
            const module = this.modules.get(moduleId);
            
            if (!module) {
                return {
                    success: false,
                    error: `Módulo ${moduleId} não encontrado`
                };
            }
            
            this.logger.info(`🧪 Testando módulo: ${moduleId}`);
            
            // Verificar se o módulo tem método de teste
            if (typeof module.instance.test === 'function') {
                const result = await module.instance.test();
                this.logger.info(`🧪 Teste do módulo ${moduleId}:`, result.success ? '✅ OK' : '❌ FALHA');
                return result;
            } else {
                // Teste básico usando ativação simulada
                const testOrder = {
                    id: `test-${Date.now()}`,
                    product: {
                        id: moduleId,
                        name: `Produto ${moduleId}`,
                        activationModule: moduleId
                    }
                };
                
                const testData = 'teste@email.com\nAA:BB:CC:DD:EE:FF\nTEST123';
                const result = await this.activateProduct(testOrder, testData);
                
                return result;
            }
            
        } catch (error) {
            this.logger.error(`❌ Erro ao testar módulo ${moduleId}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async reloadModules() {
        try {
            this.logger.info('🔄 Recarregando módulos...');
            
            // Limpar módulos atuais
            this.modules.clear();
            
            // Carregar novamente
            await this.loadModules();
            
            this.logger.info(`✅ Módulos recarregados - ${this.modules.size} módulos disponíveis`);
            
            return {
                success: true,
                modulesCount: this.modules.size,
                modules: Array.from(this.modules.keys())
            };
            
        } catch (error) {
            this.logger.error('❌ Erro ao recarregar módulos:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    getAvailableModules() {
        const modules = [];
        
        for (const [id, module] of this.modules.entries()) {
            modules.push({
                id: id,
                file: module.file,
                loadedAt: module.loadedAt,
                stats: module.stats,
                hasTestMethod: typeof module.instance.test === 'function',
                config: module.instance.config || {}
            });
        }
        
        return modules;
    }

    getStats() {
        return {
            ...this.stats,
            modulesCount: this.modules.size,
            modules: this.getAvailableModules(),
            successRate: this.stats.totalActivations > 0 
                ? (this.stats.successfulActivations / this.stats.totalActivations * 100).toFixed(2)
                : 0
        };
    }

    async createModuleTemplate(moduleId, productName) {
        try {
            const template = `// modules/module_${moduleId}.js - Módulo de Ativação: ${productName}
const { AppAActivator } = require('./module_app_a');

class ${productName.replace(/[^a-zA-Z0-9]/g, '')}Activator extends AppAActivator {
    constructor(config = {}) {
        super({
            name: '${productName}',
            version: '1.0.0',
            activationMethod: 'simulation', // 'api', 'file', 'email', 'simulation'
            apiUrl: 'https://api-${moduleId}.exemplo.com',
            ...config
        });
    }

    // Sobrescrever métodos específicos se necessário
    async performActivation(extractedData, license, order) {
        // Lógica específica para ${productName}
        return await super.performActivation(extractedData, license, order);
    }

    formatSuccessMessage(activationResult, license) {
        let message = '🎉 *${productName.toUpperCase()} ATIVADO!*\\n\\n';
        message += '🔑 *Chave:* \`' + license.key + '\`\\n';
        message += '📅 *Válida até:* ' + new Date(license.expiresAt).toLocaleDateString('pt-BR') + '\\n\\n';
        message += '✅ Produto ativado com sucesso!\\n';
        message += '🔄 Digite *menu* para nova ativação';
        return message;
    }
}

function createActivator(config = {}) {
    return new ${productName.replace(/[^a-zA-Z0-9]/g, '')}Activator(config);
}

module.exports = {
    ${productName.replace(/[^a-zA-Z0-9]/g, '')}Activator,
    createActivator
};
`;

            const filePath = path.join(this.modulesDir, `module_${moduleId}.js`);
            await fs.writeFile(filePath, template);
            
            this.logger.info(`📝 Template criado: ${filePath}`);
            
            // Recarregar módulos para incluir o novo
            await this.loadModules();
            
            return {
                success: true,
                filePath: filePath,
                moduleId: moduleId
            };
            
        } catch (error) {
            this.logger.error('❌ Erro ao criar template:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = ActivationManager;
