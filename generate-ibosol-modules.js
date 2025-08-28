// generate-ibosol-modules.js - Gera todos os módulos IboSol automaticamente
const fs = require('fs');
const path = require('path');

// Configuração de todos os aplicativos
const appsConfig = {
    "IBOPLAYER": { 
        id: 1, 
        name: "IBO Player", 
        price: 89.90,
        description: "Ativação do IBO Player - Aplicativo de streaming premium"
    },
    "ABEPlayerTv": { 
        id: 2, 
        name: "ABE Player TV", 
        price: 79.90,
        description: "Ativação do ABE Player TV - Streaming de alta qualidade"
    },
    "BOBPLAYER": { 
        id: 3, 
        name: "BOB Player", 
        price: 69.90,
        description: "Ativação do BOB Player - Player multifuncional"
    },
    "MACPLAYER": { 
        id: 4, 
        name: "MAC Player", 
        price: 79.90,
        description: "Ativação do MAC Player - Compatível com MAC Address"
    },
    "VIRGINIA": { 
        id: 5, 
        name: "Virginia Player", 
        price: 74.90,
        description: "Ativação do Virginia Player - Streaming avançado"
    },
    "AllPlayer": { 
        id: 6, 
        name: "All Player", 
        price: 84.90,
        description: "Ativação do All Player - Player universal"
    },
    "HUSHPLAY": { 
        id: 7, 
        name: "Hush Play", 
        price: 72.90,
        description: "Ativação do Hush Play - Streaming discreto"
    },
    "KTNPLAYER": { 
        id: 8, 
        name: "KTN Player", 
        price: 77.90,
        description: "Ativação do KTN Player - Player profissional"
    },
    "FAMILYPLAYER": { 
        id: 9, 
        name: "Family Player", 
        price: 82.90,
        description: "Ativação do Family Player - Ideal para família"
    },
    "IBOSSPLAYER": { 
        id: 10, 
        name: "IBoss Player", 
        price: 94.90,
        description: "Ativação do IBoss Player - Player empresarial"
    },
    "KING4KPLAYER": { 
        id: 11, 
        name: "King 4K Player", 
        price: 99.90,
        description: "Ativação do King 4K Player - Qualidade 4K premium"
    },
    "IBOSTB": { 
        id: 12, 
        name: "IBO STB", 
        price: 89.90,
        description: "Ativação do IBO STB - Set-top box virtual"
    },
    "IBOXXPLAYER": { 
        id: 13, 
        name: "IboXX Player", 
        price: 87.90,
        description: "Ativação do IboXX Player - Player avançado"
    },
    "DUPLEX24": { 
        id: 14, 
        name: "Duplex 24", 
        price: 91.90,
        description: "Ativação do Duplex 24 - Streaming 24h"
    },
    "BOBPRO": { 
        id: 15, 
        name: "BOB Pro", 
        price: 97.90,
        description: "Ativação do BOB Pro - Versão profissional"
    },
    "BOBPREMIUM": { 
        id: 16, 
        name: "BOB Premium", 
        price: 104.90,
        description: "Ativação do BOB Premium - Versão premium"
    },
    "IBOSOLPlayer": { 
        id: 17, 
        name: "IBOSol Player", 
        price: 92.90,
        description: "Ativação do IBOSol Player - Player oficial"
    },
    "FLIXNET": { 
        id: 18, 
        name: "FlixNet", 
        price: 85.90,
        description: "Ativação do FlixNet - Streaming de filmes"
    },
    "SMARTONEPRO": { 
        id: 19, 
        name: "Smart One Pro", 
        price: 96.90,
        description: "Ativação do Smart One Pro - Player inteligente"
    }
};

/**
 * Gera um módulo específico para um app
 */
function generateModuleFile(appModule, appConfig) {
    const moduleId = appModule.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const className = appModule.replace(/[^a-zA-Z0-9]/g, '') + 'Activator';
    
    return `// modules/module_${moduleId}.js - Módulo ${appConfig.name}
const IboSolBaseActivator = require('./ibosol-base-activator');

class ${className} extends IboSolBaseActivator {
    constructor(config = {}) {
        super({
            name: '${appConfig.name}',
            appModule: '${appModule}',
            appId: ${appConfig.id},
            email: config.email || 'isaacdopanta@gmail.com',
            password: config.password || 'P@pangu1',
            ...config
        });
    }
}

/**
 * Função de fábrica para criar instância
 */
function createActivator(config = {}) {
    return new ${className}(config);
}

// Exportar
module.exports = {
    ${className},
    createActivator
};

// Teste direto se executado
if (require.main === module) {
    const activator = createActivator();
    activator.test().then(result => {
        console.log('\\n=== RESULTADO DO TESTE ${appConfig.name} ===');
        console.log('Status:', result.success ? '✅ SUCESSO' : '❌ FALHA');
        console.log('App ID:', result.appId);
        console.log('App Module:', result.appModule);
        if (result.success) {
            console.log('Login funcionando:', result.loginWorking);
        } else {
            console.log('Erro:', result.error);
        }
        console.log('================================\\n');
    }).catch(error => {
        console.error('❌ Erro no teste:', error);
    });
}
`;
}

/**
 * Gera todos os módulos
 */
