// modules/module_macplayer.js - Módulo MAC Player
const IboSolBaseActivator = require('./ibosol-base-activator');

class MACPLAYERActivator extends IboSolBaseActivator {
    constructor(config = {}) {
        super({
            name: 'MAC Player',
            appModule: 'MACPLAYER',
            appId: 4,
            email: config.email || 'conta85iptv@gmail.com',
            password: config.password || 'P@pangu1',
            ...config
        });
    }
}

function createActivator(config = {}) {
    return new MACPLAYERActivator(config);
}

module.exports = {
    MACPLAYERActivator,
    createActivator
};

if (require.main === module) {
    const activator = createActivator();
    activator.test().then(result => {
        console.log('=== TESTE MAC Player ===');
        console.log('Status:', result.success ? 'SUCESSO' : 'FALHA');
        console.log('App ID:', result.appId);
        console.log('App Module:', result.appModule);
        if (!result.success) {
            console.log('Erro:', result.error);
        }
    }).catch(console.error);
}
