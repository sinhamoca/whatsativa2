// modules/module_ktnplayer.js - Módulo KTN Player
const IboSolBaseActivator = require('./ibosol-base-activator');

class KTNPLAYERActivator extends IboSolBaseActivator {
    constructor(config = {}) {
        super({
            name: 'KTN Player',
            appModule: 'KTNPLAYER',
            appId: 8,
            email: config.email || 'conta85iptv@gmail.com',
            password: config.password || 'P@pangu1',
            ...config
        });
    }
}

function createActivator(config = {}) {
    return new KTNPLAYERActivator(config);
}

module.exports = {
    KTNPLAYERActivator,
    createActivator
};

if (require.main === module) {
    const activator = createActivator();
    activator.test().then(result => {
        console.log('=== TESTE KTN Player ===');
        console.log('Status:', result.success ? 'SUCESSO' : 'FALHA');
        console.log('App ID:', result.appId);
        console.log('App Module:', result.appModule);
        if (!result.success) {
            console.log('Erro:', result.error);
        }
    }).catch(console.error);
}
