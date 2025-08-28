// modules/module_ibosolplayer.js - Módulo IBOSol Player
const IboSolBaseActivator = require('./ibosol-base-activator');

class IBOSOLPlayerActivator extends IboSolBaseActivator {
    constructor(config = {}) {
        super({
            name: 'IBOSol Player',
            appModule: 'IBOSOLPlayer',
            appId: 17,
            email: config.email || 'conta85iptv@gmail.com',
            password: config.password || 'P@pangu1',
            ...config
        });
    }
}

function createActivator(config = {}) {
    return new IBOSOLPlayerActivator(config);
}

module.exports = {
    IBOSOLPlayerActivator,
    createActivator
};

if (require.main === module) {
    const activator = createActivator();
    activator.test().then(result => {
        console.log('=== TESTE IBOSol Player ===');
        console.log('Status:', result.success ? 'SUCESSO' : 'FALHA');
        console.log('App ID:', result.appId);
        console.log('App Module:', result.appModule);
        if (!result.success) {
            console.log('Erro:', result.error);
        }
    }).catch(console.error);
}
