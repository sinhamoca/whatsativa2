#!/usr/bin/env node
/**
 * Sistema de Ativação Automatizada Clouddy Console
 * Versão: Node.js Production 1.0
 */

const axios = require('axios');
const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const readline = require('readline');

class ClouddyActivator {
    constructor(captchaApiKey) {
        this.captchaApiKey = captchaApiKey;
        this.siteKey = "6Lfd6ncaAAAAAPoHB9FE5H21kyIcjKgti9vv8fmJ";
        this.loginUrl = "https://console.clouddy.online/user/auth/login";
        this.activationUrl = "https://console.clouddy.online/user/refill/4";
        this.captchaUrl = "http://2captcha.com/in.php";
        this.captchaResultUrl = "http://2captcha.com/res.php";
        this.cookies = {};
        this.driver = null;
        
        // Configurar axios com headers padrão
        this.axiosInstance = axios.create({
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            withCredentials: true,
            maxRedirects: 5,
            validateStatus: (status) => status < 500
        });
    }

    /**
     * Aguarda um tempo especificado
     */
    sleep(seconds) {
        return new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }

    /**
     * Resolve o reCAPTCHA com sistema de retry
     */
    async solveRecaptchaWithRetry(maxRetries = 3) {
        for (let retry = 0; retry < maxRetries; retry++) {
            if (retry > 0) {
                console.log(`🔄 Tentativa ${retry + 1} de ${maxRetries}`);
            }
            
            const token = await this.solveRecaptchaAttempt();
            if (token) {
                return token;
            }
            
            if (retry < maxRetries - 1) {
                console.log("⏳ Aguardando 5 segundos antes de tentar novamente...");
                await this.sleep(5);
            }
        }
        
        console.log(`❌ Falha após ${maxRetries} tentativas de resolver o captcha`);
        return null;
    }

