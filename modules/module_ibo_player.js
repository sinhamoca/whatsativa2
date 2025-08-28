// modules/module_ibo_player.js - Módulo de Ativação IBO Player
const axios = require('axios');
const crypto = require('crypto');

class IboPlayerActivator {
    constructor(config = {}) {
        this.config = {
            name: 'IBO Player',
            version: '1.0.0',
            baseUrl: 'https://backend.ibosol.com/api',
            credentials: {
                email: config.email || 'conta85iptv@gmail.com',
                password: config.password || 'P@pangu1'
            },
            timeout: config.timeout || 15000,
            ...config
        };
        
        this.token = null;
        this.tokenExpiresAt = null;
        
        // Headers padrão baseados no teste bem-sucedido
        this.defaultHeaders = {
            'Content-Type': 'application/json-patch+json',
            'Accept': 'application/json',
            'Origin': 'https://sandbox.ibosol.com',
            'Referer': 'https://sandbox.ibosol.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US',
            'Accept-Encoding': 'gzip, deflate, br', // Sem zstd para evitar problemas
            'Sec-Ch-Ua': '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site'
        };
        
        // Regex para validar MAC address
        this.macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
        
        // Configurar axios para decomprimir automaticamente
        axios.defaults.decompress = true;
    }

    /**
     * Método principal de ativação
     */
    async activate(activationData, order) {
        try {
            console.log(`[IBO Player] Iniciando ativação para pedido: ${order.id}`);
            console.log(`[IBO Player] Dados recebidos: ${activationData}`);

            // 1. Extrair MAC address dos dados
            const macAddress = this.extractMacAddress(activationData);
            if (!macAddress) {
                return {
                    success: false,
                    error: 'MAC Address não encontrado ou inválido',
                    suggestion: 'Envie o MAC no formato: AA:BB:CC:DD:EE:FF ou aa-bb-cc-dd-ee-ff'
                };
            }

            console.log(`[IBO Player] MAC extraído: ${macAddress}`);

            // 2. Fazer login na API
            const loginResult = await this.login();
            if (!loginResult.success) {
                return {
                    success: false,
                    error: 'Falha no login da API IBO Player',
                    details: loginResult.error
                };
            }

            console.log(`[IBO Player] Login realizado com sucesso`);

            // 3. Verificar status do dispositivo (opcional)
            const checkResult = await this.checkDeviceStatus(macAddress);
            if (checkResult.success) {
                console.log(`[IBO Player] Dispositivo verificado`);
            } else {
                console.log(`[IBO Player] Não foi possível verificar dispositivo, continuando...`);
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
                    error: activationResult.error,
                    apiError: activationResult.data
                };
            }

        } catch (error) {
            console.error('[IBO Player] Erro na ativação:', error);
            return {
                success: false,
                error: 'Erro interno no módulo IBO Player',
                details: error.message
            };
        }
    }

    /**
     * Extrai MAC address dos dados enviados pelo cliente
     */
    extractMacAddress(rawData) {
        try {
            // Remover espaços e quebras de linha
            const cleanData = rawData.trim().replace(/\s+/g, ' ');
            
            // Buscar padrões de MAC address
            const lines = cleanData.split(/[\n\r\s,;]/);
            
            for (const line of lines) {
                const trimmed = line.trim();
                
                // Testar se é um MAC válido
                if (this.macRegex.test(trimmed)) {
                    // Normalizar formato (sempre com :)
                    return trimmed.toLowerCase().replace(/-/g, ':');
                }
                
                // Buscar MAC sem separadores (12 caracteres hex)
                const macWithoutSeparators = trimmed.match(/^[0-9a-fA-F]{12}$/);
                if (macWithoutSeparators) {
                    const mac = macWithoutSeparators[0].toLowerCase();
                    return `${mac.substr(0,2)}:${mac.substr(2,2)}:${mac.substr(4,2)}:${mac.substr(6,2)}:${mac.substr(8,2)}:${mac.substr(10,2)}`;
                }
            }
            
            return null;
            
        } catch (error) {
            console.error('[IBO Player] Erro ao extrair MAC:', error);
            return null;
        }
    }

    /**
     * Faz login na API do IBO Player
     */
    async login() {
        try {
            console.log(`[IBO Player] Fazendo login em: ${this.config.baseUrl}/login`);
            
            const loginPayload = {
                email: this.config.credentials.email,
                password: this.config.credentials.password
            };

            // Configuração específica para evitar problemas de encoding
            const config = {
                headers: this.defaultHeaders,
                timeout: this.config.timeout,
                responseType: 'json',
                decompress: true,
                validateStatus: function (status) {
                    return status >= 200 && status < 500;
                }
            };

            const response = await axios.post(
                `${this.config.baseUrl}/login`,
                loginPayload,
                config
            );

            console.log(`[IBO Player] Resposta do login - Status: ${response.status}`);

            // Processar resposta
            let responseData = response.data;
            
            // Se a resposta for string, tentar parsear como JSON
            if (typeof responseData === 'string') {
                try {
                    responseData = JSON.parse(responseData);
                } catch (parseError) {
                    console.error('[IBO Player] Erro ao parsear JSON:', parseError);
                    return {
                        success: false,
                        error: 'Resposta da API não é JSON válido'
                    };
                }
            }

            if (responseData && responseData.status === true && responseData.token) {
                this.token = responseData.token;
                
                // Calcular quando o token expira (assumindo 8 horas se não especificado)
                this.tokenExpiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
                
                console.log(`[IBO Player] Login bem-sucedido! Token: ${this.token.substring(0, 20)}...`);
                
                return {
                    success: true,
                    token: this.token,
                    data: responseData
                };
            } else {
                return {
                    success: false,
                    error: responseData?.msg || 'Login falhou',
                    statusCode: responseData?.statusCode,
                    httpCode: response.status
                };
            }

        } catch (error) {
            console.error('[IBO Player] Erro no login:', error.message);
            
            if (error.response) {
                return {
                    success: false,
                    error: `Erro HTTP ${error.response.status}: ${error.response.data?.msg || error.response.statusText}`,
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
     * Verifica status do dispositivo (opcional)
     */
    async checkDeviceStatus(macAddress) {
        try {
            if (!this.token) {
                throw new Error('Token de acesso não disponível');
            }

            console.log(`[IBO Player] Verificando status do dispositivo: ${macAddress}`);

            const checkPayload = {
                macAddress: macAddress,
                app_id: [1] // ID do IBOPLAYER
            };

            const headers = {
                ...this.defaultHeaders,
                'Authorization': `Bearer ${this.token}`
            };

            const response = await axios.post(
                `${this.config.baseUrl}/check-device-status-multi-app`,
                checkPayload,
                {
                    headers,
                    timeout: this.config.timeout,
                    responseType: 'json',
                    decompress: true
                }
            );

            console.log(`[IBO Player] Status do dispositivo verificado`);
            return {
                success: true,
                data: response.data
            };

        } catch (error) {
            console.error('[IBO Player] Erro ao verificar dispositivo:', error.message);
            return {
                success: false,
                error: error.response?.data?.msg || error.message
            };
        }
    }

    /**
     * Ativa dispositivo na API
     */
    async activateDevice(macAddress, order) {
        try {
            if (!this.token) {
                throw new Error('Token de acesso não disponível');
            }

            console.log(`[IBO Player] Ativando dispositivo: ${macAddress}`);

            const activationPayload = {
                modules: ["IBOPLAYER"],
                requestData: {
                    is_trial: 3,
                    macAddress: macAddress,
                    appType: "multi-app",
                    email: "",
                    creditPoints: 1,
                    isConfirmed: true,
                    comment: `Ativado via WhatsApp - Pedido: ${order.id.substring(0, 8)}`,
                    app_ids: [1] // CAMPO OBRIGATÓRIO!
                }
            };

            console.log(`[IBO Player] Payload de ativação:`, activationPayload);

            const headers = {
                ...this.defaultHeaders,
                'Authorization': `Bearer ${this.token}`
            };

            const response = await axios.post(
                `${this.config.baseUrl}/bulk-multi-app-activate`,
                activationPayload,
                {
                    headers,
                    timeout: this.config.timeout,
                    responseType: 'json',
                    decompress: true
                }
            );

            console.log(`[IBO Player] Resposta da ativação - Status: ${response.status}`);

            // Processar resposta
            let responseData = response.data;
            
            console.log(`[IBO Player] Resposta completa:`, responseData);
            
            if (typeof responseData === 'string') {
                try {
                    responseData = JSON.parse(responseData);
                } catch (parseError) {
                    console.error('[IBO Player] Erro ao parsear resposta:', parseError);
                    return {
                        success: false,
                        error: 'Resposta da ativação não é JSON válido'
                    };
                }
            }

            if (responseData && responseData.status === true) {
                // VERIFICAÇÃO MELHORADA: Analisar contagem de sucessos
                const successfulCount = responseData.successful_count || 0;
                const totalAttempts = 1; // Sempre tentamos ativar 1 dispositivo
                
                console.log(`[IBO Player] Contagem de ativações: ${successfulCount} de ${totalAttempts}`);
                console.log(`[IBO Player] Mensagem da API: ${responseData.msg}`);
                
                // Verificar se realmente ativou algum dispositivo
                if (successfulCount > 0) {
                    console.log(`[IBO Player] ✅ Ativação REALMENTE bem-sucedida!`);
                    return {
                        success: true,
                        data: responseData,
                        activatedDevices: responseData.activated_devices || [],
                        successfulCount: successfulCount,
                        message: responseData.msg || 'Ativação bem-sucedida'
                    };
                } else {
                    // API retornou status true, mas 0 ativações = ERRO
                    console.log(`[IBO Player] ❌ Ativação FALHOU: 0 dispositivos ativados`);
                    
                    let errorDetails = responseData.msg || 'Nenhum dispositivo foi ativado';
                    
                    // Verificar se há falhas detalhadas
                    if (responseData.failed_activations && responseData.failed_activations.length > 0) {
                        const failures = responseData.failed_activations;
                        console.log(`[IBO Player] Falhas detectadas:`, failures);
                        
                        // Extrair motivos das falhas
                        const failureReasons = failures.map(failure => 
                            failure.error || failure.reason || failure.message || 'Erro desconhecido'
                        ).join(', ');
                        
                        errorDetails = `Falha na ativação: ${failureReasons}`;
                    }
                    
                    return {
                        success: false,
                        error: errorDetails,
                        data: responseData,
                        statusCode: response.status,
                        failedActivations: responseData.failed_activations || []
                    };
                }
            } else {
                return {
                    success: false,
                    error: responseData?.msg || 'Ativação falhou',
                    data: responseData,
                    statusCode: response.status
                };
            }

        } catch (error) {
            console.error('[IBO Player] Erro na ativação:', error.message);
            
            if (error.response) {
                const errorMsg = error.response.data?.msg || error.response.statusText;
                
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
        if (!this.token || !this.tokenExpiresAt) {
            return false;
        }
        
        // Verificar se expira nos próximos 5 minutos
        const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
        return this.tokenExpiresAt > fiveMinutesFromNow;
    }

    /**
     * Analisa e formata erros de ativação
     */
    formatActivationError(apiResponse, macAddress) {
        let errorMessage = '❌ *FALHA NA ATIVAÇÃO IBO PLAYER*\n\n';
        errorMessage += `🔧 *MAC Address:* \`${macAddress}\`\n`;
        
        // Mostrar contagem específica
        if (apiResponse.successful_count !== undefined) {
            errorMessage += `📊 *Resultado:* ${apiResponse.successful_count} de 1 ativações\n`;
        }
        
        // Mostrar mensagem da API
        if (apiResponse.msg) {
            errorMessage += `💬 *Sistema:* ${apiResponse.msg}\n`;
        }
        
        // Analisar falhas específicas
        if (apiResponse.failed_activations && apiResponse.failed_activations.length > 0) {
            errorMessage += '\n🔍 *Motivos da falha:*\n';
            apiResponse.failed_activations.forEach((failure, index) => {
                const reason = failure.error || failure.reason || failure.message || 'Erro desconhecido';
                errorMessage += `   ${index + 1}. ${reason}\n`;
            });
        } else {
            errorMessage += '\n⚠️ *Possíveis causas:*\n';
            errorMessage += '   • MAC Address inválido ou já em uso\n';
            errorMessage += '   • Dispositivo não compatível\n';
            errorMessage += '   • Limite de ativações atingido\n';
            errorMessage += '   • Problema temporário no servidor\n';
        }
        
        errorMessage += '\n💡 *O que fazer:*\n';
        errorMessage += '1. Verifique se o MAC está correto\n';
        errorMessage += '2. Tente com outro dispositivo\n';
        errorMessage += '3. Entre em contato com o suporte\n\n';
        errorMessage += '🔄 Digite *menu* para tentar novamente';
        
        return errorMessage;
    }
    formatSuccessMessage(apiResponse, macAddress) {
        let message = '🎉 *IBO PLAYER ATIVADO COM SUCESSO!*\n\n';
        message += '📱 *Aplicativo:* IBO Player\n';
        message += `🔧 *MAC Address:* \`${macAddress}\`\n`;
        
        // Mostrar contagem específica de ativações
        if (apiResponse.successful_count !== undefined) {
            message += `📊 *Ativações:* ${apiResponse.successful_count} de 1\n`;
        }
        
        if (apiResponse.activated_devices && apiResponse.activated_devices.length > 0) {
            const device = apiResponse.activated_devices[0];
            if (device.expire_date) {
                const expireFormatted = new Date(device.expire_date).toLocaleDateString('pt-BR');
                message += `📅 *Válido até:* ${expireFormatted}\n`;
            }
            if (device.module) {
                message += `🎯 *Módulo:* ${device.module}\n`;
            }
        }
        
        message += '\n✅ *Status:* Ativação confirmada!\n';
        
        // Mostrar mensagem específica da API se disponível
        if (apiResponse.msg) {
            message += `💬 *Sistema:* ${apiResponse.msg}\n`;
        }
        
        message += '\n📲 *Próximos passos:*\n';
        message += '1. Abra o aplicativo IBO Player\n';
        message += '2. Configure suas credenciais\n';
        message += '3. O aplicativo já deve estar liberado\n\n';
        
        message += '🆘 *Suporte:* Se tiver problemas, entre em contato\n';
        message += '🔄 Digite *menu* para nova ativação';

        return message;
    }

    /**
     * Testa o módulo
     */
    async test() {
        console.log(`[IBO Player] Testando módulo ${this.config.name}`);
        
        // Dados de teste
        const testMac = 'aa:bb:cc:dd:ee:ff';
        const testOrder = {
            id: 'test-ibo-player-' + Date.now(),
            product: { 
                id: 'ibo_player',
                name: 'IBO Player',
                activationModule: 'ibo_player'
            }
        };

        console.log(`[IBO Player] Testando com MAC: ${testMac}`);

        // Teste 1: Extração de MAC
        const extractedMac = this.extractMacAddress(testMac);
        if (!extractedMac) {
            return {
                success: false,
                error: 'Falha no teste de extração de MAC'
            };
        }

        console.log(`[IBO Player] MAC extraído no teste: ${extractedMac}`);

        // Teste 2: Login (sem ativar dispositivo real)
        const loginResult = await this.login();
        if (!loginResult.success) {
            return {
                success: false,
                error: 'Falha no teste de login',
                details: loginResult.error
            };
        }

        console.log(`[IBO Player] Login testado com sucesso`);

        return {
            success: true,
            message: 'Módulo IBO Player testado com sucesso',
            loginWorking: true,
            macExtraction: true,
            tokenReceived: !!this.token
        };
    }

    /**
     * Método para ativar com configurações customizadas
     */
    async activateWithCustomOptions(macAddress, options, order) {
        try {
            if (!this.token) {
                const loginResult = await this.login();
                if (!loginResult.success) {
                    return loginResult;
                }
            }

            const customPayload = {
                modules: ["IBOPLAYER"],
                requestData: {
                    is_trial: options.isTrial || 3,
                    macAddress: macAddress,
                    appType: options.appType || "multi-app",
                    email: options.email || "",
                    creditPoints: options.creditPoints || 1,
                    isConfirmed: options.isConfirmed !== false,
                    comment: options.comment || `Ativado via WhatsApp - Pedido: ${order.id.substring(0, 8)}`,
                    app_ids: options.appIds || [1]
                }
            };

            // Usar o método de ativação padrão com payload customizado
            return await this.activateDevice(macAddress, order);
            
        } catch (error) {
            console.error('[IBO Player] Erro na ativação customizada:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

/**
 * Função de fábrica para criar instância
 */
function createActivator(config = {}) {
    // Configuração padrão para IBO Player
    const defaultConfig = {
        email: 'conta85iptv@gmail.com',
        password: 'P@pangu1',
        timeout: 15000
    };

    return new IboPlayerActivator({ ...defaultConfig, ...config });
}

// Exportar
module.exports = {
    IboPlayerActivator,
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
