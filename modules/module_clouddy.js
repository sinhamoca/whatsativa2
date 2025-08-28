// modules/module_clouddy.js - Módulo Clouddy (FORMATO CORRETO)

const axios = require('axios');
const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

class ClouddyActivator {
    constructor(config = {}) {
        this.config = {
            name: 'Clouddy Online',
            version: '2.0.0',
            ...config
        };
        
        this.captchaApiKey = "87fd25839e716a8ad24b3cbb81067b75";
        this.siteKey = "6Lfd6ncaAAAAAPoHB9FE5H21kyIcjKgti9vv8fmJ";
        this.loginUrl = "https://console.clouddy.online/user/auth/login";
        this.activationUrl = "https://console.clouddy.online/user/refill/4";
        this.captchaUrl = "http://2captcha.com/in.php";
        this.captchaResultUrl = "http://2captcha.com/res.php";
        this.cookies = {};
        this.driver = null;
        
        // Configurar axios
        this.axiosInstance = axios.create({
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
                'Connection': 'keep-alive',
            },
            withCredentials: true,
            maxRedirects: 5,
            validateStatus: (status) => status < 500
        });

        console.log(`[Clouddy] 🌟 Módulo inicializado - v${this.config.version}`);
    }

    // Método obrigatório: extrair dados de ativação
    extractActivationData(message) {
        try {
            const lines = message.split('\n').map(line => line.trim()).filter(line => line);
            
            let email = null;
            let password = null;
            
            // Procurar por padrões de email e senha
            for (const line of lines) {
                // Email
                if (!email && (line.includes('@') || line.toLowerCase().includes('email'))) {
                    const emailMatch = line.match(/[\w.-]+@[\w.-]+\.\w+/);
                    if (emailMatch) {
                        email = emailMatch[0];
                    } else if (line.includes(':')) {
                        email = line.split(':')[1].trim();
                    }
                }
                
                // Senha
                if (!password && (line.toLowerCase().includes('senha') || line.toLowerCase().includes('password'))) {
                    if (line.includes(':')) {
                        password = line.split(':')[1].trim();
                    }
                } else if (!password && email && line !== email) {
                    // Se já temos email, a próxima linha pode ser a senha
                    password = line;
                }
            }
            
            console.log(`[Clouddy] 📧 Email extraído: ${email}`);
            console.log(`[Clouddy] 🔑 Senha extraída: ${password ? '[PRESENTE]' : '[AUSENTE]'}`);
            
            return { email, password };
            
        } catch (error) {
            console.error(`[Clouddy] ❌ Erro ao extrair dados:`, error);
            return { email: null, password: null };
        }
    }

    // Aguardar tempo
    sleep(seconds) {
        return new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }

    // Resolver CAPTCHA
    async solveCaptcha() {
        console.log("[Clouddy] 🔄 Resolvendo CAPTCHA...");
        
        try {
            // Enviar CAPTCHA
            const response = await axios.post(this.captchaUrl, null, {
                params: {
                    key: this.captchaApiKey,
                    method: 'userrecaptcha',
                    googlekey: this.siteKey,
                    pageurl: this.loginUrl,
                    json: 1
                }
            });
            
            if (response.data.status !== 1) {
                throw new Error(response.data.error_text || 'Erro ao enviar CAPTCHA');
            }
            
            const captchaId = response.data.request;
            console.log(`[Clouddy] ✅ CAPTCHA enviado: ${captchaId}`);
            
            // Aguardar resolução
            for (let attempt = 0; attempt < 30; attempt++) {
                await this.sleep(3);
                
                const resultResponse = await axios.get(this.captchaResultUrl, {
                    params: {
                        key: this.captchaApiKey,
                        action: 'get',
                        id: captchaId,
                        json: 1
                    }
                });
                
                if (resultResponse.data.status === 1) {
                    console.log("[Clouddy] ✅ CAPTCHA resolvido!");
                    return resultResponse.data.request;
                }
                
                if (resultResponse.data.request !== 'CAPCHA_NOT_READY') {
                    throw new Error(resultResponse.data.error_text || 'Erro na resolução');
                }
            }
            
            throw new Error('Timeout na resolução do CAPTCHA');
            
        } catch (error) {
            console.error(`[Clouddy] ❌ Erro no CAPTCHA: ${error.message}`);
            return null;
        }
    }

    // Login na plataforma
    async login(email, password) {
        console.log(`[Clouddy] 🔐 Fazendo login: ${email}`);
        
        try {
            // Obter cookies de sessão
            const sessionResponse = await this.axiosInstance.get(this.loginUrl);
            
            // Extrair cookies
            const setCookies = sessionResponse.headers['set-cookie'];
            if (setCookies) {
                setCookies.forEach(cookie => {
                    const [nameValue] = cookie.split(';');
                    const [name, value] = nameValue.split('=');
                    if (name && value) {
                        this.cookies[name] = value;
                    }
                });
            }
            
            // Resolver CAPTCHA
            const captchaToken = await this.solveCaptcha();
            if (!captchaToken) {
                throw new Error('Falha na resolução do CAPTCHA');
            }
            
            // Dados do formulário
            const formData = new URLSearchParams();
            formData.append('form[email]', email);
            formData.append('form[password]', password);
            formData.append('g-recaptcha-response', captchaToken);
            
            // Enviar login
            const loginResponse = await this.axiosInstance.post(this.loginUrl, formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Origin': 'https://console.clouddy.online',
                    'Referer': this.loginUrl,
                    'Cookie': Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ')
                }
            });
            
            // Atualizar cookies
            const newCookies = loginResponse.headers['set-cookie'];
            if (newCookies) {
                newCookies.forEach(cookie => {
                    const [nameValue] = cookie.split(';');
                    const [name, value] = nameValue.split('=');
                    if (name && value) {
                        this.cookies[name] = value;
                    }
                });
            }
            
            // Verificar sucesso
            const finalUrl = loginResponse.request?.res?.responseUrl || loginResponse.config.url;
            const success = !finalUrl.includes('auth/login');
            
            console.log(`[Clouddy] ${success ? '✅' : '❌'} Login: ${success ? 'sucesso' : 'falhou'}`);
            return success;
            
        } catch (error) {
            console.error(`[Clouddy] ❌ Erro no login: ${error.message}`);
            return false;
        }
    }

    // Inicializar navegador
    async initBrowser() {
        try {
            console.log("[Clouddy] 🌐 Iniciando navegador...");
            
            const options = new chrome.Options();
            options.addArguments('--headless');
            options.addArguments('--no-sandbox');
            options.addArguments('--disable-dev-shm-usage');
            options.addArguments('--disable-gpu');
            options.addArguments('--window-size=1920,1080');
            options.addArguments('--disable-blink-features=AutomationControlled');
            options.excludeSwitches('enable-automation');
            
            this.driver = await new Builder()
                .forBrowser('chrome')
                .setChromeOptions(options)
                .build();
            
            // Anti-detecção
            await this.driver.executeScript(
                "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
            );
            
            console.log("[Clouddy] ✅ Navegador iniciado");
            return true;
            
        } catch (error) {
            console.error(`[Clouddy] ❌ Erro no navegador: ${error.message}`);
            return false;
        }
    }

    // Transferir sessão para navegador
    async transferSession() {
        try {
            console.log("[Clouddy] 🔄 Transferindo sessão...");
            
            await this.driver.get("https://console.clouddy.online");
            await this.sleep(2);
            
            // Adicionar cookies
            for (const [name, value] of Object.entries(this.cookies)) {
                try {
                    await this.driver.manage().addCookie({
                        name: name,
                        value: value,
                        domain: '.clouddy.online',
                        path: '/',
                        secure: true
                    });
                } catch (cookieError) {
                    console.log(`[Clouddy] ⚠️ Erro ao adicionar cookie ${name}`);
                }
            }
            
            await this.driver.navigate().refresh();
            await this.sleep(2);
            
            console.log("[Clouddy] ✅ Sessão transferida");
            return true;
            
        } catch (error) {
            console.error(`[Clouddy] ❌ Erro na transferência: ${error.message}`);
            return false;
        }
    }

    // Executar ativação completa
    async performActivation(email) {
        try {
            console.log("[Clouddy] 🚀 Executando ativação...");
            
            // Ir para página de ativação
            await this.driver.get(this.activationUrl);
            await this.sleep(3);
            
            // Verificar se chegou na página correta
            const currentUrl = await this.driver.getCurrentUrl();
            if (!currentUrl.includes("refill")) {
                throw new Error('Não conseguiu acessar página de ativação');
            }
            
            // 1. Marcar checkbox de confirmação
            try {
                const checkbox = await this.driver.wait(
                    until.elementLocated(By.id("form_confirm")), 10000
                );
                await this.driver.executeScript("arguments[0].click();", checkbox);
                console.log("[Clouddy] ✅ Checkbox marcado");
            } catch (error) {
                console.log("[Clouddy] ⚠️ Erro no checkbox, continuando...");
            }
            
            // 2. Aguardar tempo necessário
            console.log("[Clouddy] ⏳ Aguardando processamento (35s)...");
            await this.sleep(35);
            
            // 3. Clicar em "Aceitar"
            try {
                const acceptButton = await this.driver.findElement(By.id("form_confirm-agree"));
                await this.driver.executeScript("arguments[0].click();", acceptButton);
                console.log("[Clouddy] ✅ Botão aceitar clicado");
            } catch (error) {
                console.log("[Clouddy] ⚠️ Erro no botão aceitar, continuando...");
            }
            
            await this.sleep(2);
            
            // 4. Selecionar método de pagamento Stripe
            try {
                const stripeRadio = await this.driver.findElement(
                    By.css("input[type='radio'][value='stripe']")
                );
                await this.driver.executeScript("arguments[0].click();", stripeRadio);
                console.log("[Clouddy] ✅ Stripe selecionado");
            } catch (error) {
                console.log("[Clouddy] ⚠️ Erro ao selecionar Stripe");
            }
            
            await this.sleep(1);
            
            // 5. Clicar em "Prosseguir para pagamento"
            try {
                const buttons = await this.driver.findElements(By.tagName("button"));
                let submitButton = null;
                
                for (const btn of buttons) {
                    const text = await btn.getText();
                    if (text.toLowerCase().includes("prossiga") || text.toLowerCase().includes("pagar")) {
                        submitButton = btn;
                        break;
                    }
                }
                
                if (!submitButton) {
                    submitButton = await this.driver.findElement(
                        By.css("button[type='submit'].btn-success")
                    );
                }
                
                await this.driver.executeScript("arguments[0].scrollIntoView(true);", submitButton);
                await this.sleep(1);
                await this.driver.executeScript("arguments[0].click();", submitButton);
                
                console.log("[Clouddy] ✅ Botão pagar clicado");
                await this.sleep(5);
                
            } catch (error) {
                throw new Error(`Erro ao clicar no botão de pagamento: ${error.message}`);
            }
            
            return true;
            
        } catch (error) {
            console.error(`[Clouddy] ❌ Erro na ativação: ${error.message}`);
            return false;
        }
    }

    // Preencher dados do Stripe
    async fillStripeCheckout(email) {
        try {
            console.log("[Clouddy] 💳 Preenchendo checkout...");
            
            await this.sleep(5);
            
            const currentUrl = await this.driver.getCurrentUrl();
            if (!currentUrl.includes("checkout.stripe.com")) {
                throw new Error('Não redirecionou para Stripe');
            }
            
            // Preencher email
            const emailField = await this.driver.wait(
                until.elementLocated(By.id("email")), 15000
            );
            await emailField.clear();
            await emailField.sendKeys(email);
            
            // Navegar pelos campos com TAB
            await emailField.sendKeys(Key.TAB);
            await this.sleep(0.5);
            
            // Número do cartão (usando dados de teste do seu código original)
            let activeElement = await this.driver.switchTo().activeElement();
            await activeElement.sendKeys("4174010085377936");
            await activeElement.sendKeys(Key.TAB);
            await this.sleep(0.5);
            
            // Data de validade
            activeElement = await this.driver.switchTo().activeElement();
            await activeElement.sendKeys("0726");
            await activeElement.sendKeys(Key.TAB);
            await this.sleep(0.5);
            
            // CVV
            activeElement = await this.driver.switchTo().activeElement();
            await activeElement.sendKeys("399");
            await activeElement.sendKeys(Key.TAB);
            await this.sleep(0.5);
            
            // Nome no cartão
            activeElement = await this.driver.switchTo().activeElement();
            await activeElement.sendKeys("ISAAC MENDES");
            await this.sleep(2);
            
            console.log("[Clouddy] ✅ Dados preenchidos");
            return true;
            
        } catch (error) {
            console.error(`[Clouddy] ❌ Erro no checkout: ${error.message}`);
            return false;
        }
    }

    // Finalizar pagamento
    async completePayment() {
        try {
            console.log("[Clouddy] 💰 Finalizando pagamento...");
            
            // Procurar botão de pagamento
            const buttons = await this.driver.findElements(By.tagName("button"));
            let payButton = null;
            
            for (const btn of buttons) {
                const text = await btn.getText();
                if (text.toLowerCase().includes("pagar") || text.toLowerCase().includes("pay")) {
                    payButton = btn;
                    break;
                }
            }
            
            if (!payButton) {
                payButton = await this.driver.findElement(
                    By.css(".SubmitButton, button[type='submit']")
                );
            }
            
            if (payButton) {
                await this.driver.executeScript("arguments[0].scrollIntoView(true);", payButton);
                await this.sleep(1);
                
                try {
                    await payButton.click();
                } catch (error) {
                    await this.driver.executeScript("arguments[0].click();", payButton);
                }
                
                console.log("[Clouddy] ⏳ Processando pagamento...");
                
                // Aguardar redirecionamento
                for (let i = 0; i < 30; i++) {
                    await this.sleep(1);
                    const url = await this.driver.getCurrentUrl();
                    if (!url.includes("checkout.stripe.com")) {
                        break;
                    }
                }
                
                await this.sleep(3);
                return true;
            }
            
            throw new Error('Botão de pagamento não encontrado');
            
        } catch (error) {
            console.error(`[Clouddy] ❌ Erro no pagamento: ${error.message}`);
            return false;
        }
    }

    // Verificar resultado final
    async checkResult(email) {
        try {
            const finalUrl = await this.driver.getCurrentUrl();
            console.log(`[Clouddy] 🔍 URL final: ${finalUrl}`);
            
            const isSuccess = finalUrl.toLowerCase().includes("success") ||
                            finalUrl.toLowerCase().includes("complete") ||
                            finalUrl.toLowerCase().includes("confirmed");
            
            if (isSuccess) {
                // Calcular data de validade (1 ano)
                const hoje = new Date();
                const validade = new Date();
                validade.setFullYear(hoje.getFullYear() + 1);
                const validadeFormatada = validade.toLocaleDateString('pt-BR');
                
                console.log("[Clouddy] ✅ Ativação bem-sucedida!");
                
                return {
                    success: true,
                    email: email,
                    validUntil: validadeFormatada,
                    finalUrl: finalUrl
                };
            } else {
                console.log("[Clouddy] ❌ Ativação não confirmada");
                return {
                    success: false,
                    finalUrl: finalUrl
                };
            }
            
        } catch (error) {
            console.error(`[Clouddy] ❌ Erro ao verificar resultado: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Fechar navegador
    async cleanup() {
        if (this.driver) {
            try {
                await this.driver.quit();
                this.driver = null;
                console.log("[Clouddy] 🧹 Navegador fechado");
            } catch (error) {
                console.log("[Clouddy] ⚠️ Erro ao fechar navegador");
            }
        }
    }

    // MÉTODO PRINCIPAL - chamado pelo sistema
    async activate(activationData, order) {
        const startTime = Date.now();
        
        try {
            console.log(`[Clouddy] 🚀 === INÍCIO DA ATIVAÇÃO ===`);
            console.log(`[Clouddy] 📋 Pedido: ${order.id}`);
            console.log(`[Clouddy] 📱 Produto: ${order.product.name}`);
            console.log(`[Clouddy] 📄 Dados: ${activationData}`);
            
            // 1. Extrair email e senha
            const { email, password } = this.extractActivationData(activationData);
            
            if (!email || !password) {
                throw new Error('Email ou senha não encontrados. Formato: email@exemplo.com\\nsuasenha123');
            }
            
            // 2. Fazer login
            const loginSuccess = await this.login(email, password);
            if (!loginSuccess) {
                throw new Error('Falha no login - verifique email e senha');
            }
            
            // 3. Inicializar navegador
            const browserSuccess = await this.initBrowser();
            if (!browserSuccess) {
                throw new Error('Falha ao iniciar navegador');
            }
            
            // 4. Transferir sessão
            const sessionSuccess = await this.transferSession();
            if (!sessionSuccess) {
                await this.cleanup();
                throw new Error('Falha ao transferir sessão');
            }
            
            // 5. Executar ativação
            const activationSuccess = await this.performActivation(email);
            if (!activationSuccess) {
                await this.cleanup();
                throw new Error('Falha no processo de ativação');
            }
            
            // 6. Preencher checkout
            const checkoutSuccess = await this.fillStripeCheckout(email);
            if (!checkoutSuccess) {
                await this.cleanup();
                throw new Error('Falha no preenchimento do checkout');
            }
            
            // 7. Finalizar pagamento
            const paymentSuccess = await this.completePayment();
            if (!paymentSuccess) {
                await this.cleanup();
                throw new Error('Falha no pagamento');
            }
            
            // 8. Verificar resultado
            const result = await this.checkResult(email);
            await this.cleanup();
            
            const duration = (Date.now() - startTime) / 1000;
            
            if (result.success) {
                // MENSAGEM PERSONALIZADA PARA WHATSAPP (seguindo padrão SmartOne/Duplecast)
                const mensagemPersonalizada = `🎉 *CLOUDDY ATIVADO COM SUCESSO!*

📱 *Sua conta premium está pronta!*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *DETALHES DA ATIVAÇÃO:*

📧 *Email:* ${result.email}
📅 *Ativado em:* ${new Date().toLocaleDateString('pt-BR')}
⏰ *Válido até:* ${result.validUntil}
🎯 *Plataforma:* Clouddy Online Premium

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 *Para acessar sua conta:*
• Vá para: https://console.clouddy.online
• Faça login com suas credenciais
• Aproveite 1 ano completo de streaming!

🔄 Digite *menu* para nova ativação
💡 Digite *suporte* para ajuda

✨ *Obrigado por confiar em nossos serviços!*`;

                return {
                    success: true,
                    message: mensagemPersonalizada,
                    data: {
                        email: result.email,
                        validUntil: result.validUntil,
                        activatedAt: new Date().toLocaleDateString('pt-BR'),
                        service: 'Clouddy Online',
                        finalUrl: result.finalUrl
                    },
                    details: {
                        email: result.email,
                        validUntil: result.validUntil,
                        duration: `${duration.toFixed(1)}s`,
                        finalUrl: result.finalUrl
                    }
                };
            } else {
                throw new Error(`Ativação não foi confirmada. URL final: ${result.finalUrl}`);
            }
            
        } catch (error) {
            await this.cleanup();
            const duration = (Date.now() - startTime) / 1000;
            
            console.error(`[Clouddy] ❌ ERRO: ${error.message}`);
            
            // MENSAGEM DE ERRO PERSONALIZADA
            return {
                success: false,
                error: error.message,
                message: `❌ *ERRO NA ATIVAÇÃO CLOUDDY*

🚨 *Motivo:* ${error.message}

💡 *Possíveis soluções:*
• Verifique se o email e senha estão corretos
• Tente novamente em alguns minutos
• Entre em contato com o suporte

🆘 *Suporte:* Se o problema persistir, entre em contato
🔄 *Nova tentativa:* Digite *menu*

💳 *Importante:* Seu crédito foi preservado`,
                data: {
                    duration: `${duration.toFixed(1)}s`
                },
                details: {
                    duration: `${duration.toFixed(1)}s`
                }
            };
        }
    }

    // Método de teste
    async test() {
        try {
            console.log("[Clouddy] 🧪 Executando teste básico...");
            
            // Testar resolução de CAPTCHA
            const captchaWorking = await this.solveCaptcha();
            
            return {
                success: !!captchaWorking,
                details: {
                    captchaService: !!captchaWorking,
                    dependencies: true,
                    config: true
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// EXPORTAÇÃO CORRETA - FUNDAMENTAL!
module.exports = ClouddyActivator;