// modules/module_bobpremium.js - Módulo BOB Premium
const IboSolBaseActivator = require('./ibosol-base-activator');

class BOBPREMIUMActivator extends IboSolBaseActivator {
    constructor(config = {}) {
        super({
            name: 'BOB Premium',
            appModule: 'BOBPREMIUM',
            appId: 16,
            email: config.email || 'conta85iptv@gmail.com',
            password: config.password || 'P@pangu1',
            ...config
        });
    }
}

function createActivator(config = {}) {
    return new BOBPREMIUMActivator(config);
}

module.exports = {
    BOBPREMIUMActivator,
    createActivator
};

if (require.main === module) {
    const activator = createActivator();
    activator.test().then(result => {
        console.log('=== TESTE BOB Premium ===');
        console.log('Status:', result.success ? 'SUCESSO' : 'FALHA');
        console.log('App ID:', result.appId);
        console.log('App Module:', result.appModule);
        if (!result.success) {
            console.log('Erro:', result.error);
        }
    }).catch(console.error);
}
