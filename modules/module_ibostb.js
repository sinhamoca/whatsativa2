// modules/module_ibostb.js - Módulo IBO STB
const IboSolBaseActivator = require('./ibosol-base-activator');

class IBOSTBActivator extends IboSolBaseActivator {
    constructor(config = {}) {
        super({
            name: 'IBO STB',
            appModule: 'IBOSTB',
            appId: 12,
            email: config.email || 'conta85iptv@gmail.com',
            password: config.password || 'P@pangu1',
            ...config
        });
    }
}

function createActivator(config = {}) {
    return new IBOSTBActivator(config);
}

module.exports = {
    IBOSTBActivator,
    createActivator
};

if (require.main === module) {
    const activator = createActivator();
    activator.test().then(result => {
        console.log('=== TESTE IBO STB ===');
        console.log('Status:', result.success ? 'SUCESSO' : 'FALHA');
        console.log('App ID:', result.appId);
        console.log('App Module:', result.appModule);
        if (!result.success) {
            console.log('Erro:', result.error);
        }
    }).catch(console.error);
}
