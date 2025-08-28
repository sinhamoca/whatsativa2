// debug-smartone-login.js - Script para debugar o login do SmartOne
const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

class SmartOneLoginDebugger {
    constructor() {
        this.config = {
            email: 'isaacofc2@gmail.com',
            password: 'papangu1',
            loginUrl: 'https://smartone-iptv.com/client/login',
            baseUrl: 'https://smartone-iptv.com'
        };
        
        this.setupClient();
    }
    
    setupClient() {
        this.cookieJar = new tough.CookieJar();
        this.client = wrapper(axios.create({
            jar: this.cookieJar,
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive'
            }
        }));
    }
    
    async debugCompleto() {
        console.log('🔍 DEBUG COMPLETO DO LOGIN SMARTONE');
        console.log('═'.repeat(60));
        
        try {
            // 1. Testar conectividade básica
            console.log('\n🌐 1. TESTANDO CONECTIVIDADE:');
            await this.testarConectividade();
            
            // 2. Obter página de login
            console.log('\n📄 2. OBTENDO PÁGINA DE LOGIN:');
            const loginPageData = await this.obterPaginaLoginDetalhado();
            
            // 3. Analisar formulário
            console.log('\n🔍 3. ANALISANDO FORMULÁRIO:');
            this.analisarFormulario(loginPageData);
            
            // 4. Tentar login
            console.log('\n🔐 4. TENTANDO LOGIN:');
            const loginResult = await this.tentarLogin(loginPageData);
            
            // 5. Analisar resposta
            console.log('\n📊 5. ANALISANDO RESPOSTA:');
            this.analisarRespostaLogin(loginResult);
            
        } catch (error) {
            console.error('❌ Erro no debug:', error.message);
            if (error.code) {
                console.log(`🔧 Código do erro: ${error.code}`);
            }
            if (error.response) {
                console.log(`📡 Status HTTP: ${error.response.status}`);
                console.log(`📨 Headers:`, Object.keys(error.response.headers));
            }
        }
    }
    
    async testarConectividade() {
        try {
            console.log(`🎯 Testando: ${this.config.baseUrl}`);
            
            const response = await axios.get(this.config.baseUrl, {
                timeout: 10000,
                maxRedirects: 5
            });
            
            console.log(`✅ Status: ${response.status}`);
            console.log(`📏 Tamanho: ${response.data.length} caracteres`);
            console.log(`🔄 Redirecionamentos: ${response.request._redirectCount || 0}`);
            
            // Verificar se é página válida
            if (response.data.includes('smartone') || response.data.includes('login')) {
                console.log('✅ Página parece válida (contém elementos esperados)');
            } else {
                console.log('⚠️ Página pode ter mudado (não contém elementos esperados)');
            }
            
        } catch (error) {
            console.error('❌ Falha na conectividade:', error.message);
            throw error;
        }
    }
    
    async obterPaginaLoginDetalhado() {
        try {
            console.log(`🎯 Acessando: ${this.config.loginUrl}`);
            
            const response = await this.client.get(this.config.loginUrl);
            
            console.log(`✅ Status: ${response.status}`);
            console.log(`📏 Tamanho: ${response.data.length} caracteres`);
            console.log(`🍪 Cookies recebidos: ${this.cookieJar.getCookiesSync(this.config.loginUrl).length}`);
            
            // Verificar redirecionamentos
            const finalUrl = response.request.res.responseUrl || response.config.url;
            if (finalUrl !== this.config.loginUrl) {
                console.log(`🔄 Redirecionado para: ${finalUrl}`);
            }
            
            // Salvar HTML para análise
            const fs = require('fs');
            fs.writeFileSync('./debug_login_page.html', response.data);
            console.log('💾 Página salva em: ./debug_login_page.html');
            
            return {
                html: response.data,
                status: response.status,
                finalUrl: finalUrl,
                cookies: this.cookieJar.getCookiesSync(this.config.loginUrl)
            };
            
        } catch (error) {
            console.error('❌ Erro ao obter página de login:', error.message);
            throw error;
        }
    }
    
    analisarFormulario(pageData) {
        const html = pageData.html;
        
        // Procurar formulários
        const forms = html.match(/<form[^>]*>[\s\S]*?<\/form>/gi) || [];
        console.log(`📋 Formulários encontrados: ${forms.length}`);
        
        forms.forEach((form, index) => {
            console.log(`\n📄 FORMULÁRIO ${index + 1}:`);
            
            // Action
            const actionMatch = form.match(/action=["']([^"']*)["']/i);
            const action = actionMatch ? actionMatch[1] : 'não encontrado';
            console.log(`   Action: ${action}`);
            
            // Method
            const methodMatch = form.match(/method=["']([^"']*)["']/i);
            const method = methodMatch ? methodMatch[1] : 'GET';
            console.log(`   Method: ${method}`);
            
            // Inputs
            const inputs = form.match(/<input[^>]*>/gi) || [];
            console.log(`   Inputs: ${inputs.length}`);
            
            inputs.forEach(input => {
                const nameMatch = input.match(/name=["']([^"']*)["']/i);
                const typeMatch = input.match(/type=["']([^"']*)["']/i);
                const valueMatch = input.match(/value=["']([^"']*)["']/i);
                
                const name = nameMatch ? nameMatch[1] : 'sem nome';
                const type = typeMatch ? typeMatch[1] : 'text';
                const value = valueMatch ? valueMatch[1] : '';
                
                console.log(`     • ${type}: ${name} = "${value}"`);
            });
        });
        
        // Procurar por captcha/proteção
        console.log('\n🛡️ VERIFICANDO PROTEÇÕES:');
        
        if (html.includes('turnstile') || html.includes('cf-turnstile')) {
            console.log('❌ Cloudflare Turnstile detectado');
        } else if (html.includes('recaptcha') || html.includes('g-recaptcha')) {
            console.log('❌ reCAPTCHA detectado');
        } else if (html.includes('hcaptcha') || html.includes('h-captcha')) {
            console.log('❌ hCaptcha detectado');
        } else {
            console.log('✅ Nenhuma proteção CAPTCHA detectada');
        }
        
        // Verificar JavaScript que pode interferir
        if (html.includes('csrf') || html.includes('CSRF')) {
            console.log('🔒 CSRF protection detectado');
        }
        
        if (html.includes('fetch(') || html.includes('XMLHttpRequest')) {
            console.log('⚠️ AJAX/Fetch detectado (pode ser login via JavaScript)');
        }
    }
    
    async tentarLogin(pageData) {
        try {
            const loginData = this.extrairDadosLogin(pageData.html);
            
            console.log('📝 Dados extraídos para login:');
            console.log(`   Email field: ${loginData.emailFieldName}`);
            console.log(`   Password field: ${loginData.passwordFieldName}`);
            console.log(`   CSRF token: ${loginData.csrfToken ? 'encontrado' : 'não encontrado'}`);
            console.log(`   Action: ${loginData.action}`);
            console.log(`   Extra fields: ${Object.keys(loginData.extraFields).length}`);
            
            // Preparar dados
            const formData = new URLSearchParams();
            formData.append(loginData.emailFieldName || 'email', this.config.email);
            formData.append(loginData.passwordFieldName || 'password', this.config.password);
            
            if (loginData.csrfToken) {
                formData.append(loginData.csrfFieldName, loginData.csrfToken);
            }
            
            Object.entries(loginData.extraFields).forEach(([key, value]) => {
                formData.append(key, value);
            });
            
            formData.append('remember', '0');
            
            console.log('📤 Dados que serão enviados:');
            for (const [key, value] of formData.entries()) {
                if (key.toLowerCase().includes('password')) {
                    console.log(`   ${key}: ***`);
                } else {
                    console.log(`   ${key}: ${value}`);
                }
            }
            
            // URL de destino
            const loginUrl = loginData.action ? 
                (loginData.action.startsWith('http') ? loginData.action : this.config.baseUrl + loginData.action) :
                this.config.loginUrl;
            
            console.log(`🎯 Enviando para: ${loginUrl}`);
            
            // Fazer POST
            const response = await this.client.post(loginUrl, formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': this.config.loginUrl,
                    'Origin': this.config.baseUrl
                },
                maxRedirects: 5
            });
            
            // Aguardar
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            return {
                status: response.status,
                finalUrl: response.request.res.responseUrl || response.config.url,
                html: response.data,
                success: true
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                status: error.response?.status,
                html: error.response?.data
            };
        }
    }
    
    analisarRespostaLogin(result) {
        if (!result.success) {
            console.log(`❌ Falha na requisição: ${result.error}`);
            if (result.status) {
                console.log(`📡 Status HTTP: ${result.status}`);
            }
            return;
        }
        
        console.log(`✅ Status: ${result.status}`);
        console.log(`🌐 URL final: ${result.finalUrl}`);
        
        // Analisar se login foi bem-sucedido
        const loginSuccess = this.verificarSucessoLogin(result.finalUrl, result.html);
        
        if (loginSuccess) {
            console.log('🎉 LOGIN BEM-SUCEDIDO!');
        } else {
            console.log('❌ LOGIN FALHOU');
            
            // Procurar mensagens de erro
            const errors = this.extrairMensagensErro(result.html);
            if (errors.length > 0) {
                console.log('📨 Mensagens de erro encontradas:');
                errors.forEach(error => console.log(`   • ${error}`));
            }
        }
        
        // Salvar resposta para análise
        const fs = require('fs');
        fs.writeFileSync('./debug_login_response.html', result.html);
        console.log('💾 Resposta salva em: ./debug_login_response.html');
    }
    
    verificarSucessoLogin(finalUrl, html) {
        // Verificar URL
        if (finalUrl.includes('/client') && !finalUrl.includes('/login')) {
            return true;
        }
        
        // Verificar conteúdo
        if (html.includes('dashboard') || html.includes('logout') || html.includes('welcome')) {
            return true;
        }
        
        return false;
    }
    
    extrairMensagensErro(html) {
        const errors = [];
        
        // Procurar divs de erro comuns
        const errorPatterns = [
            /<div[^>]*class=["'][^"']*alert-danger[^"']*["'][^>]*>(.*?)<\/div>/gis,
            /<div[^>]*class=["'][^"']*error[^"']*["'][^>]*>(.*?)<\/div>/gis,
            /<span[^>]*class=["'][^"']*error[^"']*["'][^>]*>(.*?)<\/span>/gis
        ];
        
        errorPatterns.forEach(pattern => {
            const matches = html.match(pattern);
            if (matches) {
                matches.forEach(match => {
                    const text = match.replace(/<[^>]*>/g, '').trim();
                    if (text && text.length > 0) {
                        errors.push(text);
                    }
                });
            }
        });
        
        return errors;
    }
    
    extrairDadosLogin(html) {
        const data = {
            action: null,
            csrfToken: null,
            csrfFieldName: null,
            emailFieldName: null,
            passwordFieldName: null,
            extraFields: {}
        };

        // Action
        const formMatch = html.match(/<form[^>]*action=["']([^"']*)["'][^>]*>/i);
        if (formMatch) data.action = formMatch[1];

        // Email field
        const emailPatterns = [
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

        // Password field
        const passwordMatch = html.match(/<input[^>]*type=["']password["'][^>]*name=["']([^"']*)["'][^>]*>/i);
        if (passwordMatch) data.passwordFieldName = passwordMatch[1];

        // CSRF
        const csrfPatterns = [
            /<input[^>]*name=["']_csrf_token["'][^>]*value=["']([^"']*)["'][^>]*>/i,
            /<input[^>]*name=["']_token["'][^>]*value=["']([^"']*)["'][^>]*>/i
        ];

        for (let pattern of csrfPatterns) {
            const match = html.match(pattern);
            if (match) {
                data.csrfToken = match[1];
                data.csrfFieldName = pattern.source.includes('_csrf_token') ? '_csrf_token' : '_token';
                break;
            }
        }

        // Hidden fields
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
}

// Executar debug
if (require.main === module) {
    const loginDebugger = new SmartOneLoginDebugger();
    loginDebugger.debugCompleto().catch(console.error);
}

module.exports = SmartOneLoginDebugger;
