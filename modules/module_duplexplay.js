// ==============================================================================
// 📁 modules/module_duplexplay.js - Módulo DuplexPlay Gift Code Activation
// BASEADO EXATAMENTE NO PYTHON FUNCIONANDO
// ==============================================================================

const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { By, until } = require('selenium-webdriver');
const fs = require('fs');
const path = require('path');

class DuplexPlayActivator {
    constructor(config = {}) {
        this.config = {
            name: 'DuplexPlay Gift Code',
            appModule: 'DUPLEXPLAY',
            appId: 999,
            
            // 🔧 CONFIGURAÇÕES EXATAS DO PYTHON
            waitTimeout: 15,
            maxLoginAttempts: 5,
            maxBruteForceAttempts: 15,
            loginUrl: "https://edit.duplexplay.com/Default",
            successUrlPattern: "https://edit.duplexplay.com/DevicePlaylists?",
            activationUrlPattern: "https://edit.duplexplay.com/ActivateDevice?",
            deviceId: "d0:94:66:a7:7a:40",
            deviceKey: "18632356",
            
            // Arquivos
            giftCodesFile: path.join(__dirname, '../data/duplexplay_gift_codes.json'),
            logsDir: path.join(__dirname, '../logs/duplexplay'),
            
            ...config
        };
        
        this.driver = null;
        this.attemptCounter = 0;
        this.bruteForceCounter = 0;
        this.currentGiftCode = null;
        this.targetDeviceId = null;
        this.targetDeviceKey = null;
        
        this.createDirectories();
    }

    // ==============================================================================
    // 🗂️ GESTÃO DE DIRETÓRIOS E ARQUIVOS
    // ==============================================================================

    createDirectories() {
        if (!fs.existsSync(this.config.logsDir)) {
            fs.mkdirSync(this.config.logsDir, { recursive: true });
        }
        
        const dataDir = path.dirname(this.config.giftCodesFile);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }

