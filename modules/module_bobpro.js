// modules/module_bobpro.js - Módulo BOB Pro
const IboSolBaseActivator = require('./ibosol-base-activator');

class BOBPROActivator extends IboSolBaseActivator {
    constructor(config = {}) {
        super({
            name: 'BOB Pro',
            appModule: 'BOBPRO',
            appId: 15,
            email: config.email || 'conta85iptv@gmail.com',
            password: config.password || 'P@pangu1',
            ...config
        });
    }
}

function createActivator(config = {}) {
    return new BOBPROActivator(config);
}

module.exports = {
    BOBPROActivator,
    createActivator
};

if (require.main === module) {
    const activator = createActivator();
    activator.test().then(result => {
        console.log('=== TESTE BOB Pro ===');
        console.log('Status:', result.success ? 'SUCESSO' : 'FALHA');
        console.log('App ID:', result.appId);
        console.log('App Module:', result.appModule);
        if (!result.success) {
            console.log('Erro:', result.error);
        }
    }).catch(console.error);
}
