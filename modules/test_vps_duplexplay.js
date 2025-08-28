#!/usr/bin/env node
/**
 * Script de Teste Simples - DuplexPlay VPS
 * Testa apenas o fluxo básico até a tentativa de login
 * SEM força bruta - apenas 1 tentativa + screenshot final
 */

const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { By, until } = require('selenium-webdriver');
const fs = require('fs');
const path = require('path');

class DuplexPlayVPSTest {
    constructor() {
        this.driver = null;
        this.config = {
            loginUrl: "https://edit.duplexplay.com/Default",
            deviceId: "d0:94:66:a7:7a:40",
            deviceKey: "18632356",
            waitTimeout: 15
        };
    }

    log(message, level = "INFO") {
        const timestamp = new Date().toISOString();
        const emoji = {
            'INFO': 'ℹ️',
            'SUCCESS': '✅',
            'WARNING': '⚠️',
            'ERROR': '❌'
        };
        
        console.log(`${emoji[level]} [${timestamp}] ${message}`);
    }

    async setupDriver() {
        try {
            this.log("Configurando driver Chrome...");
            
            const chromeOptions = new chrome.Options();
            
            // Configurações para VPS
            chromeOptions.addArguments("--headless");
            chromeOptions.addArguments("--no-sandbox");
            chromeOptions.addArguments("--disable-dev-shm-usage");
            chromeOptions.addArguments("--disable-gpu");
            chromeOptions.addArguments("--disable-web-security");
            chromeOptions.addArguments("--disable-features=VizDisplayCompositor");
            chromeOptions.addArguments("--disable-extensions");
            chromeOptions.addArguments("--disable-plugins");
            
            // Viewport fixo para consistência
            chromeOptions.addArguments("--window-size=1366,768");
            chromeOptions.addArguments("--start-maximized");
            
            // Localizar Chrome
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
                    this.log(`Chrome encontrado: ${chromePath}`, "SUCCESS");
                    break;
                }
            }
            
            if (!chromeBinary) {
                this.log("Nenhum navegador Chrome/Chromium encontrado!", "ERROR");
                return false;
            }
            
            chromeOptions.setChromeBinaryPath(chromeBinary);
            
            // Simulação mobile iPhone
            const mobileEmulation = {
                deviceMetrics: {width: 390, height: 844, pixelRatio: 3.0},
                userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
            };
            chromeOptions.setMobileEmulation(mobileEmulation);
            
            // Criar driver
            this.driver = await new Builder()
                .forBrowser('chrome')
                .setChromeOptions(chromeOptions)
                .build();
            
            await this.driver.manage().setTimeouts({
                pageLoad: 30000,
                script: 30000,
                implicit: 5000
            });
            
