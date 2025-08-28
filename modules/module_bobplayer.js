// modules/module_bobplayer.js - Módulo BOB Player
const IboSolBaseActivator = require('./ibosol-base-activator');

class BOBPLAYERActivator extends IboSolBaseActivator {
    constructor(config = {}) {
        super({
            name: 'BOB Player',
            appModule: 'BOBPLAYER',
            appId: 3,
            email: config.email || 'conta85iptv@gmail.com',
            password: config.password || 'P@pangu1',
            ...config
        });
    }
}

function createActivator(config = {}) {
    return new BOBPLAYERActivator(config);
}

module.exports = {
    BOBPLAYERActivator,
    createActivator
};

if (require.main === module) {
    const activator = createActivator();
    activator.test().then(result => {
        console.log('=== TESTE BOB Player ===');
        console.log('Status:', result.success ? 'SUCESSO' : 'FALHA');
        console.log('App ID:', result.appId);
        console.log('App Module:', result.appModule);
        if (!result.success) {
            console.log('Erro:', result.error);
        }
    }).catch(console.error);
}
