// modules/module_allplayer.js - Módulo All Player
const IboSolBaseActivator = require('./ibosol-base-activator');

class AllPlayerActivator extends IboSolBaseActivator {
    constructor(config = {}) {
        super({
            name: 'All Player',
            appModule: 'AllPlayer',
            appId: 6,
            email: config.email || 'conta85iptv@gmail.com',
            password: config.password || 'P@pangu1',
            ...config
        });
    }
}

function createActivator(config = {}) {
    return new AllPlayerActivator(config);
}

module.exports = {
    AllPlayerActivator,
    createActivator
};

if (require.main === module) {
    const activator = createActivator();
    activator.test().then(result => {
        console.log('=== TESTE All Player ===');
        console.log('Status:', result.success ? 'SUCESSO' : 'FALHA');
        console.log('App ID:', result.appId);
        console.log('App Module:', result.appModule);
        if (!result.success) {
            console.log('Erro:', result.error);
        }
    }).catch(console.error);
}
