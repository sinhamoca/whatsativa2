// modules/module_smartoneiptv.js - SmartOne IPTV com Mensagem Personalizada
const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

class TwoCaptchaSolver {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'http://2captcha.com';
    }

    async solveTurnstile(siteKey, pageUrl) {
        try {
            console.log('🔄 Enviando CAPTCHA para 2captcha...');
            
            const submitResponse = await axios.post(`${this.baseUrl}/in.php`, {
                key: this.apiKey,
                method: 'turnstile',
                sitekey: siteKey,
                pageurl: pageUrl,
                json: 1
            });

            if (submitResponse.data.status !== 1) {
                throw new Error(`Erro ao enviar: ${submitResponse.data.error_text}`);
            }

            const taskId = submitResponse.data.request;
            console.log(`🔍 Task ID: ${taskId}`);
            
            let attempts = 0;
            const maxAttempts = 60;

            console.log('⏳ Aguardando resolução do CAPTCHA...');
            
            while (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                attempts++;

                console.log(`🔄 Tentativa ${attempts}/${maxAttempts}`);

                const resultResponse = await axios.get(`${this.baseUrl}/res.php`, {
                    params: {
                        key: this.apiKey,
                        action: 'get',
                        id: taskId,
                        json: 1
                    }
                });

                if (resultResponse.data.status === 1) {
                    console.log('✅ CAPTCHA resolvido!');
                    return resultResponse.data.request;
                } else if (resultResponse.data.request !== 'CAPCHA_NOT_READY') {
                    throw new Error(`Erro na resolução: ${resultResponse.data.request}`);
                }
            }

            throw new Error('Timeout: CAPTCHA não resolvido em 5 minutos');

        } catch (error) {
            throw new Error(`Erro no 2captcha: ${error.message}`);
        }
    }
}

class SmartOneIPTVActivator {
    constructor(config = {}) {
        this.config = {
            name: 'SmartOne IPTV',
            email: config.email || 'isaacofc2@gmail.com',
            password: config.password || 'papangu1',
            twoCaptchaKey: config.twoCaptchaKey || '87fd25839e716a8ad24b3cbb81067b75',
            loginUrl: 'https://smartone-iptv.com/client/login',
            baseUrl: 'https://smartone-iptv.com',
            activationUrl: 'https://smartone-iptv.com/plugin/smart_one/client_codes/activate/',
            giftCodesFile: config.giftCodesFile || './giftcodes.json',
            timeout: 30000,
            ...config
        };
        
        this.setupClient();
        this.captchaSolver = new TwoCaptchaSolver(this.config.twoCaptchaKey);
        
        this.stats = {
            activations: 0,
            successes: 0,
            failures: 0,
            lastActivation: null
        };
    }
    