function generateAllModules() {
    console.log('🚀 GERANDO MÓDULOS IBOSOL');
    console.log('═'.repeat(50));
    
    const modulesDir = './modules';
    
    // Criar diretório se não existir
    if (!fs.existsSync(modulesDir)) {
        fs.mkdirSync(modulesDir, { recursive: true });
        console.log('📁 Diretório modules/ criado');
    }
    
    let generatedCount = 0;
    
    // Gerar cada módulo
    Object.entries(appsConfig).forEach(([appModule, appConfig]) => {
        const moduleId = appModule.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const fileName = `module_${moduleId}.js`;
        const filePath = path.join(modulesDir, fileName);
        
        try {
            const moduleContent = generateModuleFile(appModule, appConfig);
            fs.writeFileSync(filePath, moduleContent);
            
            console.log(`✅ ${fileName} - ${appConfig.name} (ID: ${appConfig.id})`);
            generatedCount++;
            
        } catch (error) {
            console.error(`❌ Erro ao gerar ${fileName}:`, error.message);
        }
    });
    
    console.log('═'.repeat(50));
    console.log(`🎉 ${generatedCount} módulos gerados com sucesso!`);
    
    return generatedCount;
}

/**
 * Gera script para adicionar produtos ao banco
 */
function generateProductsScript() {
    console.log('📝 Gerando script de produtos...');
    
    const productsArray = Object.entries(appsConfig).map(([appModule, appConfig]) => {
        const moduleId = appModule.toLowerCase().replace(/[^a-z0-9]/g, '_');
        return {
            id: moduleId,
            name: appConfig.name,
            description: appConfig.description,
            price: appConfig.price,
            currency: 'BRL',
            activationModule: moduleId,
            paymentConfirmedMessage: `🎉 *${appConfig.name.toUpperCase()} - PAGAMENTO CONFIRMADO!*

🎯 *Produto:* {product_name}
💰 *Valor pago:* R$ {price}

━━━━━━━━━━━━━━━━━━━
📝 *AGORA PRECISO DAS INFORMAÇÕES:*

Para ativar seu ${appConfig.name}, envie o **MAC Address** do seu dispositivo.

📍 *Como encontrar o MAC:*
• Android TV: Configurações > Sobre > Status
• Fire TV: Configurações > Minha Fire TV > Sobre  
• Smart TV: Configurações > Rede > Status da Rede

📤 *Exemplo:* AA:BB:CC:DD:EE:FF

⚡ Envie apenas o MAC que ativo imediatamente!`,
            active: true
        };
    });
    
    const scriptContent = `// add-all-ibosol-products.js - Adiciona todos os produtos IboSol
const DatabaseService = require('./database-service');

const products = ${JSON.stringify(productsArray, null, 2)};

async function addAllProducts() {
    const db = new DatabaseService('./database.sqlite');
    
    try {
        console.log('🔌 Conectando ao banco...');
        await db.initialize();
        
        console.log(\`📱 Adicionando \${products.length} produtos IboSol...\`);
        
        for (const product of products) {
            try {
                await db.saveProduct(product);
                console.log(\`✅ \${product.name} - R$ \${product.price}\`);
            } catch (error) {
                console.error(\`❌ Erro ao adicionar \${product.name}:\`, error.message);
            }
        }
        
        console.log('\\n🎉 Todos os produtos adicionados!');
        await db.close();
        
    } catch (error) {
        console.error('❌ Erro:', error);
        await db.close();
        process.exit(1);
    }
}

if (require.main === module) {
    addAllProducts().catch(console.error);
}

module.exports = { addAllProducts, products };
`;

    fs.writeFileSync('./add-all-ibosol-products.js', scriptContent);
    console.log('✅ Script add-all-ibosol-products.js criado');
}

/**
 * Gera lista de produtos para referência
 */
function generateProductsList() {
    console.log('\n📋 LISTA DE PRODUTOS GERADOS:');
    console.log('═'.repeat(60));
    
    Object.entries(appsConfig).forEach(([appModule, appConfig]) => {
        const moduleId = appModule.toLowerCase().replace(/[^a-z0-9]/g, '_');
        console.log(`${appConfig.id.toString().padStart(2, '0')}. ${appConfig.name.padEnd(20)} - R$ ${appConfig.price.toFixed(2)} - ${moduleId}`);
    });
    
    console.log('═'.repeat(60));
}

/**
 * Executar geração completa
 */
function generateComplete() {
    console.log('🎯 GERAÇÃO COMPLETA DE MÓDULOS IBOSOL');
    console.log('━'.repeat(60));
    
    // 1. Gerar módulos
    const modulesCount = generateAllModules();
    
    // 2. Gerar script de produtos
    generateProductsScript();
    
    // 3. Mostrar lista
    generateProductsList();
    
    console.log('\n🚀 PRÓXIMOS PASSOS:');
    console.log('1. Copie o arquivo ibosol-base-activator.js para a pasta modules/');
    console.log('2. Execute: node add-all-ibosol-products.js');
    console.log('3. Reinicie o sistema: pm2 restart all');
    console.log('4. Teste no WhatsApp digitando "menu"');
    
    console.log('\n💡 ESTRUTURA CRIADA:');
    console.log('📁 modules/');
    console.log('   ├── ibosol-base-activator.js (módulo base)');
    Object.entries(appsConfig).forEach(([appModule, appConfig]) => {
        const moduleId = appModule.toLowerCase().replace(/[^a-z0-9]/g, '_');
        console.log(`   ├── module_${moduleId}.js`);
    });
    console.log('📄 add-all-ibosol-products.js (script para adicionar produtos)');
    
    return {
        modulesGenerated: modulesCount,
        totalApps: Object.keys(appsConfig).length
    };
}

// Executar se chamado diretamente
if (require.main === module) {
    const result = generateComplete();
    
    console.log('\n🎉 GERAÇÃO CONCLUÍDA!');
    console.log(`📦 ${result.modulesGenerated} de ${result.totalApps} módulos criados`);
}

module.exports = {
    generateAllModules,
    generateProductsScript,
    generateProductsList,
    generateComplete,
    appsConfig
};
