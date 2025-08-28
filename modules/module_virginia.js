// modules/module_virginia.js - Módulo Virginia Player
const IboSolBaseActivator = require('./ibosol-base-activator');

class VIRGINIAActivator extends IboSolBaseActivator {
    constructor(config = {}) {
        super({
            name: 'Virginia Player',
            appModule: 'VIRGINIA',
            appId: 5,
            email: config.email || 'conta85iptv@gmail.com',
            password: config.password || 'P@pangu1',
            ...config
        });
    }
}

function createActivator(config = {}) {
    return new VIRGINIAActivator(config);
}

module.exports = {
    VIRGINIAActivator,
    createActivator
};

if (require.main === module) {
    const activator = createActivator();
    activator.test().then(result => {
        console.log('=== TESTE Virginia Player ===');
        console.log('Status:', result.success ? 'SUCESSO' : 'FALHA');
        console.log('App ID:', result.appId);
        console.log('App Module:', result.appModule);
        if (!result.success) {
            console.log('Erro:', result.error);
        }
    }).catch(console.error);
}