    setupClient() {
        this.cookieJar = new tough.CookieJar();
        this.client = wrapper(axios.create({
            jar: this.cookieJar,
            timeout: this.config.timeout,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive'
            }
        }));
    }

    async activate(activationData, order) {
        try {
            console.log(`🚀 [${this.config.name}] Iniciando ativação...`);
            
            // Validar dados de ativação
            const macAddress = this.extractMacAddress(activationData);
            if (!macAddress) {
                throw new Error('MAC Address inválido ou não informado');
            }
            
            console.log(`📱 MAC Address: ${macAddress}`);
            
            // Fazer login
            console.log('🔐 Fazendo login...');
            const loginResult = await this.fazerLogin();
            if (!loginResult.sucesso) {
                throw new Error(`Falha no login: ${loginResult.erro || 'Login não conseguiu ser realizado'}`);
            }
            
            // Verificar sessão
            const sessionValid = await this.testarSessao();
            if (!sessionValid) {
                throw new Error('Sessão inválida após login');
            }
            
            // Buscar gift code disponível
            console.log('🎁 Buscando gift code disponível...');
            const giftCodeObj = this.obterProximoCodigo();
            if (!giftCodeObj) {
                throw new Error('Nenhum gift code disponível');
            }
            
            console.log(`🎫 Usando gift code: ${giftCodeObj.code}`);
            
            // Ativar o código
            console.log('⚡ Realizando ativação...');
            const activationResult = await this.ativarGiftCode(giftCodeObj.code, macAddress);
            
            if (!activationResult.sucesso) {
                throw new Error(`Falha na ativação: ${activationResult.mensagem || activationResult.erro}`);
            }
            
            // Marcar código como usado apenas em caso de sucesso
            this.marcarComoUsado(giftCodeObj.code, 'sucesso', activationResult.mensagem);
            
            this.stats.activations++;
            this.stats.successes++;
            this.stats.lastActivation = new Date().toISOString();
            
            console.log(`✅ [${this.config.name}] Ativação concluída com sucesso!`);
            
            // CRIAR MENSAGEM PERSONALIZADA SEGUINDO PADRÃO DO DREAMTV
            const agora = new Date();
            const dataAtivacao = agora.toLocaleDateString('pt-BR');
            
            const dataValidade = new Date(agora);
            dataValidade.setFullYear(agora.getFullYear() + 1);
            const validoAte = dataValidade.toLocaleDateString('pt-BR');
            
            // Limpar mensagem do servidor
            let statusServidor = '';
            if (activationResult.mensagem && activationResult.mensagem.trim()) {
                statusServidor = activationResult.mensagem
                    .replace(/&times;/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
            }

            // MENSAGEM PERSONALIZADA SIMPLIFICADA
            const mensagemPersonalizada = `📺 *Sua TV Premium está Pronta!*
📋 *DETALHES DA ATIVAÇÃO:*

🔧 *MAC Address:* \`${macAddress}\`
🎫 *Código Usado:* \`${giftCodeObj.code}\`
📅 *Ativado em:* ${dataAtivacao}
⏰ *Válido até:* ${validoAte}`;

            // RETORNO CORRIGIDO - MUDOU 'message' PARA 'result'
            return {
                success: true,
                result: mensagemPersonalizada,  // ✅ CORREÇÃO APLICADA
                data: {
                    macAddress: macAddress,
                    giftCode: giftCodeObj.code,
                    validUntil: validoAte,
                    activatedAt: dataAtivacao,
                    service: 'SmartOne IPTV',
                    serverMessage: activationResult.mensagem
                }
            };
            
        } catch (error) {
            this.stats.activations++;
            this.stats.failures++;
            
            console.error(`❌ [${this.config.name}] Erro na ativação:`, error.message);
            
            // RETORNO DE ERRO SEGUINDO PADRÃO
            return {
                success: false,
                error: error.message,
                message: `❌ *ERRO NA ATIVAÇÃO SMARTONE IPTV*

🚨 *Motivo:* ${error.message}

💡 *Soluções:*
• Verifique o MAC address
• Tente novamente em alguns minutos
• Entre em contato com o suporte

🔄 Digite *menu* para tentar novamente`
            };
        }
    }
    
    extractMacAddress(activationData) {
        // Extrair MAC de diferentes formatos
        const data = typeof activationData === 'string' ? activationData : 
                    activationData.mac || activationData.macAddress || activationData.info || '';
        
        // Regex para MAC address
        const macRegex = /([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}/;
        const match = data.match(macRegex);
        
        if (match) {
            // Normalizar formato (usar :)
            return match[0].replace(/-/g, ':').toUpperCase();
        }
        
        return null;
    }
    
    async obterPaginaLogin() {
        const response = await this.client.get(this.config.loginUrl);
        if (response.status !== 200) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        return this.extrairDadosLogin(response.data);
    }

    extrairDadosLogin(html) {
        const data = {
            action: null,
            csrfToken: null,
            csrfFieldName: null,
            turnstileSiteKey: null,
            emailFieldName: null,
            passwordFieldName: null,
            extraFields: {}
        };

        // Extrair action do formulário
        const formMatch = html.match(/<form[^>]*action=["']([^"']*)["'][^>]*>/i);
        if (formMatch) data.action = formMatch[1];

        // Encontrar campo de email/username
        const emailPatterns = [
            /<input[^>]*name=["']([^"']*username[^"']*)["'][^>]*>/i,
            /<input[^>]*name=["']([^"']*email[^"']*)["'][^>]*>/i,
            /<input[^>]*name=["']([^"']*user[^"']*)["'][^>]*>/i,
            /<input[^>]*type=["']email["'][^>]*name=["']([^"']*)["'][^>]*>/i
        ];

        for (let pattern of emailPatterns) {
            const match = html.match(pattern);
            if (match) {
                data.emailFieldName = match[1];
                break;
            }
        }

        // Encontrar campo de senha
        const passwordMatch = html.match(/<input[^>]*type=["']password["'][^>]*name=["']([^"']*)["'][^>]*>/i);
        if (passwordMatch) data.passwordFieldName = passwordMatch[1];

        // Extrair CSRF token
        const csrfPatterns = [
            /<input[^>]*name=["'](\*csrf\*token)["'][^>]*value=["']([^"']*)["'][^>]*>/i,
            /<input[^>]*name=["'](_csrf_token)["'][^>]*value=["']([^"']*)["'][^>]*>/i,
            /<input[^>]*name=["'](_token)["'][^>]*value=["']([^"']*)["'][^>]*>/i
        ];

        for (let pattern of csrfPatterns) {
            const match = html.match(pattern);
            if (match) {
                data.csrfToken = match[2];
                data.csrfFieldName = match[1];
                break;
            }
        }

        // Extrair Turnstile site key
        const turnstilePatterns = [
            /data-sitekey=["']([^"']*)["']/i,
            /sitekey:\s*["']([^"']*)["']/i,
            /"sitekey":\s*"([^"]*)"/i
        ];

        for (let pattern of turnstilePatterns) {
            const match = html.match(pattern);
            if (match) {
                data.turnstileSiteKey = match[1];
                break;
            }
        }

        // Extrair campos hidden
        const hiddenFields = html.match(/<input[^>]*type=["']hidden["'][^>]*>/gi) || [];
        hiddenFields.forEach(field => {
            const nameMatch = field.match(/name=["']([^"']*)["']/i);
            const valueMatch = field.match(/value=["']([^"']*)["']/i);
            
            if (nameMatch && valueMatch && 
                !nameMatch[1].includes('token') && 
                !nameMatch[1].includes('csrf')) {
                data.extraFields[nameMatch[1]] = valueMatch[1];
            }
        });

        return data;
    }

    async fazerLogin() {
        try {
            const loginData = await this.obterPaginaLogin();

            // Resolver CAPTCHA se necessário
            let captchaToken = null;
            if (loginData.turnstileSiteKey) {
                console.log('🔒 Resolvendo Cloudflare Turnstile...');
                captchaToken = await this.captchaSolver.solveTurnstile(
                    loginData.turnstileSiteKey, 
                    this.config.loginUrl
                );
                console.log('✅ CAPTCHA resolvido!');
            }

            // Preparar dados do POST
            const formData = new URLSearchParams();
            formData.append(loginData.emailFieldName || 'username', this.config.email);
            formData.append(loginData.passwordFieldName || 'password', this.config.password);
            
            if (loginData.csrfToken) {
                formData.append(loginData.csrfFieldName, loginData.csrfToken);
            }

            if (captchaToken) {
                formData.append('cf-turnstile-response', captchaToken);
            }

            Object.entries(loginData.extraFields).forEach(([key, value]) => {
                formData.append(key, value);
            });

            formData.append('remember', '0');

            // Fazer POST de login
            const loginUrl = loginData.action ? 
                (loginData.action.startsWith('http') ? loginData.action : this.config.baseUrl + loginData.action) :
                this.config.loginUrl;

            const response = await this.client.post(loginUrl, formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': this.config.loginUrl,
                    'Origin': this.config.baseUrl
                },
                maxRedirects: 5
            });

            // Aguardar processamento
            await new Promise(resolve => setTimeout(resolve, 5000));

            return this.analisarResposta(response);
        } catch (error) {
            return { sucesso: false, erro: error.message };
        }
    }

    analisarResposta(response) {
        const finalUrl = response.request.res.responseUrl || response.config.url;
        
        if (finalUrl.includes('/client') && !finalUrl.includes('/login')) {
            return { sucesso: true, url: finalUrl };
        }

        return { sucesso: false, url: finalUrl };
    }

    async testarSessao() {
        try {
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const response = await this.client.get(this.config.baseUrl + '/client/', {
                maxRedirects: 0,
                validateStatus: function (status) {
                    return status < 400;
                }
            });

            if (response.status === 302 || response.status === 301) {
                const redirectLocation = response.headers.location;
                if (redirectLocation && redirectLocation.includes('/login')) {
                    return false;
                }
            }

            return response.status === 200;
            
        } catch (error) {
            return false;
        }
    }

    // GESTÃO DE GIFT CODES
    carregarCodigos() {
        try {
            const fs = require('fs');
            if (fs.existsSync(this.config.giftCodesFile)) {
                const data = fs.readFileSync(this.config.giftCodesFile, 'utf8');
                return JSON.parse(data);
            } else {
                console.log(`⚠️ Arquivo ${this.config.giftCodesFile} não encontrado`);
                return [];
            }
        } catch (error) {
            console.error('❌ Erro ao carregar gift codes:', error.message);
            return [];
        }
    }

    salvarCodigos(codes) {
        try {
            const fs = require('fs');
            fs.writeFileSync(this.config.giftCodesFile, JSON.stringify(codes, null, 2));
        } catch (error) {
            console.error('❌ Erro ao salvar gift codes:', error.message);
        }
    }

    obterProximoCodigo() {
        const codes = this.carregarCodigos();
        return codes.find(c => !c.usado);
    }

    marcarComoUsado(code, status, mensagem = null) {
        const codes = this.carregarCodigos();
        const codeObj = codes.find(c => c.code === code);
        if (codeObj) {
            codeObj.usado = true;
            codeObj.dataUso = new Date().toISOString();
            codeObj.status = status;
            codeObj.mensagem = mensagem;
            this.salvarCodigos(codes);
        }
    }

    async ativarGiftCode(giftCode, macAddress) {
        try {
            // Acessar página de ativação
            const response = await this.client.get(this.config.activationUrl);
            if (response.status !== 200) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }

            const formData = this.extrairDadosAtivacao(response.data);
            
            // Preparar dados para envio
            const postData = new URLSearchParams();
            postData.append('code', giftCode);
            postData.append('mac', macAddress);
            
            if (formData.csrfToken) {
                postData.append(formData.csrfFieldName, formData.csrfToken);
            }

            Object.entries(formData.extraFields).forEach(([key, value]) => {
                postData.append(key, value);
            });

            // Enviar formulário
            const submitUrl = formData.action ? 
                (formData.action.startsWith('http') ? formData.action : this.config.baseUrl + formData.action) :
                this.config.activationUrl;

            const submitResponse = await this.client.post(submitUrl, postData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': this.config.activationUrl,
                    'Origin': this.config.baseUrl
                },
                maxRedirects: 5
            });

            return this.analisarRespostaAtivacao(submitResponse.data, giftCode, macAddress);
            
        } catch (error) {
            return {
                sucesso: false,
                giftCode: giftCode,
                macAddress: macAddress,
                erro: error.message
            };
        }
    }

    extrairDadosAtivacao(html) {
        const data = {
            action: null,
            csrfToken: null,
            csrfFieldName: null,
            extraFields: {}
        };

        const formMatch = html.match(/<form[^>]*action=["']([^"']*)["'][^>]*>/i);
        if (formMatch) data.action = formMatch[1];

        const csrfPatterns = [
            /<input[^>]*name=["'](\*csrf\*token)["'][^>]*value=["']([^"']*)["'][^>]*>/i,
            /<input[^>]*name=["'](_csrf_token)["'][^>]*value=["']([^"']*)["'][^>]*>/i,
            /<input[^>]*name=["'](_token)["'][^>]*value=["']([^"']*)["'][^>]*>/i
        ];

        for (let pattern of csrfPatterns) {
            const match = html.match(pattern);
            if (match) {
                data.csrfToken = match[2];
                data.csrfFieldName = match[1];
                break;
            }
        }

        const hiddenFields = html.match(/<input[^>]*type=["']hidden["'][^>]*>/gi) || [];
        hiddenFields.forEach(field => {
            const nameMatch = field.match(/name=["']([^"']*)["']/i);
            const valueMatch = field.match(/value=["']([^"']*)["']/i);
            
            if (nameMatch && valueMatch && 
                !nameMatch[1].includes('token') && 
                !nameMatch[1].includes('csrf')) {
                data.extraFields[nameMatch[1]] = valueMatch[1];
            }
        });

        return data;
    }

    analisarRespostaAtivacao(html, giftCode, macAddress) {
        // Procurar por mensagens de alerta
        const alertSuccess = html.match(/<div[^>]*class=["'][^"']*alert-success[^"']*["'][^>]*>(.*?)<\/div>/is);
        const alertDanger = html.match(/<div[^>]*class=["'][^"']*alert-danger[^"']*["'][^>]*>(.*?)<\/div>/is);

        let resultado = {
            sucesso: false,
            giftCode: giftCode,
            macAddress: macAddress,
            mensagem: '',
            dataValidade: null
        };

        if (alertSuccess) {
            // Ativação bem-sucedida
            const mensagem = alertSuccess[1].replace(/<[^>]*>/g, '').trim();
            
            // Verificar múltiplos padrões de sucesso como no código original
            if (mensagem.toLowerCase().includes('successfully activated') || 
                mensagem.toLowerCase().includes('mac successfully') ||
                mensagem.toLowerCase().includes('ativado') ||
                mensagem.toLowerCase().includes('success') ||
                mensagem.toLowerCase().includes('activated')) {
                
                resultado.sucesso = true;
                resultado.mensagem = mensagem;
                
                // Calcular data de validade como no código original
                const hoje = new Date();
                const dataValidade = new Date(hoje);
                dataValidade.setFullYear(hoje.getFullYear() + 1);
                resultado.dataValidade = dataValidade.toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });
                
                // Logs como no sistema original
                console.log('\n🎉 ATIVAÇÃO CONCLUÍDA COM SUCESSO!');
                console.log(`📱 Endereço MAC: ${macAddress}`);
                console.log(`📅 Data de validade: ${resultado.dataValidade}`);
                console.log(`🎫 Código usado: ${giftCode}`);
                
                return resultado;
            }
        }

        if (alertDanger) {
            // Erro na ativação
            const mensagem = alertDanger[1].replace(/<[^>]*>/g, '').trim();
            resultado.mensagem = mensagem;
            
            console.log('\n❌ Erro na ativação:');
            console.log(`💬 ${mensagem}`);
        } else {
            resultado.mensagem = 'Resposta não reconhecida do servidor';
            console.log('\n❌ Resposta não reconhecida do servidor');
        }

        return resultado;
    }
    
    async test() {
        try {
            console.log(`🧪 Testando módulo ${this.config.name}...`);
            
            // Verificar chave do 2captcha
            if (!this.config.twoCaptchaKey || this.config.twoCaptchaKey === '87fd25839e716a8ad24b3cbb81067b75') {
                console.log('⚠️ Usando chave padrão do 2captcha - pode não funcionar');
            }
            
            // Verificar se arquivo de gift codes existe
            const fs = require('fs');
            if (!fs.existsSync(this.config.giftCodesFile)) {
                return {
                    success: false,
                    moduleName: this.config.name,
                    error: `Arquivo de gift codes não encontrado: ${this.config.giftCodesFile}`,
                    stats: this.stats
                };
            }
            
            // Verificar se há códigos disponíveis
            const codes = this.carregarCodigos();
            const availableCodes = codes.filter(c => !c.usado);
            
            if (availableCodes.length === 0) {
                return {
                    success: false,
                    moduleName: this.config.name,
                    error: 'Nenhum gift code disponível para teste',
                    stats: this.stats
                };
            }
            
            // Testar login
            const loginResult = await this.fazerLogin();
            
            return {
                success: loginResult.sucesso,
                moduleName: this.config.name,
                loginStatus: loginResult.sucesso ? 'OK' : 'FALHA',
                availableCodes: availableCodes.length,
                captchaSupport: 'Cloudflare Turnstile via 2captcha',
                error: loginResult.erro || null,
                stats: this.stats
            };
            
        } catch (error) {
            return {
                success: false,
                moduleName: this.config.name,
                error: error.message,
                stats: this.stats
            };
        }
    }
    
    getStats() {
        return {
            ...this.stats,
            successRate: this.stats.activations > 0 ? 
                ((this.stats.successes / this.stats.activations) * 100).toFixed(1) + '%' : '0%'
        };
    }
}

// Função de fábrica
function createActivator(config = {}) {
    return new SmartOneIPTVActivator(config);
}

// Exports
module.exports = {
    SmartOneIPTVActivator,
    createActivator
};

// Teste direto se executado
if (require.main === module) {
    const activator = createActivator();
    activator.test().then(result => {
        console.log('\n=== TESTE SMARTONE IPTV COM MENSAGEM PERSONALIZADA ===');
        console.log('Status:', result.success ? '✅ SUCESSO' : '❌ FALHA');
        console.log('Módulo:', result.moduleName);
        console.log('Login:', result.loginStatus);
        if (result.availableCodes) {
            console.log('Códigos disponíveis:', result.availableCodes);
        }
        if (result.captchaSupport) {
            console.log('Suporte CAPTCHA:', result.captchaSupport);
        }
        if (result.error) {
            console.log('Erro:', result.error);
        }
        console.log('Estatísticas:', result.stats);
    }).catch(console.error);
}
