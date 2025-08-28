// modules/module_smartonepro.js - Módulo Smart One Pro
const IboSolBaseActivator = require('./ibosol-base-activator');

class SMARTONEPROActivator extends IboSolBaseActivator {
    constructor(config = {}) {
        super({
            name: 'Smart One Pro',
            appModule: 'SMARTONEPRO',
            appId: 19,
            email: config.email || 'conta85iptv@gmail.com',
            password: config.password || 'P@pangu1',
            ...config
        });
    }
}

function createActivator(config = {}) {
    return new SMARTONEPROActivator(config);
}

module.exports = {
    SMARTONEPROActivator,
    createActivator
};

if (require.main === module) {
    const activator = createActivator();
    activator.test().then(result => {
        console.log('=== TESTE Smart One Pro ===');
        console.log('Status:', result.success ? 'SUCESSO' : 'FALHA');
        console.log('App ID:', result.appId);
        console.log('App Module:', result.appModule);
        if (!result.success) {
            console.log('Erro:', result.error);
        }
    }).catch(console.error);
}
