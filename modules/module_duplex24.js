// modules/module_duplex24.js - Módulo Duplex 24
const IboSolBaseActivator = require('./ibosol-base-activator');

class DUPLEX24Activator extends IboSolBaseActivator {
    constructor(config = {}) {
        super({
            name: 'Duplex 24',
            appModule: 'DUPLEX24',
            appId: 14,
            email: config.email || 'conta85iptv@gmail.com',
            password: config.password || 'P@pangu1',
            ...config
        });
    }
}

function createActivator(config = {}) {
    return new DUPLEX24Activator(config);
}

module.exports = {
    DUPLEX24Activator,
    createActivator
};

if (require.main === module) {
    const activator = createActivator();
    activator.test().then(result => {
        console.log('=== TESTE Duplex 24 ===');
        console.log('Status:', result.success ? 'SUCESSO' : 'FALHA');
        console.log('App ID:', result.appId);
        console.log('App Module:', result.appModule);
        if (!result.success) {
            console.log('Erro:', result.error);
        }
    }).catch(console.error);
}
