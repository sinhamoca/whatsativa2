// module_vuplayer.js - Módulo de Ativação VU Player (ATUALIZADO)
const axios = require('axios');

const VU_PLAYER_CONFIG = {
    baseUrl: 'http://5.78.41.191',
    endpoints: {
        login: '/api/auth/login',
        activate: '/api/vuplayer/activate'
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

class VuPlayerActivator {
    constructor(config = {}) {
        this.config = {
            name: 'VU Player',
            version: '1.0.0',
            ...config
        };
        console.log('[VU Player] 🔧 Iniciado com configuração personalizada');
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

    async loginVuPlayer() {
        try {
            console.log('🔐 VU Player: Fazendo login...');
            
            const loginUrl = `${VU_PLAYER_CONFIG.baseUrl}${VU_PLAYER_CONFIG.endpoints.login}`;
            
            const response = await axios.post(loginUrl, {
                email: VU_PLAYER_CONFIG.credentials.email,
                password: VU_PLAYER_CONFIG.credentials.password
            }, {
                headers: VU_PLAYER_CONFIG.headers,
                timeout: VU_PLAYER_CONFIG.timeout
            });

            if (response.status === 200 && response.data?.token) {
                console.log('✅ VU Player: Login realizado com sucesso');
                return response.data.token;
            } else {
                throw new Error('Login falhou: Resposta inválida da API');
            }
            
        } catch (error) {
            console.error('❌ VU Player: Erro no login:', error.message);
            throw new Error(`Falha no login VU Player: ${error.message}`);
        }
    }

    async activateDevice(token, macAddress) {
        try {
            console.log(`⚡ VU Player: Ativando dispositivo ${macAddress}...`);
            
            const activateUrl = `${VU_PLAYER_CONFIG.baseUrl}${VU_PLAYER_CONFIG.endpoints.activate}`;
            
            const response = await axios.post(activateUrl, {
                mac_address: macAddress
            }, {
                headers: {
                    ...VU_PLAYER_CONFIG.headers,
                    'Authorization': `Bearer ${token}`
                },
                timeout: VU_PLAYER_CONFIG.timeout
            });

            return {
                success: response.data.success || false,
                message: response.data.message || 'Resposta sem mensagem',
                httpStatus: response.status
            };
            
        } catch (error) {
            console.error('❌ VU Player: Erro na ativação:', error.message);
            
            if (error.response?.data) {
                return {
                    success: false,
                    message: error.response.data.message || `Erro HTTP ${error.response.status}`,
                    httpStatus: error.response.status,
                    error: true
                };
            }
            
            throw new Error(`Falha na ativação VU Player: ${error.message}`);
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
            console.log('🚀 VU Player: Iniciando processo de ativação...');
            
            if (!activationData) {
                throw new Error('MAC Address não fornecido');
            }
            
            const macAddress = this.formatMacAddress(activationData);
            
            if (!this.isValidMacAddress(macAddress)) {
                throw new Error(`MAC Address inválido: ${activationData}. Use formato XX:XX:XX:XX:XX:XX`);
            }
            
            const token = await this.loginVuPlayer();
            const activationResult = await this.activateDevice(token, macAddress);
            
            const duration = Date.now() - startTime;
            console.log(`⏱️ VU Player: Processo concluído em ${duration}ms`);
            
            const isSuccess = activationResult.success === true;
            
            if (isSuccess) {
                // ✅ NOVA MENSAGEM COM DATA DE VALIDADE
                const validUntil = this.calculateExpirationDate();
                
                return {
                    success: true,
                    result: `✅ VU Player ativo!

📱 Dispositivo: ${macAddress}
📋 Status: ${activationResult.message}
📅 Válido: ${validUntil}`
                };
            } else {
                return {
                    success: false,
                    result: `❌ Falha na ativação VU Player

📱 Dispositivo: ${macAddress}
⚠️ Motivo: ${activationResult.message}

💡 Verifique se o MAC Address está correto e tente novamente.`,
                    error: activationResult.message
                };
            }
            
        } catch (error) {
            return {
                success: false,
                result: `💥 Erro na ativação VU Player

⚠️ ${error.message}

🔧 Entre em contato com o suporte se o problema persistir.`,
                error: error.message
            };
        }
    }

    async test() {
        try {
            const token = await this.loginVuPlayer();
            return {
                success: true,
                message: 'Módulo VU Player funcionando corretamente',
                details: {
                    baseUrl: VU_PLAYER_CONFIG.baseUrl,
                    tokenReceived: !!token
                }
            };
        } catch (error) {
            return {
                success: false,
                message: `Erro no teste VU Player: ${error.message}`,
                error: error.message
            };
        }
    }
}

function createActivator(config = {}) {
    return new VuPlayerActivator(config);
}

module.exports = {
    VuPlayerActivator,
    createActivator
};
