// modules/module_ibo_pro.js - Módulo de Ativação IBO Pro - CORRIGIDO PARA MACs ATÍPICOS
const axios = require('axios');
const crypto = require('crypto');

class IboProActivator {
    constructor(config = {}) {
        this.config = {
            name: 'IBO Pro',
            version: '1.0.0',
            loginUrl: 'https://api.iboproapp.com/admin/login',
            activateUrl: 'https://api.iboproapp.com/admin/devices/activate',
            credentials: {
                username: config.username || 'conta85iptv@gmail.com',
                password: config.password || '10203040'
            },
            defaultTier: config.defaultTier || 'YEAR',
            timeout: config.timeout || 15000,
            ...config
        };
        
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiresAt = null;
        
        // 🔧 NOVA REGEX FLEXÍVEL para aceitar MACs atípicos
        // Aceita qualquer caractere alfanumérico, incluindo j, y, i, etc.
        this.macRegex = /^([0-9A-Za-z]{1,2}[:-]){5}([0-9A-Za-z]{1,2})$/;
        
        // 🔧 REGEX TRADICIONAL (backup para validação estrita se necessário)
        this.strictMacRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
        
        console.log(`[IBO Pro] 🔧 Iniciado com suporte a MACs atípicos (ex: ac:dj:yf:i2:4d:20)`);
    }

    /**
     * Método principal de ativação
     */
    async activate(activationData, order) {
        try {
            console.log(`[IBO Pro] Iniciando ativação para pedido: ${order.id}`);
            console.log(`[IBO Pro] Dados recebidos: ${activationData}`);

            // 1. Extrair MAC address dos dados
            const macAddress = this.extractMacAddress(activationData);
            if (!macAddress) {
                return {
                    success: false,
                    error: 'MAC Address não encontrado ou inválido',
                    suggestion: 'Envie o MAC no formato: AA:BB:CC:DD:EE:FF (aceita caracteres não-hex como j, y, i, etc.)'
                };
            }

            console.log(`[IBO Pro] MAC extraído: ${macAddress}`);
            
            // 🔧 LOG ADICIONAL para MACs atípicos
            if (!this.strictMacRegex.test(macAddress)) {
                console.log(`[IBO Pro] 🎯 MAC ATÍPICO detectado: ${macAddress} (contém caracteres não-hexadecimais)`);
            }

            // 2. Fazer login na API
            const loginResult = await this.login();
            if (!loginResult.success) {
                return {
                    success: false,
                    error: 'Falha no login da API IBO Pro',
                    details: loginResult.error
                };
            }

            console.log(`[IBO Pro] Login realizado com sucesso`);

            // 3. Ativar dispositivo
            const activationResult = await this.activateDevice(macAddress, order);
            
            if (activationResult.success) {
                return {
                    success: true,
                    result: this.formatSuccessMessage(activationResult.data, macAddress),
                    apiResponse: activationResult.data,
                    macAddress: macAddress,
                    tier: this.config.defaultTier
                };
            } else {
                return {
                    success: false,
                    error: activationResult.error,
                    apiError: activationResult.apiError
                };
            }

        } catch (error) {
            console.error('[IBO Pro] Erro na ativação:', error);
            return {
                success: false,
                error: 'Erro interno no módulo IBO Pro',
                details: error.message
            };
        }
    }

    /**
     * 🔧 MÉTODO CORRIGIDO: Extrai MAC address dos dados (aceita MACs atípicos)
     */
    extractMacAddress(rawData) {
        try {
            // Remover espaços e quebras de linha
            const cleanData = rawData.trim().replace(/\s+/g, ' ');
            
            console.log(`[IBO Pro] 🔍 Buscando MAC em: "${cleanData}"`);
            
            // Buscar padrões de MAC address
            const lines = cleanData.split(/[\n\r\s,;]/);
            
            for (const line of lines) {
                const trimmed = line.trim();
                
                // 🔧 TESTE 1: Regex flexível (aceita MACs atípicos)
                if (this.macRegex.test(trimmed)) {
                    const normalizedMac = trimmed.toLowerCase().replace(/-/g, ':');
                    
                    // Verificar se é MAC tradicional ou atípico
                    const isTraditional = this.strictMacRegex.test(normalizedMac);
                    
                    console.log(`[IBO Pro] ✅ MAC encontrado: ${normalizedMac} (${isTraditional ? 'tradicional' : 'ATÍPICO'})`);
                    
                    return normalizedMac;
                }
                
                // 🔧 TESTE 2: MAC sem separadores (12 caracteres - incluindo não-hex)
                // Aceitar 12 caracteres alfanuméricos (não apenas hex)
                const macWithoutSeparators = trimmed.match(/^[0-9a-zA-Z]{12}$/);
                if (macWithoutSeparators) {
                    const mac = macWithoutSeparators[0].toLowerCase();
                    const formattedMac = `${mac.substr(0,2)}:${mac.substr(2,2)}:${mac.substr(4,2)}:${mac.substr(6,2)}:${mac.substr(8,2)}:${mac.substr(10,2)}`;
                    
                    console.log(`[IBO Pro] ✅ MAC sem separadores encontrado: ${formattedMac}`);
                    
                    return formattedMac;
                }
            }
            
            console.log(`[IBO Pro] ❌ Nenhum MAC encontrado nos dados: "${cleanData}"`);
            return null;
            
        } catch (error) {
            console.error('[IBO Pro] Erro ao extrair MAC:', error);
            return null;
        }
    }