    /**
     * Faz uma tentativa de resolver o reCAPTCHA
     */
    async solveRecaptchaAttempt() {
        console.log("🔄 Enviando captcha para o 2captcha...");
        
        try {
            // Envia o captcha
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
                console.log(`❌ Erro ao enviar: ${response.data.error_text || 'Erro desconhecido'}`);
                return null;
            }
            
            const captchaId = response.data.request;
            console.log(`✅ Captcha enviado! ID: ${captchaId}`);
            console.log("⏳ Aguardando resolução...");
            
            // Aguarda resolução (máximo 15 tentativas = 90 segundos)
            for (let attempt = 0; attempt < 15; attempt++) {
                await this.sleep(6);
                
                const resultResponse = await axios.get(this.captchaResultUrl, {
                    params: {
                        key: this.captchaApiKey,
                        action: 'get',
                        id: captchaId,
                        json: 1
                    }
                });
                
                if (resultResponse.data.status === 1) {
                    console.log("✅ Captcha resolvido!");
                    return resultResponse.data.request;
                } else if (resultResponse.data.request !== 'CAPCHA_NOT_READY') {
                    console.log(`❌ Erro: ${resultResponse.data.error_text || 'Erro desconhecido'}`);
                    return null;
                }
            }
            
            console.log("⏱️ Tempo limite excedido (90 segundos)");
            return null;
            
        } catch (error) {
            console.log(`❌ Erro de comunicação: ${error.message}`);
            return null;
        }
    }

    /**
     * Realiza o login via requests
     */
    async login(email, password) {
        console.log(`\n🔐 Iniciando login: ${email}`);
        
        try {
            // Obtém cookies de sessão
            const sessionResponse = await this.axiosInstance.get(this.loginUrl);
            
            // Extrai cookies
            const setCookies = sessionResponse.headers['set-cookie'];
            if (setCookies) {
                setCookies.forEach(cookie => {
                    const [nameValue] = cookie.split(';');
                    const [name, value] = nameValue.split('=');
                    this.cookies[name] = value;
                });
            }
            
            // Resolve o captcha com retry
            const captchaToken = await this.solveRecaptchaWithRetry();
            if (!captchaToken) {
                return false;
            }
            
            // Prepara dados do formulário
            const formData = new URLSearchParams();
            formData.append('form[email]', email);
            formData.append('form[password]', password);
            formData.append('g-recaptcha-response', captchaToken);
            
            // Envia credenciais
            console.log("🔄 Enviando credenciais...");
            const loginResponse = await this.axiosInstance.post(
                this.loginUrl,
                formData,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Origin': 'https://console.clouddy.online',
                        'Referer': this.loginUrl,
                        'Cookie': Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ')
                    }
                }
            );
            
            // Atualiza cookies
            const newCookies = loginResponse.headers['set-cookie'];
            if (newCookies) {
                newCookies.forEach(cookie => {
                    const [nameValue] = cookie.split(';');
                    const [name, value] = nameValue.split('=');
                    this.cookies[name] = value;
                });
            }
            
            // Verifica sucesso
            if (!loginResponse.request.res.responseUrl.includes('auth/login')) {
                console.log("✅ Login realizado com sucesso!");
                return true;
            } else {
                console.log("❌ Credenciais inválidas");
                return false;
            }
            
        } catch (error) {
            console.log(`❌ Erro no login: ${error.message}`);
            return false;
        }
    }

    /**
     * Inicializa o navegador em modo headless
     */
    async initBrowser() {
        try {
            const options = new chrome.Options();
            options.addArguments('--headless');
            options.addArguments('--no-sandbox');
            options.addArguments('--disable-dev-shm-usage');
            options.addArguments('--disable-gpu');
            options.addArguments('--window-size=1920,1080');
            options.addArguments('--disable-blink-features=AutomationControlled');
            options.excludeSwitches('enable-automation');
            options.setUserPreferences({ 'useAutomationExtension': false });
            
            this.driver = await new Builder()
                .forBrowser('chrome')
                .setChromeOptions(options)
                .build();
            
            await this.driver.executeScript(
                "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
            );
            
            return true;
            
        } catch (error) {
            console.log(`❌ Erro ao iniciar navegador: ${error.message}`);
            return false;
        }
    }

    /**
     * Transfere a sessão para o navegador
     */
    async transferSession() {
        try {
            await this.driver.get("https://console.clouddy.online");
            await this.sleep(2);
            
            // Adiciona cookies
            for (const [name, value] of Object.entries(this.cookies)) {
                await this.driver.manage().addCookie({
                    name: name,
                    value: value,
                    domain: '.clouddy.online',
                    path: '/',
                    secure: true
                });
            }
            
            await this.driver.navigate().refresh();
            await this.sleep(2);
            
            return true;
            
        } catch (error) {
            console.log(`❌ Erro ao transferir sessão: ${error.message}`);
            return false;
        }
    }

    /**
     * Realiza o processo de ativação
     */
    async performActivation() {
        try {
            console.log("\n🚀 Iniciando ativação...");
            
            // Navega para página de ativação
            await this.driver.get(this.activationUrl);
            await this.sleep(3);
            
            const currentUrl = await this.driver.getCurrentUrl();
            if (!currentUrl.includes("refill")) {
                return false;
            }
            
            // Clica no checkbox
            try {
                const checkbox = await this.driver.wait(
                    until.elementLocated(By.id("form_confirm")),
                    10000
                );
                await this.driver.executeScript("arguments[0].click();", checkbox);
            } catch (error) {
                return false;
            }
            
            // Aguarda 35 segundos
            console.log("⏳ Aguardando 35 segundos...");
            await this.sleep(35);
            
            // Clica em Aceita
            try {
                const acceptButton = await this.driver.findElement(By.id("form_confirm-agree"));
                await this.driver.executeScript("arguments[0].click();", acceptButton);
            } catch (error) {
                return false;
            }
            
            await this.sleep(2);
            
            // Seleciona Stripe
            try {
                const stripeRadio = await this.driver.findElement(
                    By.css("input[type='radio'][value='stripe']")
                );
                await this.driver.executeScript("arguments[0].click();", stripeRadio);
            } catch (error) {
                return false;
            }
            
            await this.sleep(1);
            
            // Clica em Prossiga para pagar
            try {
                let submitButton = null;
                const buttons = await this.driver.findElements(By.tagName("button"));
                
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
                
                await this.sleep(5);
                return true;
                
            } catch (error) {
                return false;
            }
            
        } catch (error) {
            console.log(`❌ Erro na ativação: ${error.message}`);
            return false;
        }
    }

    /**
     * Preenche o checkout do Stripe
     */
    async fillCheckout(email) {
        try {
            await this.sleep(5);
            
            const currentUrl = await this.driver.getCurrentUrl();
            if (!currentUrl.includes("checkout.stripe.com")) {
                return false;
            }
            
            console.log("💳 Preenchendo dados de pagamento...");
            
            // Preenche email
            const emailField = await this.driver.wait(
                until.elementLocated(By.id("email")),
                15000
            );
            await emailField.clear();
            await emailField.sendKeys(email);
            await this.sleep(1);
            
            // Navega pelos campos com TAB e preenche
            await emailField.sendKeys(Key.TAB);
            await this.sleep(0.5);
            
            // Número do cartão
            let activeElement = await this.driver.switchTo().activeElement();
            await activeElement.sendKeys("2306504401399793");
            await this.sleep(1);
            await activeElement.sendKeys(Key.TAB);
            await this.sleep(0.5);
            
            // Data de validade
            activeElement = await this.driver.switchTo().activeElement();
            await activeElement.sendKeys("0834");
            await this.sleep(1);
            await activeElement.sendKeys(Key.TAB);
            await this.sleep(0.5);
            
            // CVV
            activeElement = await this.driver.switchTo().activeElement();
            await activeElement.sendKeys("667");
            await this.sleep(1);
            await activeElement.sendKeys(Key.TAB);
            await this.sleep(0.5);
            
            // Nome no cartão
            activeElement = await this.driver.switchTo().activeElement();
            await activeElement.sendKeys("ISAAC MENDES");
            await this.sleep(2);
            
            return true;
            
        } catch (error) {
            console.log(`❌ Erro no checkout: ${error.message}`);
            return false;
        }
    }

    /**
     * Finaliza o pagamento
     */
    async completePayment() {
        try {
            await this.sleep(2);
            
            // Procura botão Pagar
            let payButton = null;
            
            // Busca por texto
            const buttons = await this.driver.findElements(By.tagName("button"));
            for (const btn of buttons) {
                const text = await btn.getText();
                if (text.toLowerCase().includes("pagar") || text.toLowerCase().includes("pay")) {
                    payButton = btn;
                    break;
                }
            }
            
            // Busca por classe
            if (!payButton) {
                try {
                    payButton = await this.driver.findElement(
                        By.css(".SubmitButton, .SubmitButton-Complete")
                    );
                } catch (error) {}
            }
            
            // Busca por tipo submit
            if (!payButton) {
                try {
                    payButton = await this.driver.findElement(By.css("button[type='submit']"));
                } catch (error) {}
            }
            
            if (payButton) {
                await this.driver.executeScript("arguments[0].scrollIntoView(true);", payButton);
                await this.sleep(1);
                
                try {
                    await payButton.click();
                } catch (error) {
                    await this.driver.executeScript("arguments[0].click();", payButton);
                }
                
                console.log("⏳ Processando pagamento...");
                
                // Aguarda redirecionamento
                for (let i = 0; i < 20; i++) {
                    await this.sleep(1);
                    const url = await this.driver.getCurrentUrl();
                    if (!url.includes("checkout.stripe.com")) {
                        break;
                    }
                }
                
                await this.sleep(3);
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.log(`❌ Erro ao finalizar: ${error.message}`);
            return false;
        }
    }

    /**
     * Verifica o resultado da ativação
     */
    async checkResult(email) {
        const finalUrl = await this.driver.getCurrentUrl();
        
        if (finalUrl.toLowerCase().includes("success")) {
            // Calcula validade (hoje + 1 ano)
            const hoje = new Date();
            const validade = new Date(hoje.setFullYear(hoje.getFullYear() + 1));
            const validadeFormatada = validade.toLocaleDateString('pt-BR');
            
            console.log("\n" + "=".repeat(50));
            console.log("✅ Clouddy ativado com sucesso");
            console.log(`E-mail: ${email}`);
            console.log(`Validade: ${validadeFormatada}`);
            console.log("=".repeat(50) + "\n");
            
            return [true, finalUrl];
        } else {
            console.log("\n❌ Falha na ativação");
            return [false, finalUrl];
        }
    }

    /**
     * Fecha o navegador
     */
    async close() {
        if (this.driver) {
            await this.driver.quit();
            this.driver = null;
        }
    }

    /**
     * Executa o processo completo de ativação
     */
    async activate(email, password) {
        try {
            // Login
            if (!await this.login(email, password)) {
                console.log("❌ Falha no login");
                return false;
            }
            
            // Inicia navegador
            if (!await this.initBrowser()) {
                return false;
            }
            
            // Transfere sessão
            if (!await this.transferSession()) {
                await this.close();
                return false;
            }
            
            // Ativa
            if (!await this.performActivation()) {
                console.log("❌ Falha na ativação");
                await this.close();
                return false;
            }
            
            // Preenche checkout
            if (!await this.fillCheckout(email)) {
                console.log("❌ Falha no checkout");
                await this.close();
                return false;
            }
            
            // Completa pagamento
            if (!await this.completePayment()) {
                console.log("❌ Falha no pagamento");
                await this.close();
                return false;
            }
            
            // Verifica resultado
            const [success] = await this.checkResult(email);
            
            await this.close();
            return success;
            
        } catch (error) {
            console.log(`❌ Erro geral: ${error.message}`);
            await this.close();
            return false;
        }
    }
}

/**
 * Função para obter input do usuário
 */
function question(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}

/**
 * Função principal
 */
async function main() {
    const CAPTCHA_API_KEY = "87fd25839e716a8ad24b3cbb81067b75";
    
    let email, password;
    
    // Argumentos da linha de comando
    if (process.argv.length >= 4) {
        email = process.argv[2];
        password = process.argv[3];
    } else {
        console.log("=".repeat(50));
        console.log("SISTEMA DE ATIVAÇÃO CLOUDDY");
        console.log("=".repeat(50));
        email = await question("📧 Email: ");
        password = await question("🔑 Senha: ");
    }
    
    console.log(`\n${"=".repeat(50)}`);
    console.log(`Iniciando ativação para: ${email}`);
    console.log(`${"=".repeat(50)}\n`);
    
    // Executa ativação
    const activator = new ClouddyActivator(CAPTCHA_API_KEY);
    const success = await activator.activate(email, password);
    
    process.exit(success ? 0 : 1);
}

// Executa se for chamado diretamente
if (require.main === module) {
    main().catch(error => {
        console.error("❌ Erro fatal:", error);
        process.exit(1);
    });
}
