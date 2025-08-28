// modules/module_abeplayertv.js - Módulo ABE Player TV
const IboSolBaseActivator = require('./ibosol-base-activator');

class ABEPlayerTvActivator extends IboSolBaseActivator {
    constructor(config = {}) {
        super({
            name: 'ABE Player TV',
            appModule: 'ABEPlayerTv',
            appId: 2,
            email: config.email || 'conta85iptv@gmail.com',
            password: config.password || 'P@pangu1',
            ...config
        });
    }
}

function createActivator(config = {}) {
    return new ABEPlayerTvActivator(config);
}

module.exports = {
    ABEPlayerTvActivator,
    createActivator
};

if (require.main === module) {
    const activator = createActivator();
    activator.test().then(result => {
        console.log('=== TESTE ABE Player TV ===');
        console.log('Status:', result.success ? 'SUCESSO' : 'FALHA');
        console.log('App ID:', result.appId);
        console.log('App Module:', result.appModule);
        if (!result.success) {
            console.log('Erro:', result.error);
        }
    }).catch(console.error);
}
