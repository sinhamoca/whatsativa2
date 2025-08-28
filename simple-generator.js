// simple-generator.js - Gerador simples sem problemas de template
const fs = require('fs');
const path = require('path');

// Configuração dos apps
const apps = [
    { module: "IBOPLAYER", id: 1, name: "IBO Player", price: 10.00 },
    { module: "ABEPlayerTv", id: 2, name: "ABE Player TV", price: 10.00 },
    { module: "BOBPLAYER", id: 3, name: "BOB Player", price: 10.00 },
    { module: "MACPLAYER", id: 4, name: "MAC Player", price: 10.00 },
    { module: "VIRGINIA", id: 5, name: "Virginia Player", price: 10.00 },
    { module: "AllPlayer", id: 6, name: "All Player", price: 10.00 },
    { module: "HUSHPLAY", id: 7, name: "Hush Play", price: 10.00 },
    { module: "KTNPLAYER", id: 8, name: "KTN Player", price: 10.00 },
    { module: "FAMILYPLAYER", id: 9, name: "Family Player", price: 10.00 },
    { module: "IBOSSPLAYER", id: 10, name: "IBoss Player", price: 10.00 },
    { module: "KING4KPLAYER", id: 11, name: "King 4K Player", price: 10.00 },
    { module: "IBOSTB", id: 12, name: "IBO STB", price: 10.00 },
    { module: "IBOXXPLAYER", id: 13, name: "IboXX Player", price: 10.00 },
    { module: "DUPLEX24", id: 14, name: "Duplex 24", price: 10.00 },
    { module: "BOBPRO", id: 15, name: "BOB Pro", price: 10.00 },
    { module: "BOBPREMIUM", id: 16, name: "BOB Premium", price: 10.00 },
    { module: "IBOSOLPlayer", id: 17, name: "IBOSol Player", price: 10.00 },
    { module: "FLIXNET", id: 18, name: "FlixNet", price: 10.00 },
    { module: "SMARTONEPRO", id: 19, name: "Smart One Pro", price: 10.00 }
];

function createModuleFile(app) {
    const moduleId = app.module.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const className = app.module.replace(/[^a-zA-Z0-9]/g, '') + 'Activator';
    
    return `// modules/module_${moduleId}.js - Módulo ${app.name}
const IboSolBaseActivator = require('./ibosol-base-activator');

class ${className} extends IboSolBaseActivator {
    constructor(config = {}) {
        super({
            name: '${app.name}',
            appModule: '${app.module}',
            appId: ${app.id},
            email: config.email || 'isaacdopanta@gmail.com',
            password: config.password || 'P@pangu1',
            ...config
        });
    }
}

function createActivator(config = {}) {
    return new ${className}(config);
}

module.exports = {
    ${className},
    createActivator
};

if (require.main === module) {
    const activator = createActivator();
    activator.test().then(result => {
        console.log('=== TESTE ${app.name} ===');
        console.log('Status:', result.success ? 'SUCESSO' : 'FALHA');
        console.log('App ID:', result.appId);
        console.log('App Module:', result.appModule);
        if (!result.success) {
            console.log('Erro:', result.error);
        }
    }).catch(console.error);
}
`;
}

function createProductsScript() {
    const products = apps.map(app => {
        const moduleId = app.module.toLowerCase().replace(/[^a-z0-9]/g, '_');
        return {
            id: moduleId,
            name: app.name,
            description: `Ativação do ${app.name} - Aplicativo de streaming premium`,
            price: app.price,
            currency: 'BRL',
            activationModule: moduleId,
            paymentConfirmedMessage: createPaymentMessage(app.name),
            active: true
        };
    });

    return `// add-all-ibosol-products.js - Adiciona todos os produtos IboSol
const DatabaseService = require('./database-service');

const products = ${JSON.stringify(products, null, 2)};

async function addAllProducts() {
    const db = new DatabaseService('./database.sqlite');
    
    try {
        console.log('Conectando ao banco...');
        await db.initialize();
        
        console.log('Adicionando ' + products.length + ' produtos IboSol...');
        
        for (const product of products) {
            try {
                await db.saveProduct(product);
                console.log('✅ ' + product.name + ' - R$ ' + product.price);
            } catch (error) {
                console.error('❌ Erro ao adicionar ' + product.name + ':', error.message);
            }
        }
        
        console.log('Todos os produtos adicionados!');
        await db.close();
        
    } catch (error) {
        console.error('Erro:', error);
        await db.close();
        process.exit(1);
    }
}

if (require.main === module) {
    addAllProducts().catch(console.error);
}

module.exports = { addAllProducts, products };
`;
}

function createPaymentMessage(appName) {
    return `🎉 *${appName.toUpperCase()} - PAGAMENTO CONFIRMADO!*

🎯 *Produto:* {product_name}
💰 *Valor pago:* R$ {price}

━━━━━━━━━━━━━━━━━━━
📝 *AGORA PRECISO DAS INFORMAÇÕES:*

Para ativar seu ${appName}, envie o **MAC Address** do seu dispositivo.

📍 *Como encontrar o MAC:*
• Android TV: Configurações > Sobre > Status
• Fire TV: Configurações > Minha Fire TV > Sobre  
• Smart TV: Configurações > Rede > Status da Rede

📤 *Exemplo:* AA:BB:CC:DD:EE:FF

⚡ Envie apenas o MAC que ativo imediatamente!`;
}

function generateAll() {
    console.log('🚀 GERANDO MÓDULOS IBOSOL');
    console.log('═'.repeat(50));
    
    // Criar diretório modules se não existir
    if (!fs.existsSync('./modules')) {
        fs.mkdirSync('./modules');
        console.log('📁 Diretório modules/ criado');
    }
    
    let count = 0;
    
    // Gerar cada módulo
    apps.forEach(app => {
        const moduleId = app.module.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const fileName = `module_${moduleId}.js`;
        const filePath = path.join('./modules', fileName);
        
        try {
            const content = createModuleFile(app);
            fs.writeFileSync(filePath, content);
            console.log(`✅ ${fileName} - ${app.name} (ID: ${app.id})`);
            count++;
        } catch (error) {
            console.error(`❌ Erro: ${fileName}:`, error.message);
        }
    });
    
    // Gerar script de produtos
    try {
        const productsScript = createProductsScript();
        fs.writeFileSync('./add-all-ibosol-products.js', productsScript);
        console.log('✅ add-all-ibosol-products.js criado');
    } catch (error) {
        console.error('❌ Erro ao criar script de produtos:', error.message);
    }
    
    console.log('═'.repeat(50));
    console.log(`🎉 ${count} módulos gerados!`);
    
    console.log('\n📋 PRÓXIMOS PASSOS:');
    console.log('1. Copie ibosol-base-activator.js para ./modules/');
    console.log('2. Execute: node add-all-ibosol-products.js');
    console.log('3. Reinicie: pm2 restart all');
    
    console.log('\n📱 PRODUTOS CRIADOS:');
    apps.forEach(app => {
        const moduleId = app.module.toLowerCase().replace(/[^a-z0-9]/g, '_');
        console.log(`${app.id.toString().padStart(2, '0')}. ${app.name.padEnd(20)} - R$ ${app.price.toFixed(2)} - ${moduleId}`);
    });
}

if (require.main === module) {
    generateAll();
}

module.exports = { generateAll, apps };
