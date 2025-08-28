// modules/module_familyplayer.js - Módulo Family Player
const IboSolBaseActivator = require('./ibosol-base-activator');

class FAMILYPLAYERActivator extends IboSolBaseActivator {
    constructor(config = {}) {
        super({
            name: 'Family Player',
            appModule: 'FAMILYPLAYER',
            appId: 9,
            email: config.email || 'conta85iptv@gmail.com',
            password: config.password || 'P@pangu1',
            ...config
        });
    }
}

function createActivator(config = {}) {
    return new FAMILYPLAYERActivator(config);
}

module.exports = {
    FAMILYPLAYERActivator,
    createActivator
};

if (require.main === module) {
    const activator = createActivator();
    activator.test().then(result => {
        console.log('=== TESTE Family Player ===');
        console.log('Status:', result.success ? 'SUCESSO' : 'FALHA');
        console.log('App ID:', result.appId);
        console.log('App Module:', result.appModule);
        if (!result.success) {
            console.log('Erro:', result.error);
        }
    }).catch(console.error);
}
