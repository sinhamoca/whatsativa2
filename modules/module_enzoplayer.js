// module_enzoplayer.js - Módulo de Ativação Enzo Player (ATUALIZADO)
const axios = require('axios');

const ENZO_PLAYER_CONFIG = {
    baseUrl: 'http://5.78.41.191',
    endpoints: {
        login: '/api/auth/login',
        activate: '/api/enzoplayer/activate'
    },
    credentials: {
        email: '1235646544865312@gmail.com',
        password: '1235646544865312@gmail.com'
    },
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
};

class EnzoPlayerActivator {
    constructor(config = {}) {
        this.config = {
            name: 'Enzo Player',
            version: '1.0.0',
            ...config
        };
        console.log('[Enzo Player] 🔧 Iniciado com configuração personalizada');
    }

    /**
     * Calcular data de validade (hoje + 1 ano)
     */
    calculateExpirationDate() {
        const today = new Date();
        const expirationDate = new Date(today);
        expirationDate.setFullYear(today.getFullYear() + 1); // Adiciona 1 ano
        
        return expirationDate.toLocaleDateString('pt-BR'); // Formato: dd/mm/aaaa
    }

    async loginEnzoPlayer() {
        try {
            console.log('🔐 Enzo Player: Fazendo login...');
            
            const loginUrl = `${ENZO_PLAYER_CONFIG.baseUrl}${ENZO_PLAYER_CONFIG.endpoints.login}`;
            
            const response = await axios.post(loginUrl, {
                email: ENZO_PLAYER_CONFIG.credentials.email,
                password: ENZO_PLAYER_CONFIG.credentials.password
            }, {
                headers: ENZO_PLAYER_CONFIG.headers,
                timeout: ENZO_PLAYER_CONFIG.timeout
            });

            if (response.status === 200 && response.data?.token) {
                console.log('✅ Enzo Player: Login realizado com sucesso');
                console.log(`👤 Usuário: ${response.data.name} (${response.data.role})`);
                return response.data.token;
            } else {
                throw new Error('Login falhou: Resposta inválida da API');
            }
            
        } catch (error) {
            console.error('❌ Enzo Player: Erro no login:', error.message);
            throw new Error(`Falha no login Enzo Player: ${error.message}`);
        }
    }

    async activateDevice(token, macAddress) {
        try {
            console.log(`⚡ Enzo Player: Ativando dispositivo ${macAddress}...`);
            
            const activateUrl = `${ENZO_PLAYER_CONFIG.baseUrl}${ENZO_PLAYER_CONFIG.endpoints.activate}`;
            
            const response = await axios.post(activateUrl, {
                mac_address: macAddress
            }, {
                headers: {
                    ...ENZO_PLAYER_CONFIG.headers,
                    'Authorization': `Bearer ${token}`
                },
                timeout: ENZO_PLAYER_CONFIG.timeout
            });

            console.log('📋 Enzo Player: Resposta da ativação:', response.data);
            
            return {
                success: response.data.success || false,
                message: response.data.message || 'Resposta sem mensagem',
                httpStatus: response.status
            };
            
        } catch (error) {
            console.error('❌ Enzo Player: Erro na ativação:', error.message);
            
            if (error.response?.data) {
                console.log('📋 Enzo Player: Dados da resposta de erro:', error.response.data);
                return {
                    success: false,
                    message: error.response.data.message || `Erro HTTP ${error.response.status}`,
                    httpStatus: error.response.status,
                    error: true
                };
            }
            
            throw new Error(`Falha na ativação Enzo Player: ${error.message}`);
        }
    }

    formatMacAddress(macAddress) {
        if (!macAddress) return '';
        
        let formatted = macAddress.trim().toUpperCase();
        
        if (formatted.length === 12 && !formatted.includes(':') && !formatted.includes('-')) {
            formatted = formatted.match(/.{2}/g).join(':');
        }
        
        formatted = formatted.replace(/-/g, ':');
        return formatted;
    }

    isValidMacAddress(macAddress) {
        if (!macAddress || typeof macAddress !== 'string') {
            return false;
        }
        const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
        return macRegex.test(macAddress.trim());
    }

    async activate(activationData, order = null) {
        const startTime = Date.now();
        
        try {
            console.log('🚀 Enzo Player: Iniciando processo de ativação...');
            console.log('📥 Dados recebidos:', activationData);
            
            if (!activationData) {
                throw new Error('MAC Address não fornecido');
            }
            
            const macAddress = this.formatMacAddress(activationData);
            
            if (!this.isValidMacAddress(macAddress)) {
                throw new Error(`MAC Address inválido: ${activationData}. Use formato XX:XX:XX:XX:XX:XX`);
            }
            
            console.log(`📱 MAC Address formatado: ${macAddress}`);
            
            const token = await this.loginEnzoPlayer();
            const activationResult = await this.activateDevice(token, macAddress);
            
            const duration = Date.now() - startTime;
            console.log(`⏱️ Enzo Player: Processo concluído em ${duration}ms`);
            
            const isSuccess = activationResult.success === true;
            
            if (isSuccess) {
                // ✅ NOVA MENSAGEM COM DATA DE VALIDADE
                const validUntil = this.calculateExpirationDate();
                
                return {
                    success: true,
                    result: `✅ Enzo Player ativado com sucesso!

📱 Dispositivo: ${macAddress}
📋 Status: ${activationResult.message}
📅 VÁLIDO: ${validUntil}`
                };
            } else {
                return {
                    success: false,
                    result: `❌ Falha na ativação Enzo Player

📱 Dispositivo: ${macAddress}
⚠️ Motivo: ${activationResult.message}

💡 Verifique se o MAC Address está correto e tente novamente.`,
                    error: activationResult.message
                };
            }
            
        } catch (error) {
            return {
                success: false,
                result: `💥 Erro na ativação Enzo Player

⚠️ ${error.message}

🔧 Entre em contato com o suporte se o problema persistir.`,
                error: error.message
            };
        }
    }

    async test() {
        console.log('🧪 Enzo Player: Executando teste do módulo...');
        
        try {
            const token = await this.loginEnzoPlayer();
            
            return {
                success: true,
                message: 'Módulo Enzo Player funcionando corretamente',
                details: {
                    baseUrl: ENZO_PLAYER_CONFIG.baseUrl,
                    tokenReceived: !!token
                }
            };
            
        } catch (error) {
            return {
                success: false,
                message: `Erro no teste Enzo Player: ${error.message}`,
                error: error.message
            };
        }
    }
}

function createActivator(config = {}) {
    return new EnzoPlayerActivator(config);
}

module.exports = {
    EnzoPlayerActivator,
    createActivator
};