    logMessage(message, level = "INFO") {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] Tentativa ${this.attemptCounter}: ${message}`;
        
        // Console
        if (level === "ERROR") {
            console.log(`❌ ${message}`);
        } else if (level === "SUCCESS") {
            console.log(`✅ ${message}`);
        } else if (level === "WARNING") {
            console.log(`⚠️ ${message}`);
        } else {
            console.log(`ℹ️ ${message}`);
        }
        
        // Arquivo de log
        const logFile = path.join(this.config.logsDir, `automation_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.log`);
        try {
            fs.appendFileSync(logFile, logEntry + '\n');
        } catch (e) {
            // Ignorar erros de log
        }
    }

    // ==============================================================================
    // 🎁 GESTÃO DE GIFT CODES (EXATO DO PYTHON)
    // ==============================================================================

    createSampleGiftCodesFile() {
        if (!fs.existsSync(this.config.giftCodesFile)) {
            const sampleCodes = [
                {"codigo": "EXEMPLO123ABC", "usado": false, "timestamp_uso": null},
                {"codigo": "TESTE456DEF", "usado": false, "timestamp_uso": null},
                {"codigo": "DEMO789GHI", "usado": false, "timestamp_uso": null}
            ];
            
            fs.writeFileSync(this.config.giftCodesFile, JSON.stringify(sampleCodes, null, 2));
            console.log(`📄 Arquivo de exemplo ${this.config.giftCodesFile} criado`);
            console.log("⚠️ ATENÇÃO: Substitua os códigos de exemplo por códigos reais!");
            return false;
        }
        return true;
    }

    checkAvailableGiftCodes() {
        try {
            console.log("🔍 Verificando códigos de resgate disponíveis...");
            
            if (!fs.existsSync(this.config.giftCodesFile)) {
                console.log(`❌ Arquivo ${this.config.giftCodesFile} não encontrado!`);
                if (!this.createSampleGiftCodesFile()) {
                    return false;
                }
            }
            
            const codesData = JSON.parse(fs.readFileSync(this.config.giftCodesFile, 'utf8'));
            const availableCodes = codesData.filter(code => !code.usado);
            
            if (availableCodes.length === 0) {
                console.log("❌ Nenhum código de resgate disponível!");
                console.log(`📝 Adicione códigos ao arquivo ${this.config.giftCodesFile}`);
                return false;
            }
            
            console.log(`✅ ${availableCodes.length} código(s) de resgate disponível(is)`);
            return true;
            
        } catch (error) {
            if (error instanceof SyntaxError) {
                console.log(`❌ Erro ao ler ${this.config.giftCodesFile} - formato JSON inválido`);
            } else {
                console.log(`❌ Erro ao verificar códigos: ${error.message}`);
            }
            return false;
        }
    }

    getNextGiftCode() {
        try {
            const codesData = JSON.parse(fs.readFileSync(this.config.giftCodesFile, 'utf8'));
            
            for (const codeInfo of codesData) {
                if (!codeInfo.usado) {
                    return codeInfo.codigo;
                }
            }
            
            return null;
            
        } catch (error) {
            console.log(`❌ Erro ao obter código: ${error.message}`);
            return null;
        }
    }

    markGiftCodeAsUsed(giftCode) {
        try {
            const codesData = JSON.parse(fs.readFileSync(this.config.giftCodesFile, 'utf8'));
            
            for (const codeInfo of codesData) {
                if (codeInfo.codigo === giftCode) {
                    codeInfo.usado = true;
                    codeInfo.timestamp_uso = new Date().toISOString().replace('T', ' ').substring(0, 19);
                    break;
                }
            }
            
            fs.writeFileSync(this.config.giftCodesFile, JSON.stringify(codesData, null, 2));
            console.log(`✅ Código ${giftCode} marcado como usado`);
            
        } catch (error) {
            console.log(`❌ Erro ao marcar código como usado: ${error.message}`);
        }
    }

    // ==============================================================================
    // 🌐 CONFIGURAÇÃO DO SELENIUM (EXATO DO PYTHON)
    // ==============================================================================

    async setupDriver() {
        try {
            const chromeOptions = new chrome.Options();
            
            // 🔧 CONFIGURAÇÕES MAIS ROBUSTAS PARA DIFERENTES VPS
            chromeOptions.addArguments("--headless");
            chromeOptions.addArguments("--no-sandbox");
            chromeOptions.addArguments("--disable-dev-shm-usage");
            chromeOptions.addArguments("--disable-gpu");
            chromeOptions.addArguments("--remote-debugging-port=9222");
            chromeOptions.addArguments("--disable-web-security");
            chromeOptions.addArguments("--disable-features=VizDisplayCompositor");
            chromeOptions.addArguments("--disable-plugins");
            chromeOptions.addArguments("--disable-extensions");
            chromeOptions.addArguments("--disable-background-networking");
            
            // 🔧 CONFIGURAÇÕES ADICIONAIS PARA ESTABILIDADE
            chromeOptions.addArguments("--disable-background-timer-throttling");
            chromeOptions.addArguments("--disable-renderer-backgrounding");
            chromeOptions.addArguments("--disable-backgrounding-occluded-windows");
            chromeOptions.addArguments("--disable-client-side-phishing-detection");
            chromeOptions.addArguments("--disable-crash-reporter");
            chromeOptions.addArguments("--disable-oopr-debug-crash-dump");
            chromeOptions.addArguments("--no-crash-upload");
            chromeOptions.addArguments("--disable-default-apps");
            chromeOptions.addArguments("--disable-extensions-file-access-check");
            chromeOptions.addArguments("--disable-extensions-http-throttling");
            
            // 🔧 VIEWPORT FIXO PARA CONSISTÊNCIA ENTRE VPS
            chromeOptions.addArguments("--window-size=1366,768");
            chromeOptions.addArguments("--start-maximized");
            
            // 🔧 LOCALIZAR CHROME (EXATO DO PYTHON)
            const chromePaths = [
                "/usr/bin/google-chrome",
                "/usr/bin/google-chrome-stable",
                "/usr/bin/chromium-browser",
                "/usr/bin/chromium",
                "/snap/bin/chromium"
            ];
            
            let chromeBinary = null;
            for (const chromePath of chromePaths) {
                if (fs.existsSync(chromePath)) {
                    chromeBinary = chromePath;
                    break;
                }
            }
            
            if (chromeBinary) {
                chromeOptions.setChromeBinaryPath(chromeBinary);
                this.logMessage(`Chrome encontrado em: ${chromeBinary}`);
            } else {
                this.logMessage("Chrome não encontrado", "ERROR");
                return false;
            }
            
            // 🔧 SIMULAÇÃO MÓVEL MAIS ROBUSTA
            const mobileEmulation = {
                deviceMetrics: {
                    width: 390, 
                    height: 844, 
                    pixelRatio: 3.0
                },
                userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
            };
            chromeOptions.setMobileEmulation(mobileEmulation);
            
            // 🔧 PREFS PARA EVITAR POPUPS E MODAIS
            chromeOptions.setUserPreferences({
                "profile.default_content_setting_values.notifications": 2,
                "profile.default_content_settings.popups": 0,
                "profile.managed_default_content_settings.images": 2
            });
            
            // 🔧 CRIAR DRIVER
            this.driver = await new Builder()
                .forBrowser('chrome')
                .setChromeOptions(chromeOptions)
                .build();
            
            // 🔧 TIMEOUTS MAIS GENEROSOS
            await this.driver.manage().setTimeouts({
                pageLoad: 30000,
                script: 30000,
                implicit: 5000
            });
            
            // 🔧 CONFIGURAR VIEWPORT EXPLICITAMENTE
            await this.driver.manage().window().setRect({
                width: 1366,
                height: 768,
                x: 0,
                y: 0
            });
            
            this.logMessage("Driver configurado com sucesso", "SUCCESS");
            return true;
            
        } catch (error) {
            this.logMessage(`Erro ao configurar driver: ${error.message}`, "ERROR");
            return false;
        }
    }

    // ==============================================================================
    // 🔑 PROCESSO DE LOGIN COM FORÇA BRUTA (EXATO DO PYTHON)
    // ==============================================================================

    async navigateToLoginPage() {
        try {
            this.logMessage(`Navegando para: ${this.config.loginUrl}`);
            await this.driver.get(this.config.loginUrl);
            await this.driver.sleep(5000);
            return true;
        } catch (error) {
            this.logMessage(`Erro ao navegar: ${error.message}`, "ERROR");
            return false;
        }
    }

    async closeModals() {
        try {
            this.logMessage("Fechando popups/modais (2 popups esperados)");
            
            // 🔧 AGUARDAR POPUPS CARREGAREM (BASEADO NO TESTE FUNCIONANDO)
            await this.driver.sleep(3000);
            
            let totalPopupsClosed = 0;
            
            // 🔧 SELETORES EXATOS QUE FUNCIONARAM NO TESTE
            const workingSelectors = [
                "#nameUsageModalClose1",        // Popup 1 - funcionou no teste
                ".notificationModelClose"       // Popup 2 - funcionou no teste (elemento 2)
            ];
            
            this.logMessage(`Testando ${workingSelectors.length} seletores que funcionaram no teste`);
            
            for (const selector of workingSelectors) {
                try {
                    const elements = await this.driver.findElements(By.css(selector));
                    this.logMessage(`Seletor ${selector}: ${elements.length} elemento(s) encontrado(s)`);
                    
                    for (let i = 0; i < elements.length; i++) {
                        const element = elements[i];
                        try {
                            const isDisplayed = await element.isDisplayed();
                            const isEnabled = await element.isEnabled();
                            
                            this.logMessage(`  Elemento ${i + 1}: visível=${isDisplayed}, habilitado=${isEnabled}`);
                            
                            if (isDisplayed && isEnabled) {
                                // 🔧 USAR EXATAMENTE O MÉTODO QUE FUNCIONOU NO TESTE
                                await this.driver.executeScript("arguments[0].scrollIntoView(true);", element);
                                await this.driver.sleep(500);
                                
                                // JavaScript click (método que funcionou no teste)
                                await this.driver.executeScript("arguments[0].click();", element);
                                
                                totalPopupsClosed++;
                                this.logMessage(`Popup fechado via ${selector} (elemento ${i + 1})`, "SUCCESS");
                                await this.driver.sleep(1000); // Aguardar popup fechar
                            }
                        } catch (e) {
                            this.logMessage(`Erro ao processar elemento ${i + 1} de ${selector}: ${e.message}`, "WARNING");
                        }
                    }
                } catch (e) {
                    this.logMessage(`Seletor ${selector} não encontrado - ok, continuando`);
                }
            }
            
            // 🔧 VERIFICAÇÃO FINAL COMO NO TESTE
            try {
                const remainingModals = await this.driver.executeScript(`
                    const modals = document.querySelectorAll('.modal, .popup, .overlay, [class*="modal"]');
                    let visible = 0;
                    modals.forEach(el => {
                        if (el.offsetParent !== null && window.getComputedStyle(el).display !== 'none') {
                            visible++;
                        }
                    });
                    return visible;
                `);
                
                this.logMessage(`Verificação final: ${remainingModals} modal(s) ainda visível(is)`);
                
                if (remainingModals === 0) {
                    this.logMessage("Todos os modais foram removidos!", "SUCCESS");
                } else {
                    this.logMessage(`${remainingModals} modais ainda visíveis - mas continuando`, "WARNING");
                }
            } catch (e) {
                this.logMessage("Erro na verificação final de modais");
            }
            
            this.logMessage(`${totalPopupsClosed} popup(s) fechado(s) no total`, "SUCCESS");
            return true;
            
        } catch (error) {
            this.logMessage(`Erro ao fechar modais: ${error.message}`, "WARNING");
            return false;
        }
    }

    async fillLoginFields() {
        try {
            this.logMessage("Preenchendo campos de login");
            
            // Device ID (EXATO DO PYTHON)
            const deviceIdField = await this.driver.wait(
                until.elementLocated(By.id("CTLDeviceID")), 
                this.config.waitTimeout * 1000
            );
            await deviceIdField.clear();
            await deviceIdField.sendKeys(this.config.deviceId);
            
            // Device Key (EXATO DO PYTHON)
            const deviceKeyField = await this.driver.wait(
                until.elementLocated(By.id("CTLDeviceKey")), 
                5000
            );
            await deviceKeyField.clear();
            await deviceKeyField.sendKeys(this.config.deviceKey);
            
            await this.driver.sleep(1000);
            
            this.logMessage(`Campos preenchidos - ID: ${this.config.deviceId}, Key: ${this.config.deviceKey}`, "SUCCESS");
            return true;
            
        } catch (error) {
            this.logMessage(`Erro ao preencher campos: ${error.message}`, "ERROR");
            return false;
        }
    }

    async bruteForceCaptchaOption2() {
        try {
            this.logMessage(`FORÇA BRUTA: Selecionando opção 2 (tentativa ${this.bruteForceCounter})`);
            
            // 🔧 SELETOR EXATO QUE FUNCIONOU NO TESTE
            const radioId = "CTLCaptchaControl_CTLAnswersList_1";
            
            // 🔧 AGUARDAR ELEMENTO ESTAR PRESENTE E VISÍVEL (COMO NO TESTE)
            const radioElement = await this.driver.wait(
                until.elementLocated(By.id(radioId)), 
                10000
            );
            
            // Verificar se elemento está visível e habilitado
            const isVisible = await radioElement.isDisplayed();
            const isEnabled = await radioElement.isEnabled();
            
            this.logMessage(`Elemento encontrado - Visível: ${isVisible}, Habilitado: ${isEnabled}`);
            
            if (!isVisible || !isEnabled) {
                throw new Error(`Elemento não está acessível - Visível: ${isVisible}, Habilitado: ${isEnabled}`);
            }
            
            // 🔧 SCROLL EXATO DO TESTE QUE FUNCIONOU
            await this.driver.executeScript("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", radioElement);
            await this.driver.sleep(1000);
            
            // 🔧 ESTRATÉGIAS MÚLTIPLAS COMO NO TESTE (EM ORDEM DE PREFERÊNCIA)
            let clickSuccess = false;
            const strategies = [
                {
                    name: "JavaScript Click",
                    action: async () => {
                        await this.driver.executeScript("arguments[0].click();", radioElement);
                    }
                },
                {
                    name: "Label Click", 
                    action: async () => {
                        const label = await this.driver.findElement(By.css(`label[for="${radioId}"]`));
                        await label.click();
                    }
                },
                {
                    name: "Actions API",
                    action: async () => {
                        const actions = this.driver.actions();
                        await actions.move({origin: radioElement}).click().perform();
                    }
                },
                {
                    name: "Selenium Click",
                    action: async () => {
                        await radioElement.click();
                    }
                }
            ];
            
            // 🔧 TENTAR CADA ESTRATÉGIA ATÉ UMA FUNCIONAR (EXATO DO TESTE)
            for (let i = 0; i < strategies.length; i++) {
                const strategy = strategies[i];
                try {
                    this.logMessage(`Tentando estratégia ${i + 1}: ${strategy.name}`);
                    
                    await strategy.action();
                    await this.driver.sleep(500);
                    
                    // Verificar se o radio foi realmente selecionado
                    const isSelected = await radioElement.isSelected();
                    
                    if (isSelected) {
                        clickSuccess = true;
                        this.logMessage(`Estratégia ${i + 1} (${strategy.name}) funcionou!`, "SUCCESS");
                        break;
                    } else {
                        this.logMessage(`Estratégia ${i + 1} não selecionou o radio, tentando próxima...`);
                    }
                } catch (error) {
                    this.logMessage(`Estratégia ${i + 1} falhou: ${error.message}`);
                    if (i === strategies.length - 1) {
                        throw error; // Se última estratégia falhou, relançar erro
                    }
                }
            }
            
            if (!clickSuccess) {
                throw new Error("Todas as estratégias de clique falharam");
            }
            
            await this.driver.sleep(1000);
            
            this.logMessage(`Opção 2 selecionada (força bruta ${this.bruteForceCounter})`, "SUCCESS");
            return true;
            
        } catch (error) {
            this.logMessage(`Erro ao selecionar opção 2: ${error.message}`, "ERROR");
            return false;
        }
    }

    async submitLoginForm() {
        try {
            this.logMessage("Submetendo formulário de login");
            
            // 🔧 BOTÃO EXATO DO PYTHON
            const loginButton = await this.driver.wait(
                until.elementLocated(By.id("CTLEditPlaylistsButton")), 
                10000
            );
            
            await this.driver.executeScript("arguments[0].scrollIntoView(true);", loginButton);
            await this.driver.sleep(500);
            
            await loginButton.click();
            this.logMessage("Botão 'Manage Device' clicado");
            
            await this.driver.sleep(5000);
            return true;
            
        } catch (error) {
            this.logMessage(`Erro ao submeter login: ${error.message}`, "ERROR");
            return false;
        }
    }

    async verifyLoginSuccess() {
        try {
            const currentUrl = await this.driver.getCurrentUrl();
            this.logMessage(`URL atual: ${currentUrl}`);
            
            if (currentUrl.startsWith(this.config.successUrlPattern)) {
                this.logMessage("Login verificado como bem-sucedido!", "SUCCESS");
                return true;
            } else {
                this.logMessage("Login falhou - tentativa de força bruta continua", "WARNING");
                return false;
            }
        } catch (error) {
            this.logMessage(`Erro ao verificar login: ${error.message}`, "ERROR");
            return false;
        }
    }

    async handleBruteForceLogin() {
        this.bruteForceCounter = 0;
        
        // Primeira tentativa: preenche campos normalmente
        if (!(await this.fillLoginFields())) {
            return false;
        }
        
        // 🔧 LOOP DE FORÇA BRUTA EXATO DO PYTHON
        for (let attempt = 0; attempt < this.config.maxBruteForceAttempts; attempt++) {
            this.bruteForceCounter = attempt + 1;
            
            try {
                this.logMessage(`=== FORÇA BRUTA TENTATIVA ${this.bruteForceCounter}/${this.config.maxBruteForceAttempts} ===`);
                
                // Seleciona opção 2 no captcha
                if (!(await this.bruteForceCaptchaOption2())) {
                    continue;
                }
                
                // Submete formulário
                if (!(await this.submitLoginForm())) {
                    continue;
                }
                
                // Verifica se login foi bem-sucedido
                if (await this.verifyLoginSuccess()) {
                    this.logMessage(`FORÇA BRUTA SUCESSO na tentativa ${this.bruteForceCounter}!`, "SUCCESS");
                    return true;
                }
                
                // Se chegou aqui, login falhou - página recarregou com campos preenchidos
                this.logMessage(`Tentativa ${this.bruteForceCounter} falhou, continuando...`, "WARNING");
                
                // Pequena pausa antes da próxima tentativa
                await this.driver.sleep(2000);
                
            } catch (error) {
                this.logMessage(`Erro na tentativa ${this.bruteForceCounter}: ${error.message}`, "ERROR");
                continue;
            }
        }
        
        // Se chegou aqui, todas as 15 tentativas falharam
        this.logMessage("FORÇA BRUTA ESGOTADA - 15 tentativas falharam", "ERROR");
        return false;
    }

    // ==============================================================================
    // 🎯 PROCESSO DE ATIVAÇÃO (EXATO DO PYTHON)
    // ==============================================================================

    async navigateToActivationPage() {
        try {
            this.logMessage("Navegando para página de ativação");
            
            const activateLink = await this.driver.wait(
                until.elementLocated(By.id("CTLActivateDevice")), 
                15000
            );
            
            await this.driver.executeScript("arguments[0].scrollIntoView(true);", activateLink);
            await this.driver.sleep(1000);
            
            await activateLink.click();
            this.logMessage("Link 'Activate Device by Gift Codes' clicado");
            
            await this.driver.sleep(3000);
            
            const currentUrl = await this.driver.getCurrentUrl();
            this.logMessage(`URL após navegação: ${currentUrl}`);
            
            if (currentUrl.startsWith(this.config.activationUrlPattern)) {
                this.logMessage("Página de ativação carregada com sucesso!", "SUCCESS");
                return true;
            } else {
                this.logMessage("Falha ao navegar para página de ativação", "ERROR");
                return false;
            }
            
        } catch (error) {
            this.logMessage(`Erro ao navegar para ativação: ${error.message}`, "ERROR");
            return false;
        }
    }

    async fillActivationForm() {
        try {
            this.logMessage("Preenchendo formulário de ativação");
            
            // 1. Preenche código de resgate (EXATO DO PYTHON)
            const giftCodeField = await this.driver.wait(
                until.elementLocated(By.id("CTLGiftCode")), 
                15000
            );
            await giftCodeField.clear();
            await giftCodeField.sendKeys(this.currentGiftCode);
            this.logMessage(`Código de resgate preenchido: ${this.currentGiftCode}`);
            
            await this.driver.sleep(1000);
            
            // 2. Preenche Device ID do alvo (EXATO DO PYTHON)
            const targetDeviceIdField = await this.driver.wait(
                until.elementLocated(By.id("CTLTargetDeviceID")), 
                5000
            );
            await targetDeviceIdField.clear();
            await targetDeviceIdField.sendKeys(this.targetDeviceId);
            this.logMessage(`Device ID do alvo preenchido: ${this.targetDeviceId}`);
            
            await this.driver.sleep(1000);
            
            // 3. Preenche Device Key do alvo (EXATO DO PYTHON)
            const targetDeviceKeyField = await this.driver.wait(
                until.elementLocated(By.id("CTLTargetDeviceKey")), 
                5000
            );
            await targetDeviceKeyField.clear();
            await targetDeviceKeyField.sendKeys(this.targetDeviceKey);
            this.logMessage(`Device Key do alvo preenchido: ${this.targetDeviceKey}`);
            
            await this.driver.sleep(1000);
            
            // 4. Marca checkbox de confirmação (EXATO DO PYTHON)
            const confirmCheckbox = await this.driver.wait(
                until.elementLocated(By.id("CTLConfirmCheck")), 
                5000
            );
            
            if (!(await confirmCheckbox.isSelected())) {
                await confirmCheckbox.click();
                this.logMessage("Checkbox de confirmação marcada");
            }
            
            await this.driver.sleep(1000);
            
            this.logMessage("Formulário de ativação preenchido com sucesso", "SUCCESS");
            return true;
            
        } catch (error) {
            this.logMessage(`Erro ao preencher formulário de ativação: ${error.message}`, "ERROR");
            return false;
        }
    }

    async verifyActivationResult() {
        try {
            this.logMessage("Verificando resultado da ativação...");
            
            // 🔧 PROCURA PELO ELEMENTO EXATO DO PYTHON
            const resultElement = await this.driver.wait(
                until.elementLocated(By.id("CTLResult")), 
                10000
            );
            
            if (!(await resultElement.isDisplayed())) {
                this.logMessage("Elemento CTLResult não está visível", "WARNING");
                return null;
            }
            
            // Obtém o texto do elemento
            const resultText = await resultElement.getText();
            
            // Obtém o atributo style para verificar a cor (EXATO DO PYTHON)
            const styleAttr = await resultElement.getAttribute("style") || "";
            
            this.logMessage(`Elemento CTLResult encontrado - Texto: '${resultText}'`);
            this.logMessage(`Style do elemento: ${styleAttr}`);
            
            // Scroll para o elemento para garantir visibilidade
            await this.driver.executeScript("arguments[0].scrollIntoView(true);", resultElement);
            await this.driver.sleep(1000);
            
            // 🔧 DETERMINA O RESULTADO BASEADO NA COR (EXATO DO PYTHON)
            if (styleAttr.includes("color:Red") || styleAttr.includes("color:red") || styleAttr.includes("Red;") || styleAttr.includes("color: red")) {
                // ERRO - Ativação falhou
                this.logMessage("Resultado: ERRO (cor vermelha detectada)", "ERROR");
                
                return {
                    success: false,
                    color: "red",
                    message: resultText,
                    errorMessage: `Ativação mal sucedida, mensagem de erro: ${resultText}`
                };
                
            } else if (styleAttr.includes("color:Green") || styleAttr.includes("color:green") || styleAttr.includes("Green;") || styleAttr.includes("color: green")) {
                // SUCESSO - Ativação bem-sucedida
                this.logMessage("Resultado: SUCESSO (cor verde detectada)", "SUCCESS");
                
                return {
                    success: true,
                    color: "green",
                    message: resultText,
                    successMessage: `Ativação bem-sucedida! Mensagem: ${resultText}`
                };
                
            } else {
                // 🔧 COR NÃO IDENTIFICADA - ANALISA PALAVRAS-CHAVE (EXATO DO PYTHON)
                this.logMessage("Cor não identificada claramente, analisando texto...", "WARNING");
                
                const errorKeywords = ["error", "failed", "invalid", "already used", "expired", "not found"];
                const successKeywords = ["success", "activated", "complete", "congratulations", "successful"];
                
                const textLower = resultText.toLowerCase();
                
                if (errorKeywords.some(keyword => textLower.includes(keyword))) {
                    return {
                        success: false,
                        color: "unknown_error",
                        message: resultText,
                        errorMessage: `Ativação mal sucedida (detectado por texto), mensagem de erro: ${resultText}`
                    };
                } else if (successKeywords.some(keyword => textLower.includes(keyword))) {
                    return {
                        success: true,
                        color: "unknown_success",
                        message: resultText,
                        successMessage: `Ativação bem-sucedida (detectado por texto)! Mensagem: ${resultText}`
                    };
                } else {
                    return {
                        success: null,
                        color: "unknown",
                        message: resultText,
                        warningMessage: `Resultado inconclusivo. Texto: ${resultText}`
                    };
                }
            }
            
        } catch (error) {
            if (error.name === 'TimeoutError') {
                this.logMessage("Elemento CTLResult não encontrado (timeout)", "ERROR");
                
                return {
                    success: null,
                    color: "not_found",
                    message: "Elemento CTLResult não encontrado",
                    errorMessage: "Não foi possível verificar o resultado da ativação - elemento não encontrado"
                };
            } else {
                this.logMessage(`Erro ao verificar resultado: ${error.message}`, "ERROR");
                
                return {
                    success: null,
                    color: "error",
                    message: error.message,
                    errorMessage: `Erro ao verificar resultado da ativação: ${error.message}`
                };
            }
        }
    }

    async submitActivation() {
        try {
            this.logMessage("Submetendo ativação");
            
            const activateButton = await this.driver.wait(
                until.elementLocated(By.id("CTLActivateButton")), 
                10000
            );
            
            await this.driver.executeScript("arguments[0].scrollIntoView(true);", activateButton);
            await this.driver.sleep(1000);
            
            await activateButton.click();
            this.logMessage("Botão 'Activate' clicado");
            
            // Aguarda processamento
            await this.driver.sleep(5000);
            
            // 🔧 VERIFICA RESULTADO DA ATIVAÇÃO
            const activationResult = await this.verifyActivationResult();
            
            if (activationResult) {
                if (activationResult.success === true) {
                    // ✅ SUCESSO (COR VERDE) - Marca código como usado
                    this.markGiftCodeAsUsed(this.currentGiftCode);
                    this.logMessage(activationResult.successMessage, "SUCCESS");
                    console.log(`\n🎉 ${activationResult.successMessage}`);
                    
                    // Retorna objeto com sucesso e mensagem para o cliente
                    return {
                        success: true,
                        message: activationResult.message,
                        type: 'activation_success'
                    };
                    
                } else if (activationResult.success === false) {
                    // ❌ ERRO (COR VERMELHA) - Informações incorretas do cliente
                    // NÃO marca código como usado e NÃO reinicia - apenas informa o erro
                    this.logMessage(activationResult.errorMessage, "ERROR");
                    console.log(`\n❌ ${activationResult.errorMessage}`);
                    
                    // Retorna objeto com erro e mensagem específica para o cliente
                    return {
                        success: false,
                        message: activationResult.message,
                        type: 'client_error', // 🔧 NOVO: Diferencia erro do cliente de erro técnico
                        errorMessage: activationResult.errorMessage
                    };
                    
                } else {
                    // ⚠️ INCONCLUSIVO - NÃO marca código como usado por segurança
                    this.logMessage(activationResult.warningMessage || "Resultado inconclusivo", "WARNING");
                    console.log(`\n⚠️ ${activationResult.warningMessage || 'Resultado inconclusivo'}`);
                    
                    // Retorna objeto com resultado inconclusivo
                    return {
                        success: false,
                        message: activationResult.message || "Resultado inconclusivo",
                        type: 'inconclusive_result',
                        errorMessage: activationResult.warningMessage || 'Resultado inconclusivo'
                    };
                }
            } else {
                // 💥 SEM RESULTADO - Falha técnica, deve reiniciar
                this.logMessage("Não foi possível verificar resultado da ativação", "WARNING");
                console.log("\n⚠️ Não foi possível verificar o resultado da ativação");
                
                return {
                    success: false,
                    message: "Falha técnica na verificação do resultado",
                    type: 'technical_error' // 🔧 NOVO: Indica que deve reiniciar
                };
            }
            
        } catch (error) {
            this.logMessage(`Erro ao submeter ativação: ${error.message}`, "ERROR");
            
            return {
                success: false,
                message: `Erro técnico: ${error.message}`,
                type: 'technical_error' // 🔧 NOVO: Indica que deve reiniciar
            };
        }
    }

    // ==============================================================================
    // 🎯 MÉTODOS PRINCIPAIS DA INTERFACE
    // ==============================================================================

    extractActivationData(rawData) {
        try {
            const lines = rawData.trim().split(/[\n\r]/);
            let deviceId = null;
            let deviceKey = null;
            
            for (const line of lines) {
                const cleaned = line.trim();
                
                // Procura por padrões como "Device ID: xxx" ou "ID: xxx"
                if (/device\s*id/i.test(cleaned)) {
                    deviceId = cleaned.split(/[:=]/)[1]?.trim();
                } else if (/device\s*key/i.test(cleaned)) {
                    deviceKey = cleaned.split(/[:=]/)[1]?.trim();
                }
            }
            
            // Se não tem labels, assume primeira linha = ID, segunda = Key
            if (!deviceId && lines.length >= 2) {
                deviceId = lines[0].trim();
                deviceKey = lines[1].trim();
            }
            
            return { deviceId, deviceKey };
        } catch (error) {
            console.error('❌ Erro ao extrair dados:', error);
            return { deviceId: null, deviceKey: null };
        }
    }

    async activate(activationData, order) {
        try {
            console.log(`[DuplexPlay] 🚀 Iniciando ativação para pedido: ${order.id}`);
            
            // 1. Verificar gift codes disponíveis
            if (!this.checkAvailableGiftCodes()) {
                return {
                    success: false,
                    error: 'Nenhum gift code disponível',
                    suggestion: 'Adicione códigos ao arquivo duplexplay_gift_codes.json'
                };
            }
            
            // 2. Obter próximo gift code
            this.currentGiftCode = this.getNextGiftCode();
            if (!this.currentGiftCode) {
                return {
                    success: false,
                    error: 'Não foi possível obter gift code'
                };
            }
            
            // 3. Extrair Device ID e Device Key
            const { deviceId, deviceKey } = this.extractActivationData(activationData);
            if (!deviceId || !deviceKey) {
                return {
                    success: false,
                    error: 'Device ID e Device Key são obrigatórios',
                    suggestion: 'Envie no formato:\nDevice ID: [seu_device_id]\nDevice Key: [seu_device_key]'
                };
            }
            
            this.targetDeviceId = deviceId;
            this.targetDeviceKey = deviceKey;
            
            console.log(`[DuplexPlay] 📋 Gift Code: ${this.currentGiftCode}`);
            console.log(`[DuplexPlay] 📋 Target Device ID: ${deviceId}`);
            console.log(`[DuplexPlay] 📋 Target Device Key: ${deviceKey}`);
            
            // 4. Executar processo de ativação completo
            const result = await this.runBruteForceAutomation();
            
            if (result.success) {
                console.log(`[DuplexPlay] ✅ Ativação bem-sucedida!`);
                return {
                    success: true,
                    result: `✅ DuplexPlay ativado com sucesso!\n\n🎁 Gift Code: ${this.currentGiftCode}\n📱 Device ID: ${deviceId}\n🔑 Device Key: ${deviceKey}\n\n📋 Resposta do sistema:\n"${result.message}"`
                };
            } else {
                console.log(`[DuplexPlay] ❌ Ativação falhou - Tipo: ${result.type}`);
                
                // 🔧 RETORNAR ERRO ESPECÍFICO BASEADO NO TIPO
                if (result.type === 'client_error') {
                    // ❌ ERRO NAS INFORMAÇÕES DO CLIENTE (COR VERMELHA)
                    return {
                        success: false,
                        error: `❌ Informações incorretas detectadas\n\n📋 Mensagem do sistema:\n"${result.message}"\n\n🔧 Solução:\n• Verifique se o Device ID está correto\n• Verifique se o Device Key está correto\n• Ou selecione outro aplicativo no menu principal`,
                        clientError: true, // 🔧 NOVO: Flag para indicar erro do cliente
                        systemMessage: result.message
                    };
                } else {
                    // 💥 ERRO TÉCNICO
                    return {
                        success: false,
                        error: `Erro técnico: ${result.message}`,
                        clientError: false // 🔧 NOVO: Flag para indicar erro técnico
                    };
                }
            }
            
        } catch (error) {
            console.error('[DuplexPlay] ❌ Erro na ativação:', error);
            
            return {
                success: false,
                error: `Erro interno: ${error.message}`,
                clientError: false,
                details: error.stack
            };
        }
    }

    // ==============================================================================
    // 🚀 PROCESSO COMPLETO COM FORÇA BRUTA (EXATO DO PYTHON)
    // ==============================================================================

    async attemptCompleteProcessWithBruteForce() {
        try {
            this.logMessage(`=== INICIANDO PROCESSO COM FORÇA BRUTA - TENTATIVA ${this.attemptCounter} ===`);
            
            // 1. Navega para página de login
            if (!(await this.navigateToLoginPage())) {
                return { success: false, type: 'technical_error', message: 'Falha ao navegar para página de login' };
            }
            
            // 2. Fecha modais
            await this.closeModals();
            
            // 3. FORÇA BRUTA: Login com tentativas consecutivas na opção 2
            if (!(await this.handleBruteForceLogin())) {
                this.logMessage("Força bruta no login falhou - reiniciando navegador", "ERROR");
                return { success: false, type: 'technical_error', message: 'Força bruta no login esgotada' };
            }
            
            // 4. Se chegou aqui, login foi bem-sucedido
            this.logMessage("Login bem-sucedido com força bruta!", "SUCCESS");
            
            // 5. Navega para página de ativação
            if (!(await this.navigateToActivationPage())) {
                return { success: false, type: 'technical_error', message: 'Falha ao navegar para página de ativação' };
            }
            
            // 6. Preenche formulário de ativação
            if (!(await this.fillActivationForm())) {
                return { success: false, type: 'technical_error', message: 'Falha ao preencher formulário de ativação' };
            }
            
            // 7. Submete ativação e obtém resultado detalhado
            const activationResult = await this.submitActivation();
            
            if (activationResult.success) {
                this.logMessage(`=== PROCESSO COMPLETO COM FORÇA BRUTA CONCLUÍDO - TENTATIVA ${this.attemptCounter} ===`, "SUCCESS");
                return {
                    success: true,
                    type: 'activation_success',
                    message: activationResult.message
                };
            } else {
                // 🔧 VERIFICAR TIPO DE ERRO
                if (activationResult.type === 'client_error') {
                    // Erro nas informações do cliente (cor vermelha) - NÃO reiniciar
                    this.logMessage("Erro nas informações do cliente - não reiniciando", "ERROR");
                    return {
                        success: false,
                        type: 'client_error',
                        message: activationResult.message,
                        errorMessage: activationResult.errorMessage
                    };
                } else {
                    // Erro técnico - deve reiniciar
                    this.logMessage("Erro técnico detectado - reiniciando", "ERROR");
                    return {
                        success: false,
                        type: 'technical_error',
                        message: activationResult.message || 'Erro técnico na ativação'
                    };
                }
            }
            
        } catch (error) {
            this.logMessage(`Erro no processo completo com força bruta - tentativa ${this.attemptCounter}: ${error.message}`, "ERROR");
            return { 
                success: false, 
                type: 'technical_error', 
                message: `Erro técnico: ${error.message}` 
            };
        }
    }

    async runBruteForceAutomation() {
        this.logMessage("=== INICIANDO AUTOMAÇÃO FORÇA BRUTA DUPLEXPLAY ===");
        
        for (let attempt = 1; attempt <= this.config.maxLoginAttempts; attempt++) {
            this.attemptCounter = attempt;
            
            try {
                // 🔧 CONFIGURAR DRIVER PARA CADA TENTATIVA
                if (!(await this.setupDriver())) {
                    this.logMessage("Falha ao configurar driver", "ERROR");
                    continue;
                }
                
                const result = await this.attemptCompleteProcessWithBruteForce();
                
                if (result.success) {
                    this.logMessage("AUTOMAÇÃO FORÇA BRUTA CONCLUÍDA COM SUCESSO!", "SUCCESS");
                    return { 
                        success: true, 
                        type: 'activation_success',
                        message: result.message 
                    };
                } else {
                    // 🔧 VERIFICAR TIPO DE ERRO PARA DECIDIR SE REINICIA
                    if (result.type === 'client_error') {
                        // ❌ ERRO DO CLIENTE (COR VERMELHA) - NÃO REINICIAR
                        this.logMessage("Erro nas informações do cliente - finalizando sem reiniciar", "ERROR");
                        return {
                            success: false,
                            type: 'client_error',
                            message: result.message,
                            errorMessage: result.errorMessage
                        };
                    } else {
                        // 🔧 ERRO TÉCNICO - REINICIAR APENAS SE NÃO FOR A ÚLTIMA TENTATIVA
                        this.logMessage(`Tentativa força bruta ${attempt} falhou (erro técnico)`, "WARNING");
                        
                        if (attempt < this.config.maxLoginAttempts) {
                            this.logMessage(`Reiniciando navegador para tentativa ${attempt + 1}...`);
                            
                            // Fecha navegador completamente
                            if (this.driver) {
                                await this.driver.quit();
                                this.logMessage("Navegador fechado");
                            }
                            
                            // Aguarda 10 segundos
                            await new Promise(resolve => setTimeout(resolve, 10000));
                        }
                    }
                }
                
            } catch (error) {
                this.logMessage(`Erro crítico na tentativa ${attempt}: ${error.message}`, "ERROR");
                
                // Reinicia navegador em caso de erro crítico
                if (this.driver) {
                    try {
                        await this.driver.quit();
                        this.logMessage("Navegador reiniciado devido a erro crítico");
                    } catch (e) {
                        // Ignorar erros ao fechar
                    }
                }
                
                await new Promise(resolve => setTimeout(resolve, 10000));
            } finally {
                // Sempre tentar fechar o driver
                if (this.driver) {
                    try {
                        await this.driver.quit();
                    } catch (e) {
                        // Ignorar erros ao fechar
                    }
                }
            }
        }
        
        this.logMessage("TODAS AS TENTATIVAS DE FORÇA BRUTA FALHARAM", "ERROR");
        return { 
            success: false, 
            type: 'technical_error',
            message: 'Todas as tentativas de força bruta falharam' 
        };
    }

    async test() {
        try {
            console.log('[DuplexPlay] 🧪 Executando teste...');
            
            // Verificar gift codes
            const hasGiftCodes = this.checkAvailableGiftCodes();
            
            // Testar configuração do driver
            let driverWorking = false;
            try {
                driverWorking = await this.setupDriver();
                if (this.driver) {
                    await this.driver.quit();
                }
            } catch (error) {
                console.error('[DuplexPlay] Erro no teste do driver:', error.message);
            }
            
            return {
                success: hasGiftCodes && driverWorking,
                appId: this.config.appId,
                appModule: this.config.appModule,
                name: this.config.name,
                checks: {
                    giftCodes: hasGiftCodes,
                    seleniumDriver: driverWorking,
                    configFiles: fs.existsSync(this.config.giftCodesFile)
                },
                needsAuthentication: false,
                inputFormat: 'Device ID e Device Key (duas linhas separadas)'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                appId: this.config.appId,
                appModule: this.config.appModule
            };
        }
    }
}

/**
 * Função de fábrica para criar instância
 */
function createActivator(config = {}) {
    return new DuplexPlayActivator(config);
}

// Exportar
module.exports = {
    DuplexPlayActivator,
    createActivator
};

// Teste direto se executado
if (require.main === module) {
    const activator = createActivator();
    activator.test().then(result => {
        console.log('\n=== TESTE DUPLEXPLAY ===');
        console.log('Status:', result.success ? '✅ SUCESSO' : '❌ FALHA');
        console.log('App ID:', result.appId);
        console.log('App Module:', result.appModule);
        console.log('Checks:', result.checks);
        if (!result.success) {
            console.log('Erro:', result.error);
        }
        console.log('========================\n');
    }).catch(console.error);
}
