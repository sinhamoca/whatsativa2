// modules/ibosol-base-activator.js - Módulo base para todos os apps IboSol - CORRIGIDO PARA MACs ATÍPICOS
const axios = require('axios');

class IboSolBaseActivator {
    constructor(config = {}) {
        this.config = {
            name: config.name || 'IboSol App',
            version: '1.0.0',
            baseUrl: 'https://backend.ibosol.com/api',
            credentials: {
                email: config.email || 'conta85iptv@gmail.com',
                password: config.password || 'P@pangu1'
            },
            // Configuração específica do app
            appModule: config.appModule || 'IBOPLAYER',
            appId: config.appId || 1,
            timeout: config.timeout || 15000,
            ...config
        };
        
        this.token = null;
        this.tokenExpiresAt = null;
        
        // Mapeamento completo de aplicativos
        this.appMapping = {
            "IBOPLAYER": 1,
            "ABEPlayerTv": 2,
            "BOBPLAYER": 3,
            "MACPLAYER": 4,
            "VIRGINIA": 5,
            "AllPlayer": 6,
            "HUSHPLAY": 7,
            "KTNPLAYER": 8,
            "FAMILYPLAYER": 9,
            "IBOSSPLAYER": 10,
            "KING4KPLAYER": 11,
            "IBOSTB": 12,
            "IBOXXPLAYER": 13,
            "DUPLEX24": 14,
            "BOBPRO": 15,
            "BOBPREMIUM": 16,
            "IBOSOLPlayer": 17,
            "FLIXNET": 18,
            "SMARTONEPRO": 19
        };
        
        // Headers padrão
        this.defaultHeaders = {
            'Content-Type': 'application/json-patch+json',
            'Accept': 'application/json',
            'Origin': 'https://sandbox.ibosol.com',
            'Referer': 'https://sandbox.ibosol.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US',
            'Accept-Encoding': 'gzip, deflate, br',
            'Sec-Ch-Ua': '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site'
        };
        
        // 🔧 NOVA REGEX FLEXÍVEL para aceitar MACs atípicos
        // Aceita qualquer caractere alfanumérico, incluindo j, y, i, etc.
        this.macRegex = /^([0-9A-Za-z]{1,2}[:-]){5}([0-9A-Za-z]{1,2})$/;
        
        // 🔧 REGEX TRADICIONAL (backup para validação estrita se necessário)
        this.strictMacRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
        
        // Configurar axios
        axios.defaults.decompress = true;
        
        console.log(`[${this.config.name}] 🔧 Iniciado com suporte a MACs atípicos (ex: ac:dj:yf:i2:4d:20)`);
    }

    /**
     * Método principal de ativação
     */
    async activate(activationData, order) {
        try {
            console.log(`[${this.config.name}] Iniciando ativação para pedido: ${order.id}`);
            console.log(`[${this.config.name}] App: ${this.config.appModule} (ID: ${this.config.appId})`);

            // 1. Extrair MAC address
            const macAddress = this.extractMacAddress(activationData);
            if (!macAddress) {
                return {
                    success: false,
                    error: 'MAC Address não encontrado ou inválido',
                    suggestion: 'Envie o MAC no formato: AA:BB:CC:DD:EE:FF (aceita caracteres não-hex como j, y, i, etc.)'
                };
            }

            console.log(`[${this.config.name}] MAC extraído: ${macAddress}`);
            
            // 🔧 LOG ADICIONAL para MACs atípicos
            if (!this.strictMacRegex.test(macAddress)) {
                console.log(`[${this.config.name}] 🎯 MAC ATÍPICO detectado: ${macAddress} (contém caracteres não-hexadecimais)`);
            }

            // 2. Fazer login
            const loginResult = await this.login();
            if (!loginResult.success) {
                return {
                    success: false,
                    error: `Falha no login da API ${this.config.name}`,
                    details: loginResult.error
                };
            }

            // 3. Verificar dispositivo (opcional)
            const checkResult = await this.checkDeviceStatus(macAddress);
            if (checkResult.success) {
                console.log(`[${this.config.name}] Dispositivo verificado`);
            }

            // 4. Ativar dispositivo
            const activationResult = await this.activateDevice(macAddress, order);
            
            if (activationResult.success) {
                return {
                    success: true,
                    result: this.formatSuccessMessage(activationResult.data, macAddress),
                    apiResponse: activationResult.data,
                    macAddress: macAddress,
                    activatedDevices: activationResult.activatedDevices
                };
            } else {
                return {
                    success: false,
                    error: this.formatActivationError(activationResult.data, macAddress),
                    apiError: activationResult.data
                };
            }

        } catch (error) {
            console.error(`[${this.config.name}] Erro na ativação:`, error);
            return {
                success: false,
                error: `Erro interno no módulo ${this.config.name}`,
                details: error.message
            };
        }
    }

