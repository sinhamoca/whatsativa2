// modules/module_hushplay.js - Módulo Hush Play
const IboSolBaseActivator = require('./ibosol-base-activator');

class HUSHPLAYActivator extends IboSolBaseActivator {
    constructor(config = {}) {
        super({
            name: 'Hush Play',
            appModule: 'HUSHPLAY',
            appId: 7,
            email: config.email || 'conta85iptv@gmail.com',
            password: config.password || 'P@pangu1',
            ...config
        });
    }
}

function createActivator(config = {}) {
    return new HUSHPLAYActivator(config);
}

module.exports = {
    HUSHPLAYActivator,
    createActivator
};

if (require.main === module) {
    const activator = createActivator();
    activator.test().then(result => {
        console.log('=== TESTE Hush Play ===');
        console.log('Status:', result.success ? 'SUCESSO' : 'FALHA');
        console.log('App ID:', result.appId);
        console.log('App Module:', result.appModule);
        if (!result.success) {
            console.log('Erro:', result.error);
        }
    }).catch(console.error);
}