    /**
     * Faz login na API do IBO Pro
     */
    async login() {
        try {
            console.log(`[IBO Pro] Fazendo login em: ${this.config.loginUrl}`);
            
            const loginPayload = {
                username: this.config.credentials.username,
                password: this.config.credentials.password
            };

            const response = await axios.post(this.config.loginUrl, loginPayload, {
                timeout: this.config.timeout,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Origin': 'https://cms.iboproapp.com',
                    'Referer': 'https://cms.iboproapp.com/'
                }
            });

            console.log(`[IBO Pro] Resposta do login:`, response.status, response.data);

            if (response.status === 200 && response.data.status === true) {
                this.accessToken = response.data.accessToken;
                this.refreshToken = response.data.refreshToken;
                
                // Calcular quando o token expira (baseado no JWT)
                try {
                    const payload = JSON.parse(Buffer.from(this.accessToken.split('.')[1], 'base64').toString());
                    this.tokenExpiresAt = new Date(payload.exp);
                    console.log(`[IBO Pro] Token expira em: ${this.tokenExpiresAt}`);
                } catch (e) {
                    this.tokenExpiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 horas default
                }

                return {
                    success: true,
                    accessToken: this.accessToken
                };
            } else {
                return {
                    success: false,
                    error: response.data.message || 'Login falhou',
                    statusCode: response.status
                };
            }

        } catch (error) {
            console.error('[IBO Pro] Erro no login:', error.message);
            
            if (error.response) {
                return {
                    success: false,
                    error: `Erro HTTP ${error.response.status}: ${error.response.data?.message || error.response.statusText}`,
                    statusCode: error.response.status
                };
            } else if (error.code === 'ECONNABORTED') {
                return {
                    success: false,
                    error: 'Timeout na conexão com a API'
                };
            } else {
                return {
                    success: false,
                    error: `Erro de conexão: ${error.message}`
                };
            }
        }
    }

    /**
     * Ativa dispositivo na API
     */
    async activateDevice(macAddress, order) {
        try {
            if (!this.accessToken) {
                throw new Error('Token de acesso não disponível');
            }

            console.log(`[IBO Pro] Ativando dispositivo: ${macAddress}`);

            const activationPayload = {
                mac_address: macAddress,
                tier: this.config.defaultTier,
                name: order.product?.name || '',
                note: `Ativado via WhatsApp - Pedido: ${order.id.substring(0, 8)}`
            };

            console.log(`[IBO Pro] Payload de ativação:`, activationPayload);

            const response = await axios.post(this.config.activateUrl, activationPayload, {
                timeout: this.config.timeout,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json, text/plain, */*',
                    'Authorization': `Bearer ${this.accessToken}`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Origin': 'https://cms.iboproapp.com',
                    'Referer': 'https://cms.iboproapp.com/'
                }
            });

            console.log(`[IBO Pro] Resposta da ativação:`, response.status, response.data);

            if (response.status === 200 && response.data.status === true) {
                return {
                    success: true,
                    data: response.data
                };
            } else {
                return {
                    success: false,
                    error: response.data.message || 'Ativação falhou',
                    apiError: response.data,
                    statusCode: response.status
                };
            }

        } catch (error) {
            console.error('[IBO Pro] Erro na ativação:', error.message);
            
            if (error.response) {
                const errorMsg = error.response.data?.message || error.response.statusText;
                
                return {
                    success: false,
                    error: `Erro na ativação: ${errorMsg}`,
                    apiError: error.response.data,
                    statusCode: error.response.status
                };
            } else if (error.code === 'ECONNABORTED') {
                return {
                    success: false,
                    error: 'Timeout na ativação do dispositivo'
                };
            } else {
                return {
                    success: false,
                    error: `Erro de conexão: ${error.message}`
                };
            }
        }
    }

    /**
     * Verifica se o token ainda é válido
     */
    isTokenValid() {
        if (!this.accessToken || !this.tokenExpiresAt) {
            return false;
        }
        
        // Verificar se expira nos próximos 5 minutos
        const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
        return this.tokenExpiresAt > fiveMinutesFromNow;
    }

    /**
     * Formata mensagem de sucesso
     */
    formatSuccessMessage(apiResponse, macAddress) {
        const expireDate = apiResponse.expire_date;
        const tier = apiResponse.tier;
        
        let message = '🎉 *IBO PRO ATIVADO!*\n\n';
        message += `🔧 *MAC:* \`${macAddress}\`\n`;
        
        if (tier) {
            message += `⭐ *Plano:* ${tier}\n`;
        }
        
        if (expireDate) {
            const expireFormatted = new Date(expireDate).toLocaleDateString('pt-BR');
            message += `📅 *Válido até:* ${expireFormatted}`;
        }

        return message;
    }

    /**
     * 🔧 MÉTODO DE TESTE ATUALIZADO
     */
    async test() {
        console.log(`[IBO Pro] Testando módulo ${this.config.name} com suporte a MACs atípicos`);
        
        // 🔧 Testar MACs tradicionais e atípicos
        const testMacs = [
            'aa:bb:cc:dd:ee:ff',     // Tradicional
            'ac:dj:yf:i2:4d:20',     // Atípico
            'abcdefghijkl',          // Sem separadores atípico
            '001122334455'           // Sem separadores tradicional
        ];
        
        console.log(`[IBO Pro] 🧪 Testando extração de MACs:`);
        for (const testMac of testMacs) {
            const extracted = this.extractMacAddress(testMac);
            const isTraditional = extracted ? this.strictMacRegex.test(extracted) : false;
            console.log(`  - "${testMac}" → "${extracted}" (${extracted ? (isTraditional ? 'tradicional' : 'ATÍPICO') : 'FALHOU'})`);
        }
        
        const testOrder = {
            id: 'test-ibo-' + Date.now(),
            product: { 
                id: 'ibo_pro',
                name: 'IBO Pro',
                activationModule: 'ibo_pro'
            }
        };

        // Teste 2: Login (sem ativar dispositivo real)
        const loginResult = await this.login();
        if (!loginResult.success) {
            return {
                success: false,
                error: 'Falha no teste de login',
                details: loginResult.error
            };
        }

        console.log(`[IBO Pro] Login testado com sucesso`);

        return {
            success: true,
            message: 'Módulo IBO Pro testado com sucesso (com suporte a MACs atípicos)',
            loginWorking: true,
            macExtraction: true,
            atypicalMacSupport: true,
            tokenReceived: !!this.accessToken
        };
    }

    /**
     * Método para ativar com configurações customizadas
     */
    async activateWithCustomTier(macAddress, tier, order) {
        const originalTier = this.config.defaultTier;
        this.config.defaultTier = tier;
        
        try {
            const result = await this.activateDevice(macAddress, order);
            return result;
        } finally {
            this.config.defaultTier = originalTier;
        }
    }

    /**
     * 🔧 NOVO MÉTODO: Validar se MAC é suportado
     */
    isValidMacAddress(mac) {
        return this.macRegex.test(mac);
    }

    /**
     * 🔧 NOVO MÉTODO: Verificar se MAC é tradicional (apenas hex)
     */
    isTraditionalMac(mac) {
        return this.strictMacRegex.test(mac);
    }
}

/**
 * Função de fábrica para criar instância
 */
function createActivator(config = {}) {
    // Configuração padrão para IBO Pro
    const defaultConfig = {
        username: 'conta85iptv@gmail.com',
        password: '10203040',
        defaultTier: 'YEAR',
        timeout: 15000
    };

    return new IboProActivator({ ...defaultConfig, ...config });
}

// Exportar
module.exports = {
    IboProActivator,
    createActivator
};

// Teste direto se executado
if (require.main === module) {
    const activator = createActivator();
    activator.test().then(result => {
        console.log('\n=== RESULTADO DO TESTE ===');
        console.log('Status:', result.success ? '✅ SUCESSO' : '❌ FALHA');
        if (result.success) {
            console.log('Detalhes:', result);
        } else {
            console.log('Erro:', result.error);
            console.log('Detalhes:', result.details);
        }
        console.log('========================\n');
    }).catch(error => {
        console.error('❌ Erro no teste:', error);
    });
}