            this.log("Driver configurado com sucesso!", "SUCCESS");
            return true;
            
        } catch (error) {
            this.log(`Erro ao configurar driver: ${error.message}`, "ERROR");
            return false;
        }
    }

    async takeScreenshot(filename, description) {
        try {
            const screenshot = await this.driver.takeScreenshot();
            const filepath = `./${filename}`;
            fs.writeFileSync(filepath, screenshot, 'base64');
            this.log(`Screenshot salvo: ${filepath} - ${description}`, "SUCCESS");
            return filepath;
        } catch (error) {
            this.log(`Erro ao capturar screenshot: ${error.message}`, "ERROR");
            return null;
        }
    }

    async navigateToPage() {
        try {
            this.log(`Navegando para: ${this.config.loginUrl}`);
            await this.driver.get(this.config.loginUrl);
            await this.driver.sleep(5000);
            
            await this.takeScreenshot("01_page_loaded.png", "Página carregada");
            
            this.log("Página carregada com sucesso!", "SUCCESS");
            return true;
            
        } catch (error) {
            this.log(`Erro ao navegar: ${error.message}`, "ERROR");
            return false;
        }
    }

    async closePopups() {
        try {
            this.log("Procurando e fechando todos os popups/modais...");
            
            // 🔧 AGUARDAR POPUPS CARREGAREM COMPLETAMENTE
            await this.driver.sleep(3000);
            
            let totalPopupsClosed = 0;
            const maxAttempts = 5; // Tentar até 5 vezes para garantir que todos sejam fechados
            
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                this.log(`--- Tentativa ${attempt} de fechamento de popups ---`);
                
                await this.takeScreenshot(`02_popup_attempt_${attempt}_before.png`, `Antes da tentativa ${attempt}`);
                
                let popupsClosedThisRound = 0;
                
                // 🔧 ESTRATÉGIA 1: SELETORES ESPECÍFICOS (MAIS PROVÁVEL DE FUNCIONAR)
                const specificSelectors = [
                    "#nameUsageModalClose1",          // Popup 1 - específico DuplexPlay
                    ".notificationModelClose",       // Popup 2 - notificação  
                    "#notificationModalClose",       // Variação do popup de notificação
                    ".modal-header .close",          // Botão X padrão Bootstrap
                    ".modal .btn-close",             // Botão fechar Bootstrap 5
                    "button[data-dismiss='modal']",  // Botão dismiss Bootstrap
                    "button[data-bs-dismiss='modal']" // Botão dismiss Bootstrap 5
                ];
                
                this.log(`Testando ${specificSelectors.length} seletores específicos...`);
                
                for (const selector of specificSelectors) {
                    try {
                        const elements = await this.driver.findElements(By.css(selector));
                        this.log(`Seletor ${selector}: ${elements.length} elemento(s) encontrado(s)`);
                        
                        for (let i = 0; i < elements.length; i++) {
                            const element = elements[i];
                            try {
                                const isDisplayed = await element.isDisplayed();
                                const isEnabled = await element.isEnabled();
                                
                                this.log(`  Elemento ${i + 1}: visível=${isDisplayed}, habilitado=${isEnabled}`);
                                
                                if (isDisplayed && isEnabled) {
                                    // Scroll para o elemento
                                    await this.driver.executeScript("arguments[0].scrollIntoView(true);", element);
                                    await this.driver.sleep(500);
                                    
                                    // Tentar múltiplas formas de clicar
                                    let clicked = false;
                                    
                                    // Tentar JavaScript click primeiro
                                    try {
                                        await this.driver.executeScript("arguments[0].click();", element);
                                        clicked = true;
                                        this.log(`    ✅ JavaScript click funcionou`, "SUCCESS");
                                    } catch (e) {
                                        this.log(`    ❌ JavaScript click falhou: ${e.message}`);
                                    }
                                    
                                    // Se JavaScript falhou, tentar click normal
                                    if (!clicked) {
                                        try {
                                            await element.click();
                                            clicked = true;
                                            this.log(`    ✅ Click normal funcionou`, "SUCCESS");
                                        } catch (e) {
                                            this.log(`    ❌ Click normal falhou: ${e.message}`);
                                        }
                                    }
                                    
                                    if (clicked) {
                                        popupsClosedThisRound++;
                                        totalPopupsClosed++;
                                        this.log(`🎯 Popup fechado via ${selector}`, "SUCCESS");
                                        await this.driver.sleep(1000); // Aguardar popup fechar
                                    }
                                }
                            } catch (e) {
                                this.log(`    ⚠️ Erro ao processar elemento: ${e.message}`);
                            }
                        }
                    } catch (e) {
                        // Seletor não encontrado - ok, continuar
                    }
                }
                
                // 🔧 ESTRATÉGIA 2: SELETORES GENÉRICOS PARA POPUPS PERSISTENTES
                if (popupsClosedThisRound === 0) {
                    this.log("Nenhum popup fechado com seletores específicos, tentando genéricos...");
                    
                    const genericSelectors = [
                        "[class*='close']",
                        "[class*='modal-close']", 
                        "button[aria-label='Close']",
                        "button[aria-label*='close']",
                        ".btn-close",
                        ".close",
                        "button:contains('×')",
                        "button:contains('Close')",
                        "button:contains('Fechar')"
                    ];
                    
                    for (const selector of genericSelectors) {
                        try {
                            const elements = await this.driver.findElements(By.css(selector));
                            for (const element of elements) {
                                try {
                                    if (await element.isDisplayed() && await element.isEnabled()) {
                                        await this.driver.executeScript("arguments[0].click();", element);
                                        popupsClosedThisRound++;
                                        totalPopupsClosed++;
                                        this.log(`🎯 Popup fechado via seletor genérico ${selector}`, "SUCCESS");
                                        await this.driver.sleep(1000);
                                    }
                                } catch (e) {
                                    // Ignorar erros individuais
                                }
                            }
                        } catch (e) {
                            // Seletor não funcionou
                        }
                    }
                }
                
                // 🔧 ESTRATÉGIA 3: FORÇAR REMOÇÃO VIA JAVASCRIPT
                if (popupsClosedThisRound === 0) {
                    this.log("Tentando remoção forçada via JavaScript...");
                    
                    try {
                        const removedCount = await this.driver.executeScript(`
                            let removed = 0;
                            
                            // Remover modais Bootstrap
                            document.querySelectorAll('.modal.show, .modal.fade.show').forEach(el => {
                                el.style.display = 'none';
                                el.remove();
                                removed++;
                            });
                            
                            // Remover backdrops
                            document.querySelectorAll('.modal-backdrop').forEach(el => {
                                el.remove();
                                removed++;
                            });
                            
                            // Remover overlays com z-index alto
                            document.querySelectorAll('[style*="z-index"]').forEach(el => {
                                const zIndex = parseInt(window.getComputedStyle(el).zIndex);
                                if (zIndex > 1000) {
                                    el.style.display = 'none';
                                    removed++;
                                }
                            });
                            
                            // Remover elementos com classes suspeitas
                            document.querySelectorAll('.popup, .overlay, .notification, .alert-modal').forEach(el => {
                                if (el.offsetParent !== null) { // Se está visível
                                    el.style.display = 'none';
                                    removed++;
                                }
                            });
                            
                            return removed;
                        `);
                        
                        if (removedCount > 0) {
                            popupsClosedThisRound += removedCount;
                            totalPopupsClosed += removedCount;
                            this.log(`🎯 ${removedCount} popup(s) removido(s) via JavaScript`, "SUCCESS");
                        }
                    } catch (e) {
                        this.log(`❌ Erro na remoção JavaScript: ${e.message}`);
                    }
                }
                
                await this.takeScreenshot(`02_popup_attempt_${attempt}_after.png`, `Após tentativa ${attempt} - ${popupsClosedThisRound} fechados`);
                
                this.log(`--- Tentativa ${attempt} concluída: ${popupsClosedThisRound} popup(s) fechado(s) ---`);
                
                // Se não fechou nenhum popup nesta rodada, provavelmente não há mais
                if (popupsClosedThisRound === 0) {
                    this.log("Nenhum popup fechado nesta tentativa - assumindo que todos foram fechados");
                    break;
                }
                
                // Aguardar um pouco para próxima tentativa
                await this.driver.sleep(2000);
            }
            
            // 🔧 SCREENSHOT FINAL APÓS TODOS OS POPUPS
            await this.takeScreenshot("02_all_popups_closed.png", `Todos popups processados - ${totalPopupsClosed} total fechados`);
            
            // 🔧 VERIFICAÇÃO FINAL: CONTAR MODAIS AINDA VISÍVEIS
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
                
                this.log(`📊 Verificação final: ${remainingModals} modal(s) ainda visível(is)`);
                
                if (remainingModals > 0) {
                    this.log("⚠️ Ainda há modais visíveis - mas continuando teste...", "WARNING");
                } else {
                    this.log("✅ Todos os modais foram removidos!", "SUCCESS");
                }
            } catch (e) {
                this.log("❌ Erro na verificação final de modais");
            }
            
            this.log(`🎉 Processamento de popups concluído: ${totalPopupsClosed} popup(s) fechado(s) no total`, "SUCCESS");
            return true;
            
        } catch (error) {
            this.log(`❌ Erro crítico ao fechar popups: ${error.message}`, "ERROR");
            await this.takeScreenshot("02_popup_error.png", "Erro crítico nos popups");
            return false; // Agora retorna false se houver erro crítico
        }
    }

    async fillLoginFields() {
        try {
            this.log("Preenchendo campos de login...");
            
            // Preencher Device ID
            this.log(`Procurando campo Device ID...`);
            const deviceIdField = await this.driver.wait(
                until.elementLocated(By.id("CTLDeviceID")), 
                this.config.waitTimeout * 1000
            );
            
            await deviceIdField.clear();
            await deviceIdField.sendKeys(this.config.deviceId);
            this.log(`Device ID preenchido: ${this.config.deviceId}`, "SUCCESS");
            
            // Preencher Device Key  
            this.log(`Procurando campo Device Key...`);
            const deviceKeyField = await this.driver.wait(
                until.elementLocated(By.id("CTLDeviceKey")), 
                5000
            );
            
            await deviceKeyField.clear();
            await deviceKeyField.sendKeys(this.config.deviceKey);
            this.log(`Device Key preenchido: ${this.config.deviceKey}`, "SUCCESS");
            
            await this.driver.sleep(1000);
            
            await this.takeScreenshot("03_fields_filled.png", "Campos preenchidos");
            
            this.log("Campos de login preenchidos com sucesso!", "SUCCESS");
            return true;
            
        } catch (error) {
            this.log(`Erro ao preencher campos: ${error.message}`, "ERROR");
            await this.takeScreenshot("03_error_filling.png", "Erro ao preencher campos");
            return false;
        }
    }

    async selectCaptchaOption2() {
        try {
            this.log("Procurando e selecionando opção 2 do captcha...");
            
            const radioId = "CTLCaptchaControl_CTLAnswersList_1";
            
            // Aguardar elemento aparecer
            this.log(`Aguardando elemento: ${radioId}`);
            const radioElement = await this.driver.wait(
                until.elementLocated(By.id(radioId)), 
                10000
            );
            
            // Verificar se elemento está visível
            const isVisible = await radioElement.isDisplayed();
            const isEnabled = await radioElement.isEnabled();
            
            this.log(`Elemento encontrado - Visível: ${isVisible}, Habilitado: ${isEnabled}`);
            
            // Scroll para o elemento
            await this.driver.executeScript("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", radioElement);
            await this.driver.sleep(1000);
            
            await this.takeScreenshot("04_before_captcha_click.png", "Antes de clicar no captcha");
            
            // Tentar múltiplas estratégias de clique
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
            
            for (let i = 0; i < strategies.length; i++) {
                const strategy = strategies[i];
                try {
                    this.log(`Tentando estratégia ${i + 1}: ${strategy.name}`);
                    
                    await strategy.action();
                    await this.driver.sleep(500);
                    
                    // Verificar se foi selecionado
                    const isSelected = await radioElement.isSelected();
                    
                    if (isSelected) {
                        clickSuccess = true;
                        this.log(`✅ Estratégia ${i + 1} (${strategy.name}) funcionou!`, "SUCCESS");
                        break;
                    } else {
                        this.log(`⚠️ Estratégia ${i + 1} não selecionou o radio`, "WARNING");
                    }
                    
                } catch (error) {
                    this.log(`❌ Estratégia ${i + 1} falhou: ${error.message}`, "WARNING");
                }
            }
            
            await this.takeScreenshot("05_after_captcha_click.png", "Após tentar clicar no captcha");
            
            if (clickSuccess) {
                this.log("Opção 2 do captcha selecionada com sucesso!", "SUCCESS");
                return true;
            } else {
                this.log("Falha ao selecionar opção 2 do captcha", "ERROR");
                return false;
            }
            
        } catch (error) {
            this.log(`Erro ao selecionar captcha: ${error.message}`, "ERROR");
            await this.takeScreenshot("05_captcha_error.png", "Erro no captcha");
            return false;
        }
    }

    async clickLoginButton() {
        try {
            this.log("Procurando botão de login...");
            
            const loginButton = await this.driver.wait(
                until.elementLocated(By.id("CTLEditPlaylistsButton")), 
                10000
            );
            
            // Scroll para o botão
            await this.driver.executeScript("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", loginButton);
            await this.driver.sleep(1000);
            
            await this.takeScreenshot("06_before_login_click.png", "Antes de clicar no login");
            
            // Clicar no botão
            await loginButton.click();
            this.log("Botão 'Manage Device' clicado!", "SUCCESS");
            
            // Aguardar resposta
            await this.driver.sleep(5000);
            
            await this.takeScreenshot("07_after_login_click.png", "Após clicar no login");
            
            // Verificar URL final
            const finalUrl = await this.driver.getCurrentUrl();
            this.log(`URL final: ${finalUrl}`);
            
            // Capturar informações da página
            try {
                const pageTitle = await this.driver.getTitle();
                this.log(`Título da página: ${pageTitle}`);
                
                // Procurar por mensagens de erro ou sucesso
                const errorElements = await this.driver.findElements(By.css('.alert-danger, .error, [style*="color:red"], [style*="color: red"]'));
                const successElements = await this.driver.findElements(By.css('.alert-success, .success, [style*="color:green"], [style*="color: green"]'));
                
                this.log(`Elementos de erro encontrados: ${errorElements.length}`);
                this.log(`Elementos de sucesso encontrados: ${successElements.length}`);
                
                // Tentar capturar textos de erro/sucesso
                for (let i = 0; i < Math.min(errorElements.length, 3); i++) {
                    try {
                        const text = await errorElements[i].getText();
                        if (text.trim()) {
                            this.log(`Erro ${i + 1}: ${text}`);
                        }
                    } catch (e) {
                        // Ignorar erros ao obter texto
                    }
                }
                
            } catch (e) {
                // Ignorar erros ao obter informações da página
            }
            
            return true;
            
        } catch (error) {
            this.log(`Erro ao clicar no login: ${error.message}`, "ERROR");
            await this.takeScreenshot("07_login_error.png", "Erro no login");
            return false;
        }
    }

    async runTest() {
        console.log("🧪 TESTE SIMPLES DUPLEXPLAY VPS");
        console.log("=" * 50);
        
        try {
            // 1. Configurar driver
            if (!(await this.setupDriver())) {
                this.log("Falha na configuração do driver", "ERROR");
                return false;
            }
            
            // 2. Navegar para página
            if (!(await this.navigateToPage())) {
                this.log("Falha ao navegar para página", "ERROR");
                return false;
            }
            
            // 3. Fechar popups
            await this.closePopups();
            
            // 4. Preencher campos
            if (!(await this.fillLoginFields())) {
                this.log("Falha ao preencher campos", "ERROR");
                return false;
            }
            
            // 5. Selecionar captcha opção 2
            const captchaSuccess = await this.selectCaptchaOption2();
            if (!captchaSuccess) {
                this.log("Falha no captcha - mas continuando...", "WARNING");
            }
            
            // 6. Clicar no botão de login
            if (!(await this.clickLoginButton())) {
                this.log("Falha ao clicar no login", "ERROR");
            }
            
            // 7. Screenshot final
            await this.takeScreenshot("08_final_result.png", "Resultado final do teste");
            
            this.log("TESTE CONCLUÍDO!", "SUCCESS");
            console.log("\n📁 Screenshots gerados:");
            console.log("  01_page_loaded.png - Página carregada");
            console.log("  02_popups_closed.png - Popups fechados");
            console.log("  03_fields_filled.png - Campos preenchidos");
            console.log("  04_before_captcha_click.png - Antes do captcha");
            console.log("  05_after_captcha_click.png - Após captcha");
            console.log("  06_before_login_click.png - Antes do login");
            console.log("  07_after_login_click.png - Após login");
            console.log("  08_final_result.png - Resultado final");
            
            return true;
            
        } catch (error) {
            this.log(`Erro crítico no teste: ${error.message}`, "ERROR");
            await this.takeScreenshot("99_critical_error.png", "Erro crítico");
            return false;
            
        } finally {
            // Sempre fechar o driver
            if (this.driver) {
                try {
                    await this.driver.quit();
                    this.log("Driver fechado", "INFO");
                } catch (e) {
                    // Ignorar erros ao fechar
                }
            }
        }
    }
}

// Executar teste
async function main() {
    const test = new DuplexPlayVPSTest();
    const success = await test.runTest();
    
    console.log("\n" + "=" * 50);
    if (success) {
        console.log("🎉 TESTE CONCLUÍDO COM SUCESSO!");
        console.log("📋 Verifique os screenshots para analisar o resultado");
    } else {
        console.log("💥 TESTE FALHOU!");
        console.log("📋 Verifique os logs e screenshots para debug");
    }
    
    process.exit(success ? 0 : 1);
}

// Executar se chamado diretamente
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { DuplexPlayVPSTest };