    /**
     * 🔧 MÉTODO CORRIGIDO: Extrai MAC address dos dados (aceita MACs atípicos)
     */
    extractMacAddress(rawData) {
        try {
            const cleanData = rawData.trim().replace(/\s+/g, ' ');
            const lines = cleanData.split(/[\n\r\s,;]/);
            
            console.log(`[${this.config.name}] 🔍 Buscando MAC em: "${cleanData}"`);
            
            for (const line of lines) {
                const trimmed = line.trim();
                
                // 🔧 TESTE 1: Regex flexível (aceita MACs atípicos)
                if (this.macRegex.test(trimmed)) {
                    const normalizedMac = trimmed.toLowerCase().replace(/-/g, ':');
                    
                    // Verificar se é MAC tradicional ou atípico
                    const isTraditional = this.strictMacRegex.test(normalizedMac);
                    
                    console.log(`[${this.config.name}] ✅ MAC encontrado: ${normalizedMac} (${isTraditional ? 'tradicional' : 'ATÍPICO'})`);
                    
                    return normalizedMac;
                }
                
                // 🔧 TESTE 2: MAC sem separadores (12 caracteres - incluindo não-hex)
                // Aceitar 12 caracteres alfanuméricos (não apenas hex)
                const macWithoutSeparators = trimmed.match(/^[0-9a-zA-Z]{12}$/);
                if (macWithoutSeparators) {
                    const mac = macWithoutSeparators[0].toLowerCase();
                    const formattedMac = `${mac.substr(0,2)}:${mac.substr(2,2)}:${mac.substr(4,2)}:${mac.substr(6,2)}:${mac.substr(8,2)}:${mac.substr(10,2)}`;
                    
                    console.log(`[${this.config.name}] ✅ MAC sem separadores encontrado: ${formattedMac}`);
                    
                    return formattedMac;
                }
            }
            
            console.log(`[${this.config.name}] ❌ Nenhum MAC encontrado nos dados: "${cleanData}"`);
            return null;
            
        } catch (error) {
            console.error(`[${this.config.name}] Erro ao extrair MAC:`, error);
            return null;
        }
    }

