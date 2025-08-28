const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { By } = require('selenium-webdriver');

async function testCaptcha() {
    const options = new chrome.Options();
    options.addArguments('--headless');
    options.addArguments('--no-sandbox');
    options.addArguments('--window-size=1366,768');
    
    const driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();
    
    try {
        await driver.get('https://edit.duplexplay.com/Default');
        await driver.sleep(10000);
        
        // Capturar screenshot para debug
        const screenshot = await driver.takeScreenshot();
        require('fs').writeFileSync('debug_page.png', screenshot, 'base64');
        
        console.log('Screenshot salvo: debug_page.png');
        
        // Procurar elemento captcha
        const elements = await driver.findElements(By.css('[id*="Captcha"]'));
        console.log(`Elementos captcha encontrados: ${elements.length}`);
        
        for (let el of elements) {
            const id = await el.getAttribute('id');
            const visible = await el.isDisplayed();
            console.log(`- ${id}: visível=${visible}`);
        }
        
    } catch (error) {
        console.error('Erro:', error.message);
    } finally {
        await driver.quit();
    }
}

testCaptcha();
