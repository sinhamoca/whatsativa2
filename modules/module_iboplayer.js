// modules/module_iboplayer.js - Módulo IBO Player
const IboSolBaseActivator = require('./ibosol-base-activator');

class IBOPLAYERActivator extends IboSolBaseActivator {
    constructor(config = {}) {
        super({
            name: 'IBO Player',
            appModule: 'IBOPLAYER',
            appId: 1,
            email: config.email || 'conta85iptv@gmail.com',
            password: config.password || 'P@pangu1',
            ...config
        });
    }
}

function createActivator(config = {}) {
    return new IBOPLAYERActivator(config);
}

module.exports = {
    IBOPLAYERActivator,
    createActivator
};

if (require.main === module) {
    const activator = createActivator();
    activator.test().then(result => {
        console.log('=== TESTE IBO Player ===');
        console.log('Status:', result.success ? 'SUCESSO' : 'FALHA');
        console.log('App ID:', result.appId);
        console.log('App Module:', result.appModule);
        if (!result.success) {
            console.log('Erro:', result.error);
        }
    }).catch(console.error);
}
