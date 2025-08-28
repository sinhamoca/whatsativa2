// ==============================================================================
// 📄 modules/module_duplecast.js - Módulo Duplecast Gift Code Activation
// ==============================================================================

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class DuplecastActivator {
    constructor() {
        this.config = {
            name: 'Duplecast',
            appModule: 'DUPLECAST',
            appId: 'duplecast',
            price: 18.00,
            
            // Credenciais integradas (do arquivo .env original)
            twoCaptchaApiKey: '87fd25839e716a8ad24b3cbb81067b75',
            username: 'elenicesoares2808@gmail.com',
            password: '10203040',
            
            // URLs
            loginUrl: 'https://duplecast.com/client/login/',
            successUrl: 'https://duplecast.com/client/',
            activationUrl: 'https://duplecast.com/plugin/duplecast/client_codes/activate/',
            
            // Configurações
            headless: false,
            timeout: 30000,
            maxCaptchaAttempts: 15,
            captchaWaitTime: 10000
        };

        // Sistema de sessão HTTP
        this.session = axios.create({
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            }
        });

        this.cookies = {};
        this.captchaBaseUrl = 'http://2captcha.com';
        this.giftCodesFile = path.join(__dirname, '../data/giftduplecast.json');
    }

    // ==============================================================================
    // 🎯 MÉTODO PRINCIPAL DE ATIVAÇÃO
    // ==============================================================================
    
    async activate(activationData, order = null) {
        const startTime = Date.now();
        let logDetails = {
            orderId: order?.id || 'test',
            productName: order?.product?.name || 'Duplecast',
            timestamp: new Date().toISOString()
        };

        try {
            console.log('\n🚀 INICIANDO ATIVAÇÃO DUPLECAST');
            console.log('═'.repeat(50));
            console.log(`📋 Pedido: ${logDetails.orderId}`);
            console.log(`💰 Produto: ${logDetails.productName} (R$ ${this.config.price})`);

            // Extrair MAC address dos dados de ativação
            const macAddress = this.extractMacAddress(activationData);
            if (!macAddress) {
                throw new Error('MAC Address não encontrado nos dados de ativação');
            }

            console.log(`🖥️  MAC Address: ${macAddress}`);

            // Verificar saldo do 2captcha
            console.log('\n💳 Verificando saldo 2captcha...');
            const balance = await this.getCaptchaBalance();
            console.log(`💰 Saldo atual: $${balance.toFixed(4)}`);

            if (balance < 0.01) {
                throw new Error('Saldo insuficiente no 2captcha! Recarregue sua conta.');
            }

            // Fazer login
            console.log('\n🔐 Fazendo login...');
            const loginSuccess = await this.performLogin();
            
            if (!loginSuccess) {
                throw new Error('Falha no login - credenciais ou captcha inválidos');
            }

            console.log('✅ Login realizado com sucesso!');

            // Realizar ativação
            console.log('\n⚙️ Realizando ativação...');
            const activationResult = await this.performActivation(macAddress);

            if (!activationResult.success) {
                throw new Error(`Falha na ativação: ${activationResult.error}`);
            }

            const duration = Date.now() - startTime;
            const validUntil = new Date();
            validUntil.setFullYear(validUntil.getFullYear() + 1);

            console.log('\n🎉 ATIVAÇÃO CONCLUÍDA COM SUCESSO!');
            console.log('═'.repeat(50));
            console.log(`🖥️  MAC Address: ${macAddress}`);
            console.log(`🎫 Gift Code: ${activationResult.code}`);
            console.log(`📅 Válido até: ${this.formatDate(validUntil)}`);
            console.log(`⏰ Tempo: ${(duration / 1000).toFixed(1)}s`);
            console.log('═'.repeat(50));

            // MENSAGEM PERSONALIZADA PARA O WHATSAPP
            const mensagemWhatsApp = `🎉 *DUPLECAST ATIVADO COM SUCESSO!*

📺 *Seu streaming está pronto!*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *DETALHES DA ATIVAÇÃO:*

🔧 *MAC Address:* \`${macAddress}\`
🎫 *Gift Code Usado:* \`${activationResult.code}\`
📅 *Ativado em:* ${new Date().toLocaleDateString('pt-BR')}
⏰ *Válido até:* ${this.formatDate(validUntil)}
💰 *Serviço:* Duplecast (R$ ${this.config.price.toFixed(2)})

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔥 *Sua ativação foi realizada com sucesso!*
📺 *O serviço ficará ativo por 1 ano*
📝 *Guarde estas informações para referência*

🔄 Digite *menu* para nova ativação
💡 Digite *suporte* para ajuda

✨ *Obrigado por escolher nossos serviços!*`;

            return {
                success: true,
                message: mensagemWhatsApp,
                details: {
                    macAddress: macAddress,
                    giftCode: activationResult.code,
                    validUntil: this.formatDate(validUntil),
                    duration: `${(duration / 1000).toFixed(1)}s`,
                    service: 'Duplecast',
                    price: `R$ ${this.config.price.toFixed(2)}`
                },
                activationData: {
                    mac: macAddress,
                    code: activationResult.code,
                    validUntil: this.formatDate(validUntil),
                    activatedAt: new Date().toISOString()
                }
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            
            console.log('\n❌ ATIVAÇÃO FALHOU');
            console.log('═'.repeat(50));
            console.log(`🔴 Erro: ${error.message}`);
            console.log(`⏰ Tempo: ${(duration / 1000).toFixed(1)}s`);
            console.log('═'.repeat(50));

            return {
                success: false,
                error: error.message,
                message: `❌ *ERRO NA ATIVAÇÃO DUPLECAST*

🚨 *Motivo:* ${error.message}

💡 *Possíveis soluções:*
• Verifique o MAC address informado
• Tente novamente em alguns minutos
• Verifique se há gift codes disponíveis

🆘 *Suporte:* Entre em contato se o problema persistir
🔄 *Nova tentativa:* Digite *menu*

💳 *Importante:* Seu crédito foi preservado`,
                details: {
                    service: 'Duplecast',
                    duration: `${(duration / 1000).toFixed(1)}s`,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }

    // ==============================================================================
    // 🎫 SISTEMA DE GIFT CODES
    // ==============================================================================
    
    loadGiftCodes() {
        try {
            // Criar arquivo se não existir
            if (!fs.existsSync(this.giftCodesFile)) {
                this.createEmptyGiftCodesFile();
            }

            const data = fs.readFileSync(this.giftCodesFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.log('⚠️ Erro ao carregar gift codes, criando arquivo vazio...');
            this.createEmptyGiftCodesFile();
            return this.loadGiftCodes();
        }
    }

    saveGiftCodes(data) {
        data.last_updated = new Date().toISOString();
        fs.writeFileSync(this.giftCodesFile, JSON.stringify(data, null, 2));
    }

    createEmptyGiftCodesFile() {
        const emptyData = {
            created_at: new Date().toISOString(),
            last_updated: new Date().toISOString(),
            codes: []
        };
        
        // Criar diretório se não existir
        const dir = path.dirname(this.giftCodesFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(this.giftCodesFile, JSON.stringify(emptyData, null, 2));
    }

    getNextUnusedCode() {
        const data = this.loadGiftCodes();
        const unusedCode = data.codes.find(code => 
            code.status === 'unused' || code.status === undefined
        );
        
        if (!unusedCode) {
            throw new Error('Nenhum gift code disponível! Adicione novos códigos.');
        }
        
        return unusedCode;
    }

    markCodeAsUsed(codeId, macAddress, success) {
        const data = this.loadGiftCodes();
        const code = data.codes.find(c => c.id === codeId);
        
        if (code) {
            code.status = success ? 'used' : 'failed';
            code.used_at = success ? new Date().toISOString() : null;
            code.mac_used = success ? macAddress : null;
            code.activation_attempts = (code.activation_attempts || 0) + 1;
            code.last_attempt = new Date().toISOString();
            
            this.saveGiftCodes(data);
        }
    }

    addGiftCode(code, description = '') {
        const data = this.loadGiftCodes();
        
        // Verificar se código já existe
        const existingCode = data.codes.find(c => c.code === code);
        if (existingCode) {
            throw new Error(`Gift code '${code}' já existe!`);
        }
        
        const newId = data.codes.length > 0 ? Math.max(...data.codes.map(c => c.id)) + 1 : 1;
        
        data.codes.push({
            id: newId,
            code: code,
            description: description,
            status: 'unused',
            created_at: new Date().toISOString(),
            used_at: null,
            mac_used: null,
            activation_attempts: 0,
            last_attempt: null
        });
        
        this.saveGiftCodes(data);
        console.log(`✅ Gift code '${code}' adicionado com sucesso!`);
    }

    // ==============================================================================
    // 🔐 SISTEMA DE LOGIN E CAPTCHA
    // ==============================================================================
    
    async performLogin() {
        try {
            // Obter dados da página de login
            const loginPageData = await this.getLoginPage();
            
            // Resolver captcha se necessário
            let captchaToken = null;
            if (loginPageData.siteKey) {
                console.log('🧩 Resolvendo captcha...');
                captchaToken = await this.solveCaptcha(loginPageData.siteKey, this.config.loginUrl);
                console.log('✅ Captcha resolvido!');
            }
            
            // Executar login
            const loginResult = await this.executeLogin(loginPageData, captchaToken);
            
            // Verificar sucesso
            const success = await this.checkLoginSuccess();
            
            return success;
            
        } catch (error) {
            throw new Error(`Erro no login: ${error.message}`);
        }
    }

    async getLoginPage() {
        try {
            const response = await this.session.get(this.config.loginUrl);
            this.extractCookies(response);
            
            const html = response.data;
            
            // Extrair CSRF token
            let csrfToken = null;
            const csrfMatch = html.match(/name=["\']_csrf_token["\']\s+value=["\']([^"\']+)["\']/) ||
                             html.match(/value=["\']([^"\']+)["\']\s+name=["\']_csrf_token["\']/);
            if (csrfMatch) {
                csrfToken = csrfMatch[1];
            }
            
            // Extrair site key do reCAPTCHA
            const sitekeyMatch = html.match(/data-sitekey=["\']([^"\']+)["\']/) ||
                                html.match(/sitekey["\']?\s*:\s*["\']([^"\']+)["\']/);
            const siteKey = sitekeyMatch ? sitekeyMatch[1] : null;
            
            // Identificar campos de usuário e senha
            const usernameField = 'username';
            const passwordField = 'password';
            
            return { csrfToken, siteKey, usernameField, passwordField };
            
        } catch (error) {
            throw new Error(`Erro ao acessar página de login: ${error.message}`);
        }
    }

    async executeLogin(loginData, captchaToken) {
        try {
            const formData = new URLSearchParams();
            formData.append(loginData.usernameField, this.config.username);
            formData.append(loginData.passwordField, this.config.password);
            
            if (loginData.csrfToken) {
                formData.append('_csrf_token', loginData.csrfToken);
            }
            
            if (captchaToken) {
                formData.append('g-recaptcha-response', captchaToken);
            }
            
            const headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': this.getCookieString(),
                'Referer': this.config.loginUrl,
                'Origin': 'https://duplecast.com'
            };
            
            const response = await this.session.post(this.config.loginUrl, formData, {
                headers,
                maxRedirects: 0,
                validateStatus: function (status) {
                    return status < 400;
                }
            });
            
            this.extractCookies(response);
            
            return {
                status: response.status,
                location: response.headers.location
            };
            
        } catch (error) {
            if (error.response && error.response.status === 302) {
                this.extractCookies(error.response);
                return {
                    status: 302,
                    location: error.response.headers.location
                };
            }
            throw error;
        }
    }

    async checkLoginSuccess() {
        try {
            const response = await this.session.get(this.config.successUrl, {
                headers: { 'Cookie': this.getCookieString() },
                maxRedirects: 0,
                validateStatus: function (status) { return status < 400; }
            });
            
            if (response.status === 200) {
                const html = response.data;
                // Se contém elementos de login, não logou
                if (html.includes('login') && html.includes('password') && html.includes('Username')) {
                    return false;
                }
                return true;
            }
            
            return false;
            
        } catch (error) {
            if (error.response && error.response.status === 302) {
                const location = error.response.headers.location;
                if (location && location.includes('/login')) {
                    return false;
                }
            }
            return false;
        }
    }

    // ==============================================================================
    // 🧩 SISTEMA DE CAPTCHA (2CAPTCHA)
    // ==============================================================================
    
    async solveCaptcha(sitekey, pageurl) {
        try {
            if (!sitekey) return null;
            
            const taskId = await this.submitCaptcha(sitekey, pageurl);
            const token = await this.waitForCaptchaResult(taskId);
            return token;
        } catch (error) {
            throw new Error(`Erro ao resolver CAPTCHA: ${error.message}`);
        }
    }

    async submitCaptcha(sitekey, pageurl) {
        try {
            const response = await axios.post(`${this.captchaBaseUrl}/in.php`, null, {
                params: {
                    key: this.config.twoCaptchaApiKey,
                    method: 'userrecaptcha',
                    googlekey: sitekey,
                    pageurl: pageurl,
                    json: 1
                },
                timeout: 30000
            });

            if (!response.data || response.data.status !== 1) {
                throw new Error(`Erro ao enviar CAPTCHA: ${response.data?.error_text || 'Resposta inválida'}`);
            }

            return response.data.request;
        } catch (error) {
            throw error;
        }
    }

    async waitForCaptchaResult(taskId) {
        const maxAttempts = this.config.maxCaptchaAttempts;
        let attempts = 0;

        while (attempts < maxAttempts) {
            try {
                await this.sleep(this.config.captchaWaitTime);
                attempts++;

                const response = await axios.get(`${this.captchaBaseUrl}/res.php`, {
                    params: {
                        key: this.config.twoCaptchaApiKey,
                        action: 'get',
                        id: taskId,
                        json: 1
                    },
                    timeout: 15000
                });

                if (response.data && response.data.status === 1) {
                    return response.data.request;
                } 
                
                if (response.data && (
                    response.data.error_text === 'CAPCHA_NOT_READY' || 
                    response.data.request === 'CAPCHA_NOT_READY' ||
                    response.data === 'CAPCHA_NOT_READY'
                )) {
                    continue;
                }

                if (response.data && response.data.error_text) {
                    throw new Error(`Erro na resolução: ${response.data.error_text}`);
                }

            } catch (error) {
                if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
                    continue;
                }
                throw error;
            }
        }

        throw new Error('Timeout: CAPTCHA não foi resolvido no tempo limite');
    }

    async getCaptchaBalance() {
        try {
            const response = await axios.get(`${this.captchaBaseUrl}/res.php`, {
                params: {
                    key: this.config.twoCaptchaApiKey,
                    action: 'getbalance'
                },
                timeout: 10000
            });

            if (typeof response.data === 'string' && response.data.startsWith('ERROR_')) {
                throw new Error(`Erro do 2captcha: ${response.data}`);
            }

            const balance = parseFloat(response.data);
            
            if (isNaN(balance)) {
                throw new Error(`Resposta inválida do saldo: ${response.data}`);
            }
            
            return balance;
        } catch (error) {
            throw error;
        }
    }

    // ==============================================================================
    // ⚙️ SISTEMA DE ATIVAÇÃO
    // ==============================================================================
    
    async performActivation(macAddress) {
        try {
            // Obter código disponível
            const codeData = this.getNextUnusedCode();
            console.log(`🎫 Usando gift code: ${codeData.code}`);
            
            // Acessar página de ativação
            const pageResponse = await this.session.get(this.config.activationUrl, {
                headers: { 'Cookie': this.getCookieString() }
            });
            
            this.extractCookies(pageResponse);
            
            // Extrair CSRF token da página de ativação
            const activationHtml = pageResponse.data;
            let activationCsrfToken = null;
            
            const csrfMatch = activationHtml.match(/name=["\']_csrf_token["\']\s+value=["\']([^"\']+)["\']/) ||
                             activationHtml.match(/value=["\']([^"\']+)["\']\s+name=["\']_csrf_token["\']/);
            if (csrfMatch) {
                activationCsrfToken = csrfMatch[1];
            }
            
            // Preparar dados do formulário
            const activationFormData = new URLSearchParams();
            activationFormData.append('mac', macAddress);
            activationFormData.append('code', codeData.code);
            
            if (activationCsrfToken) {
                activationFormData.append('_csrf_token', activationCsrfToken);
            }
            
            // Executar ativação
            let activationResponse;
            try {
                activationResponse = await this.session.post(this.config.activationUrl, activationFormData, {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Cookie': this.getCookieString(),
                        'Referer': this.config.activationUrl,
                        'Origin': 'https://duplecast.com'
                    },
                    maxRedirects: 0,
                    validateStatus: function (status) { return status < 400; }
                });
                
            } catch (error) {
                if (error.response && error.response.status === 302) {
                    activationResponse = error.response;
                } else {
                    throw error;
                }
            }
            
            this.extractCookies(activationResponse);
            
            // Considerar redirecionamento 302 como sucesso
            const success = activationResponse.status === 302;
            
            // Marcar código como usado/falhado
            this.markCodeAsUsed(codeData.id, macAddress, success);
            
            if (success) {
                return {
                    success: true,
                    mac: macAddress,
                    code: codeData.code,
                    codeId: codeData.id
                };
            } else {
                throw new Error('Ativação falhou - resposta inesperada do servidor');
            }
            
        } catch (error) {
            throw new Error(`Erro na ativação: ${error.message}`);
        }
    }

    // ==============================================================================
    // 🛠️ MÉTODOS AUXILIARES
    // ==============================================================================
    
    extractMacAddress(activationData) {
        const macRegex = /([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/;
        const match = activationData.match(macRegex);
        return match ? match[0] : null;
    }

    extractCookies(response) {
        if (response.headers['set-cookie']) {
            response.headers['set-cookie'].forEach(cookie => {
                const [nameValue] = cookie.split(';');
                const [name, value] = nameValue.split('=');
                if (name && value) {
                    this.cookies[name.trim()] = value.trim();
                }
            });
        }
    }

    getCookieString() {
        return Object.entries(this.cookies)
            .map(([name, value]) => `${name}=${value}`)
            .join('; ');
    }

    formatDate(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getSuccessMessage(macAddress, giftCode, validUntil) {
        return `🎉 **ATIVAÇÃO DUPLECAST CONCLUÍDA!**

✅ **Detalhes da Ativação:**
🖥️ **MAC Address:** ${macAddress}
🎫 **Gift Code:** ${giftCode}
📅 **Válido até:** ${this.formatDate(validUntil)}
💰 **Serviço:** Duplecast (R$ ${this.config.price.toFixed(2)})

🔹 Sua ativação foi realizada com sucesso!
🔹 O serviço ficará ativo por 1 ano
🔹 Guarde estas informações para futura referência

Obrigado por escolher nossos serviços! 🚀`;
    }

    // ==============================================================================
    // 🧪 MÉTODO DE TESTE
    // ==============================================================================
    
    async test() {
        try {
            console.log('\n🧪 TESTANDO MÓDULO DUPLECAST');
            console.log('═'.repeat(50));

            // Teste 1: Verificar saldo do captcha
            console.log('💳 Testando saldo 2captcha...');
            const balance = await this.getCaptchaBalance();
            console.log(`✅ Saldo: $${balance.toFixed(4)}`);

            // Teste 2: Verificar gift codes
            console.log('\n🎫 Verificando gift codes...');
            const data = this.loadGiftCodes();
            const unusedCodes = data.codes.filter(c => c.status === 'unused' || !c.status);
            console.log(`📦 Total de códigos: ${data.codes.length}`);
            console.log(`🟢 Códigos disponíveis: ${unusedCodes.length}`);
            
            if (unusedCodes.length === 0) {
                console.log('⚠️ AVISO: Nenhum gift code disponível!');
            }

            // Teste 3: Testar conectividade
            console.log('\n🌐 Testando conectividade...');
            const response = await this.session.get(this.config.loginUrl);
            console.log(`✅ Status: ${response.status}`);

            console.log('\n✅ TODOS OS TESTES PASSARAM!');
            console.log('═'.repeat(50));

            return {
                success: true,
                message: 'Módulo Duplecast funcionando corretamente',
                details: {
                    captchaBalance: `$${balance.toFixed(4)}`,
                    totalCodes: data.codes.length,
                    availableCodes: unusedCodes.length,
                    connectivity: 'OK'
                }
            };

        } catch (error) {
            console.log(`\n❌ TESTE FALHOU: ${error.message}`);
            console.log('═'.repeat(50));

            return {
                success: false,
                error: error.message,
                suggestions: [
                    'Verifique as credenciais do 2captcha',
                    'Adicione gift codes válidos',
                    'Verifique a conectividade com a internet'
                ]
            };
        }
    }
}

// ==============================================================================
// 🚀 EXPORTAÇÃO DO MÓDULO
// ==============================================================================

function createActivator() {
    return new DuplecastActivator();
}

// Executar teste se chamado diretamente
if (require.main === module) {
    console.log('🧪 EXECUTANDO TESTE DO MÓDULO DUPLECAST');
    const activator = createActivator();
    activator.test().then(result => {
        console.log('\n📋 RESULTADO:', result);
        process.exit(result.success ? 0 : 1);
    });
}

module.exports = { createActivator, DuplecastActivator };