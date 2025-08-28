// activation-interceptor.js - Interceptor Não Invasivo para WhatsApp Handler
const pino = require('pino');

class ActivationInterceptor {
    constructor(activationBlockerService) {
        this.blocker = activationBlockerService;
        this.logger = pino({ level: 'info' });
    }

    /**
     * Intercepta mensagens antes do processamento normal
     * Retorna null se deve continuar processamento normal
     * Retorna objeto de resposta se deve bloquear a mensagem
     * 
     * @param {string} chatId - ID do chat
     * @param {string} messageText - Texto da mensagem (já em lowercase e trim)
     * @param {object} userSession - Sessão do usuário
     * @returns {null|object} - null para continuar, objeto para bloquear
     */
    interceptMessage(chatId, messageText, userSession) {
        // Verificar se usuário está bloqueado
        const blockInfo = this.blocker.isUserBlocked(chatId);
        
        if (!blockInfo) {
            // Usuário não está bloqueado, continuar processamento normal
            return null;
        }

        this.logger.info(`🔒 INTERCEPTANDO mensagem de usuário bloqueado ${chatId}: "${messageText}"`);

        // === COMANDOS ESPECIAIS PERMITIDOS DURANTE BLOQUEIO ===
        
        // Comando de suporte sempre permitido
        if (this.isSupportCommand(messageText)) {
            this.logger.info(`🆘 Comando suporte permitido mesmo durante bloqueio para ${chatId}`);
            return null; // Permitir processamento normal
        }

        // Comando para forçar cancelamento (emergência)
        if (this.isCancelCommand(messageText)) {
            this.logger.warn(`❌ Comando cancelar durante bloqueio para ${chatId}`);
            
            // Desbloquear usuário
            this.blocker.unblockUser(chatId, 'user_cancelled');
            
            return {
                reply: `❌ *ATIVAÇÃO CANCELADA*

🔄 Processo de ativação do ${this.blocker.getModuleFriendlyName(blockInfo.moduleId)} foi interrompido pelo usuário.

💡 Você pode tentar novamente digitando *menu*.

⚠️ *Importante:* Se a ativação já estava em andamento, ela pode ainda ser concluída em segundo plano. Entre em contato com o suporte se tiver dúvidas.`
            };
        }

        // === BLOQUEAR TODOS OS OUTROS COMANDOS ===
        
        // Comandos específicos que seriam problemáticos
        if (this.isMenuCommand(messageText)) {
            this.logger.warn(`🚫 Tentativa de acessar MENU durante bloqueio: ${chatId}`);
        } else if (this.isVerifyCommand(messageText)) {
            this.logger.warn(`🚫 Tentativa de VERIFICAR durante bloqueio: ${chatId}`);
        } else if (this.isProductSelection(messageText)) {
            this.logger.warn(`🚫 Tentativa de selecionar produto durante bloqueio: ${chatId}`);
        } else {
            this.logger.info(`🔒 Mensagem genérica bloqueada: ${chatId} - "${messageText}"`);
        }

        // Retornar mensagem de bloqueio
        return {
            reply: this.blocker.getBlockMessage(chatId)
        };
    }

    /**
     * Notifica o interceptor sobre o início de uma ativação
     * @param {string} chatId - ID do chat
     * @param {string} moduleId - ID do módulo
     * @param {string} orderId - ID do pedido
     */
    notifyActivationStart(chatId, moduleId, orderId) {
        const blocked = this.blocker.blockUser(chatId, moduleId, orderId);
        
        if (blocked) {
            this.logger.info(`🔒 ATIVAÇÃO INICIADA - Usuário ${chatId} bloqueado para ${moduleId}`);
        }
        
        return blocked;
    }

    /**
     * Notifica o interceptor sobre a conclusão de uma ativação
     * @param {string} chatId - ID do chat
     * @param {boolean} success - Se a ativação foi bem-sucedida
     * @param {string} reason - Motivo da conclusão
     */
    notifyActivationEnd(chatId, success, reason = 'completed') {
        const unblocked = this.blocker.unblockUser(chatId, success ? 'completed' : 'failed');
        
        if (unblocked) {
            this.logger.info(`🔓 ATIVAÇÃO CONCLUÍDA - Usuário ${chatId} desbloqueado (sucesso: ${success})`);
        }
        
        return unblocked;
    }

    // === VERIFICADORES DE COMANDO (CÓPIA DOS MÉTODOS DO WHATSAPP HANDLER) ===

    isSupportCommand(messageText) {
        return ['/suporte', 'suporte', 'ajuda', 'help'].includes(messageText);
    }

    isCancelCommand(messageText) {
        return ['cancelar', 'parar', 'stop', 'cancel', '/cancel'].includes(messageText);
    }

    isMenuCommand(messageText) {
        return ['/start', 'menu', 'oi', 'olá', 'inicio'].includes(messageText);
    }

    isVerifyCommand(messageText) {
        return ['verificar', 'pago', 'verifique', 'check'].includes(messageText);
    }

    isProductSelection(messageText) {
        // Verificar se é um número (seleção de produto)
        const num = parseInt(messageText);
        if (num > 0 && num <= 20) { // Assumindo máximo 20 produtos
            return true;
        }
        
        // Verificar nomes comuns de produtos
        const productKeywords = ['duplexplay', 'ibosol', 'iptv', 'tv', 'duplex'];
        return productKeywords.some(keyword => messageText.includes(keyword));
    }

    // === MÉTODOS DE UTILITÁRIO ===

    /**
     * Obtém estatísticas do interceptor
     */
    getStats() {
        return {
            ...this.blocker.getStats(),
            interceptorActive: true
        };
    }

    /**
     * Lista usuários bloqueados
     */
    getBlockedUsers() {
        return this.blocker.getBlockedUsers();
    }

    /**
     * Força desbloqueio (para admin)
     */
    forceUnblock(chatId) {
        return this.blocker.forceUnblock(chatId);
    }
}

module.exports = ActivationInterceptor;
