// modules/module_ibossplayer.js - Módulo IBoss Player
const IboSolBaseActivator = require('./ibosol-base-activator');

class IBOSSPLAYERActivator extends IboSolBaseActivator {
    constructor(config = {}) {
        super({
            name: 'IBoss Player',
            appModule: 'IBOSSPLAYER',
            appId: 10,
            email: config.email || 'conta85iptv@gmail.com',
            password: config.password || 'P@pangu1',
            ...config
        });
    }
}

function createActivator(config = {}) {
    return new IBOSSPLAYERActivator(config);
}

module.exports = {
    IBOSSPLAYERActivator,
    createActivator
};

if (require.main === module) {
    const activator = createActivator();
    activator.test().then(result => {
        console.log('=== TESTE IBoss Player ===');
        console.log('Status:', result.success ? 'SUCESSO' : 'FALHA');
        console.log('App ID:', result.appId);
        console.log('App Module:', result.appModule);
        if (!result.success) {
            console.log('Erro:', result.error);
        }
    }).catch(console.error);
}
