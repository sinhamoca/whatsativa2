// modules/module_dreamtv.js - Módulo de Ativação DreamTV
const axios = require('axios');

class DreamTVActivator {
    constructor(config = {}) {
        this.config = {
            name: 'DreamTV',
            version: '1.0.1',
            baseUrl: 'https://api.dreamtv.life',
            email: config.email || 'isaacdopanta@gmail.com',
            password: config.password || '10203040',
            defaultPackageId: config.defaultPackageId || 3,
            timeout: config.timeout || 15000,
            ...config
        };
        
        this.accessToken = null;
        this.stats = {
            activations: 0,
            successes: 0,
            failures: 0
        };
        
        // Configurar axios
        this.api = axios.create({
            baseURL: this.config.baseUrl,
            timeout: this.config.timeout,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
    }

    /**
     * 🔐 Fazer login e obter token JWT
     */
    async login() {
        try {
            console.log('🔐 Fazendo login no DreamTV...');
            
            const response = await this.api.post('/reseller/login', {
                email: this.config.email,
                password: this.config.password
            });

            if (response.data.error === false && response.data.message) {
                this.accessToken = response.data.message;
                console.log('✅ Login realizado com sucesso');
                return { success: true, token: this.accessToken };
            } else {
                throw new Error('Resposta de login inválida');
            }

        } catch (error) {
            console.error('❌ Erro no login:', error.message);
            return {
                success: false,
                error: 'Erro no login DreamTV',
                details: error.response?.data || error.message
            };
        }
    }

    /**
     * 📱 Ativar dispositivo - MÉTODO PRINCIPAL CORRIGIDO
     */
    async activateDevice(macAddress, packageId = null, order = {}) {
        try {
            // Validar MAC address
            if (!this.isValidMacAddress(macAddress)) {
                return {
                    success: false,
                    error: 'MAC address inválido',
                    details: 'Formato deve ser XX:XX:XX:XX:XX:XX'
                };
            }

            // Fazer login se necessário
            if (!this.accessToken) {
                const loginResult = await this.login();
                if (!loginResult.success) {
                    return loginResult;
                }
            }

            // Normalizar MAC address (manter formato com dois pontos)
            const normalizedMac = this.normalizeMacAddress(macAddress);
            const finalPackageId = packageId || this.config.defaultPackageId;

            console.log(`📡 Ativando: ${normalizedMac} com pacote ${finalPackageId}`);

            // CORREÇÃO PRINCIPAL: Usar endpoint correto com Bearer token
            const response = await this.api.post('/reseller/activate', {
                mac: normalizedMac,
                package_id: finalPackageId
            }, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`, // ✅ CORREÇÃO: Bearer token
                    'Content-Type': 'application/json'
                }
            });

            // CORREÇÃO: Status de sucesso é 201 (não 200)
            if (response.status === 201 && response.data.error === false) {
                console.log('✅ Dispositivo ativado com sucesso');
                
                this.stats.successes++;
                
                return {
                    success: true,
                    message: 'Dispositivo ativado com sucesso',
                    data: {
                        mac: normalizedMac,
                        packageId: finalPackageId,
                        response: response.data,
                        // Dados reais da API
                        deviceId: response.data.message.device_id,
                        activationId: response.data.message.id,
                        activatedUntil: response.data.message.activated_until,
                        packageName: response.data.message.package_name,
                        price: response.data.message.price
                    }
                };
            } else {
                throw new Error(`Status inesperado: ${response.status}`);
            }

        } catch (error) {
            console.error('❌ Erro na ativação:', error.message);
            
            this.stats.failures++;
            
            // Verificar se é erro de token expirado
            if (error.response?.status === 401) {
                console.log('🔄 Token expirado, tentando renovar...');
                this.accessToken = null;
                
                // Tentar uma vez mais
                const loginResult = await this.login();
                if (loginResult.success) {
                    return await this.activateDevice(macAddress, packageId, order);
                }
            }

            return {
                success: false,
                error: 'Erro na ativação DreamTV',
                details: error.response?.data || error.message
            };
        }
    }

    /**
     * 📝 Método principal de ativação (interface padrão)
     */
    async activate(activationData, order = {}) {
        try {
            this.stats.activations++;
            
            // Extrair dados necessários
            const { macAddress, packageId } = this.extractActivationData(activationData);
            
            // Executar ativação
            const result = await this.activateDevice(macAddress, packageId, order);
            
            if (result.success) {
                return {
                    success: true,
                    result: this.formatSuccessMessage(result, order), // ✅ Mantido 'result' como no original
                    data: result.data
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    message: this.formatErrorMessage(result.error)
                };
            }

        } catch (error) {
            console.error('❌ Erro geral na ativação:', error);
            return {
                success: false,
                error: 'Erro interno',
                details: error.message
            };
        }
    }

    /**
     * 📊 Extrair dados de ativação
     */
    extractActivationData(activationData) {
        let macAddress = null;
        let packageId = this.config.defaultPackageId;

        if (typeof activationData === 'string') {
            // Se é uma string, assumir que é o MAC address
            macAddress = activationData;
        } else if (typeof activationData === 'object') {
            macAddress = activationData.macAddress || 
                        activationData.mac || 
                        activationData.serial || 
                        activationData.device_id;
            packageId = activationData.packageId || 
                       activationData.package_id || 
                       packageId;
        }

        return { macAddress, packageId };
    }

    /**
     * 📦 Obter informações do pacote
     */
    getPackageInfo(packageId) {
        const packages = {
            1: { name: 'Mensal', days: 30 },
            2: { name: 'Trimestral', days: 90 },
            3: { name: 'Anual', days: 365 }
        };
        
        return packages[packageId] || packages[3]; // Padrão anual
    }

    /**
     * ✅ Formatar mensagem de sucesso - MELHORADA
     */
    formatSuccessMessage(result, order = {}) {
        // Usar dados reais da API quando disponíveis
        const activatedUntil = result.data.activatedUntil ? 
            new Date(result.data.activatedUntil) : 
            new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)); // 1 ano default
            
        const dataAtual = new Date();
        const dataAtivacao = dataAtual.toLocaleDateString('pt-BR');
        const dataExpiracao = activatedUntil.toLocaleDateString('pt-BR');
        
        let message = '🎉 *DREAMTV ATIVADO COM SUCESSO!*\n\n';
        message += '📺 *Plataforma:* DreamTV Premium\n';
        message += '📱 *MAC Ativado:* `' + result.data.mac + '`\n';
        message += '📅 *Data Ativação:* ' + dataAtivacao + '\n';
        message += '⏰ *Válido até:* ' + dataExpiracao + '\n';
        
        // Usar nome real do pacote da API se disponível
        if (result.data.packageName) {
            message += '📦 *Pacote:* ' + result.data.packageName + '\n';
        } else {
            const packageInfo = this.getPackageInfo(result.data.packageId);
            message += '📦 *Pacote:* ' + packageInfo.name + ' (' + packageInfo.days + ' dias)\n';
        }
        
        // Mostrar preço se disponível
        if (result.data.price) {
            message += '💰 *Valor:* R$ ' + result.data.price + '\n';
        }
        
        message += '\n🔥 *Seu DreamTV está pronto para usar!*\n\n';
        message += '🔄 Digite *menu* para nova ativação';
        
        return message;
    }

    /**
     * ❌ Formatar mensagem de erro
     */
    formatErrorMessage(error) {
        let message = '❌ *ERRO NA ATIVAÇÃO DREAMTV*\n\n';
        message += '🚨 *Motivo:* ' + error + '\n\n';
        message += '💡 *Soluções:*\n';
        message += '• Verifique o MAC address\n';
        message += '• Tente novamente em alguns minutos\n';
        message += '• Entre em contato com o suporte\n\n';
        message += '🔄 Digite *menu* para tentar novamente';
        
        return message;
    }

    /**
     * 🧪 Método de teste - MELHORADO
     */
    async test() {
        try {
            console.log('🧪 Iniciando teste do DreamTV...');
            
            // Teste 1: Login
            console.log('🔐 Testando login...');
            const loginResult = await this.login();
            if (!loginResult.success) {
                return {
                    success: false,
                    error: 'Falha no teste de login',
                    details: loginResult.error
                };
            }

            // Teste 2: Ativação com MAC realista (não 00:00:00:00:00:00)
            console.log('📡 Testando ativação com MAC válido...');
            const testMac = 'aa:bb:cc:dd:ee:ff'; // MAC mais realista
            const activationResult = await this.activateDevice(testMac);
            
            console.log('📊 Resultado da ativação de teste:', activationResult);
            
            return {
                success: true,
                message: 'Teste concluído com sucesso',
                tests: {
                    login: loginResult.success,
                    activation: activationResult.success,
                    token: !!this.accessToken
                }
            };

        } catch (error) {
            return {
                success: false,
                error: 'Erro no teste',
                details: error.message
            };
        }
    }

    /**
     * 🔧 Validar MAC address
     */
    isValidMacAddress(mac) {
        if (!mac || typeof mac !== 'string') return false;
        
        // Remover espaços e converter para maiúscula
        mac = mac.trim().toUpperCase();
        
        // Aceitar formatos: XX:XX:XX:XX:XX:XX, XX-XX-XX-XX-XX-XX, XXXXXXXXXXXX
        const patterns = [
            /^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/, // XX:XX:XX:XX:XX:XX ou XX-XX-XX-XX-XX-XX
            /^[0-9A-F]{12}$/ // XXXXXXXXXXXX
        ];
        
        return patterns.some(pattern => pattern.test(mac));
    }

    /**
     * 🔧 Normalizar MAC address - CORRIGIDO
     */
    normalizeMacAddress(mac) {
        if (!mac) return 'aa:bb:cc:dd:ee:ff'; // MAC realista para teste
        
        // Remover espaços e converter para MINÚSCULA (API prefere)
        let normalized = mac.trim().toLowerCase();
        
        // Se não tem separadores, adicionar
        if (normalized.length === 12 && !normalized.includes(':') && !normalized.includes('-')) {
            normalized = normalized.match(/.{2}/g).join(':');
        }
        
        // Converter separadores para dois pontos
        normalized = normalized.replace(/-/g, ':');
        
        // ✅ MANTER formato com dois pontos (não remover!)
        return normalized;
    }

    /**
     * 📊 Obter estatísticas
     */
    getStats() {
        return {
            ...this.stats,
            successRate: this.stats.activations > 0 
                ? ((this.stats.successes / this.stats.activations) * 100).toFixed(2) + '%'
                : '0%',
            hasToken: !!this.accessToken
        };
    }

    /**
     * 🔄 Resetar token (forçar novo login)
     */
    resetToken() {
        this.accessToken = null;
        console.log('🔄 Token resetado');
    }
}

/**
 * Função de fábrica para criar instância
 */
function createActivator(config = {}) {
    return new DreamTVActivator(config);
}

// Exportar
module.exports = {
    DreamTVActivator,
    createActivator
};

// Teste direto se executado
if (require.main === module) {
    const activator = createActivator();
    activator.test().then(result => {
        console.log('\n=== RESULTADO DO TESTE DREAMTV ===');
        console.log('Status:', result.success ? '✅ SUCESSO' : '❌ FALHA');
        if (result.success) {
            console.log('Testes:', result.tests);
        } else {
            console.log('Erro:', result.error);
            console.log('Detalhes:', result.details);
        }
        console.log('Estatísticas:', activator.getStats());
        console.log('=================================\n');
    }).catch(error => {
        console.error('❌ Erro no teste:', error);
    });
}