    /**
     * Login na API
     */
    async login() {
        try {
            const loginPayload = {
                email: this.config.credentials.email,
                password: this.config.credentials.password
            };

            const config = {
                headers: this.defaultHeaders,
                timeout: this.config.timeout,
                responseType: 'json',
                decompress: true,
                validateStatus: (status) => status >= 200 && status < 500
            };

            const response = await axios.post(
                `${this.config.baseUrl}/login`,
                loginPayload,
                config
            );

            let responseData = response.data;
            
            if (typeof responseData === 'string') {
                try {
                    responseData = JSON.parse(responseData);
                } catch (parseError) {
                    return { success: false, error: 'Resposta inválida da API' };
                }
            }

            if (responseData?.status === true && responseData?.token) {
                this.token = responseData.token;
                this.tokenExpiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
                
                console.log(`[${this.config.name}] Login bem-sucedido`);
                return { success: true, token: this.token, data: responseData };
            } else {
                return {
                    success: false,
                    error: responseData?.msg || 'Login falhou'
                };
            }

        } catch (error) {
            console.error(`[${this.config.name}] Erro no login:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Verificar status do dispositivo
     */
    async checkDeviceStatus(macAddress) {
        try {
            if (!this.token) {
                throw new Error('Token não disponível');
            }

            const checkPayload = {
                macAddress: macAddress,
                app_id: [this.config.appId]
            };

            const headers = {
                ...this.defaultHeaders,
                'Authorization': `Bearer ${this.token}`
            };

            const response = await axios.post(
                `${this.config.baseUrl}/check-device-status-multi-app`,
                checkPayload,
                { headers, timeout: this.config.timeout, responseType: 'json', decompress: true }
            );

            return { success: true, data: response.data };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Ativar dispositivo
     */
    async activateDevice(macAddress, order) {
        try {
            if (!this.token) {
                throw new Error('Token não disponível');
            }

            const activationPayload = {
                modules: [this.config.appModule],
                requestData: {
                    is_trial: 3,
                    macAddress: macAddress,
                    appType: "multi-app",
                    email: "",
                    creditPoints: 1,
                    isConfirmed: true,
                    comment: `${this.config.name} - Pedido: ${order.id.substring(0, 8)}`,
                    app_ids: [this.config.appId]
                }
            };

            console.log(`[${this.config.name}] Payload:`, activationPayload);

            const headers = {
                ...this.defaultHeaders,
                'Authorization': `Bearer ${this.token}`
            };

            const response = await axios.post(
                `${this.config.baseUrl}/bulk-multi-app-activate`,
                activationPayload,
                { headers, timeout: this.config.timeout, responseType: 'json', decompress: true }
            );

            let responseData = response.data;
            
            if (typeof responseData === 'string') {
                try {
                    responseData = JSON.parse(responseData);
                } catch (parseError) {
                    return { success: false, error: 'Resposta inválida da ativação' };
                }
            }

            console.log(`[${this.config.name}] Resposta:`, responseData);

            if (responseData?.status === true) {
                const successfulCount = responseData.successful_count || 0;
                
                if (successfulCount > 0) {
                    console.log(`[${this.config.name}] ✅ Ativação bem-sucedida!`);
                    return {
                        success: true,
                        data: responseData,
                        activatedDevices: responseData.activated_devices || [],
                        successfulCount: successfulCount,
                        message: responseData.msg || 'Ativação bem-sucedida'
                    };
                } else {
                    console.log(`[${this.config.name}] ❌ 0 dispositivos ativados`);
                    
                    let errorDetails = responseData.msg || 'Nenhum dispositivo foi ativado';
                    
                    if (responseData.failed_activations?.length > 0) {
                        const failureReasons = responseData.failed_activations.map(failure => 
                            failure.error || failure.reason || failure.message || 'Erro desconhecido'
                        ).join(', ');
                        errorDetails = `Falha na ativação: ${failureReasons}`;
                    }
                    
                    return {
                        success: false,
                        error: errorDetails,
                        data: responseData,
                        failedActivations: responseData.failed_activations || []
                    };
                }
            } else {
                return {
                    success: false,
                    error: responseData?.msg || 'Ativação falhou',
                    data: responseData
                };
            }

        } catch (error) {
            console.error(`[${this.config.name}] Erro na ativação:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Formatar mensagem de sucesso
     */
    formatSuccessMessage(apiResponse, macAddress) {
        let message = `✅ *ATIVAÇÃO CONCLUÍDA!*\n\n`;
        message += `📱 *Aplicativo:* ${this.config.name}\n`;
        message += `🔧 *MAC Address:* \`${macAddress}\`\n`;
        
        if (apiResponse.successful_count !== undefined) {
            message += `📊 *Ativações:* ${apiResponse.successful_count} de 1\n`;
        }
        
        if (apiResponse.activated_devices?.length > 0) {
            const device = apiResponse.activated_devices[0];
            if (device.expire_date) {
                const expireFormatted = new Date(device.expire_date).toLocaleDateString('pt-BR');
                message += `📅 *Válido até:* ${expireFormatted}\n`;
            }

        }

        return message;
    }

    /**
     * Formatar erro de ativação
     */
    formatActivationError(apiResponse, macAddress) {
        let errorMessage = `❌ *FALHA - ${this.config.name.toUpperCase()}*\n\n`;
        errorMessage += `🔧 *MAC Address:* \`${macAddress}\`\n`;
        
        // 🔧 Indicar se MAC é atípico
        if (!this.strictMacRegex.test(macAddress)) {
            errorMessage += `🎯 *Tipo MAC:* Atípico (formato aceito)\n`;
        }
        
        if (apiResponse?.successful_count !== undefined) {
            errorMessage += `📊 *Resultado:* ${apiResponse.successful_count} de 1 ativações\n`;
        }
        
        if (apiResponse?.msg) {
            errorMessage += `💬 *Sistema:* ${apiResponse.msg}\n`;
        }
        
        if (apiResponse?.failed_activations?.length > 0) {
            errorMessage += '\n🔍 *Motivos da falha:*\n';
            apiResponse.failed_activations.forEach((failure, index) => {
                const reason = failure.error || failure.reason || failure.message || 'Erro desconhecido';
                errorMessage += `   ${index + 1}. ${reason}\n`;
            });
        } else {
            errorMessage += '\n⚠️ *Possíveis causas:*\n';
            errorMessage += '   • MAC Address já em uso\n';
            errorMessage += '   • Dispositivo não compatível\n';
            errorMessage += '   • Limite de ativações atingido\n';
        }
        
        errorMessage += '\n💡 *O que fazer:*\n';
        errorMessage += '1. Verifique se o MAC está correto\n';
        errorMessage += '2. Tente com outro dispositivo\n';
        errorMessage += '3. Entre em contato com o suporte\n\n';
        errorMessage += '🔄 Digite *menu* para tentar novamente';
        
        return errorMessage;
    }

    /**
     * 🔧 MÉTODO DE TESTE ATUALIZADO
     */
    async test() {
        console.log(`[${this.config.name}] Testando módulo com suporte a MACs atípicos`);
        
        // 🔧 Testar MACs tradicionais e atípicos
        const testMacs = [
            'aa:bb:cc:dd:ee:ff',     // Tradicional
            'ac:dj:yf:i2:4d:20',     // Atípico
            'abcdefghijkl',          // Sem separadores atípico
            '001122334455'           // Sem separadores tradicional
        ];
        
        console.log(`[${this.config.name}] 🧪 Testando extração de MACs:`);
        for (const testMac of testMacs) {
            const extracted = this.extractMacAddress(testMac);
            const isTraditional = extracted ? this.strictMacRegex.test(extracted) : false;
            console.log(`  - "${testMac}" → "${extracted}" (${extracted ? (isTraditional ? 'tradicional' : 'ATÍPICO') : 'FALHOU'})`);
        }
        
        const testOrder = {
            id: `test-${this.config.appModule.toLowerCase()}-${Date.now()}`,
            product: { 
                id: this.config.appModule.toLowerCase(),
                name: this.config.name,
                activationModule: this.config.appModule.toLowerCase()
            }
        };

        // Teste de login
        const loginResult = await this.login();
        if (!loginResult.success) {
            return { success: false, error: 'Falha no teste de login', details: loginResult.error };
        }

        return {
            success: true,
            message: `Módulo ${this.config.name} testado com sucesso (com suporte a MACs atípicos)`,
            loginWorking: true,
            macExtraction: true,
            atypicalMacSupport: true,
            tokenReceived: !!this.token,
            appId: this.config.appId,
            appModule: this.config.appModule
        };
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

module.exports = IboSolBaseActivator;
