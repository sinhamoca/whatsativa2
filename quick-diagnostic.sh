#!/bin/bash

# quick-diagnostic.sh - Script de diagnóstico rápido do sistema de pagamentos

echo "🔍 DIAGNÓSTICO RÁPIDO DO SISTEMA DE PAGAMENTOS"
echo "=============================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log colorido
log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

log_info() {
    echo -e "${BLUE}ℹ️ $1${NC}"
}

# Configurações
CORE_SYSTEM_URL="http://localhost:3001"
NODE_MODULES_PATH="./node_modules"
DATABASE_PATH="./database.sqlite"

echo "🔧 Configurações:"
echo "   Core System URL: $CORE_SYSTEM_URL"
echo "   Database Path: $DATABASE_PATH"
echo ""

# 1. Verificar se Node.js está instalado
echo "📋 1. Verificando Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    log_success "Node.js instalado: $NODE_VERSION"
else
    log_error "Node.js não encontrado. Instale o Node.js primeiro."
    exit 1
fi

# 2. Verificar dependências
echo ""
echo "📋 2. Verificando dependências..."
if [ -d "$NODE_MODULES_PATH" ]; then
    log_success "Pasta node_modules encontrada"
else
    log_warning "Pasta node_modules não encontrada"
    echo "   Execute: npm install"
fi

# Verificar pacotes críticos
REQUIRED_PACKAGES=("axios" "pino" "sqlite3")
for package in "${REQUIRED_PACKAGES[@]}"; do
    if [ -d "$NODE_MODULES_PATH/$package" ]; then
        log_success "Pacote $package: OK"
    else
        log_error "Pacote $package: FALTANDO"
    fi
done

# 3. Verificar arquivos do sistema
echo ""
echo "📋 3. Verificando arquivos do sistema..."
REQUIRED_FILES=(
    "core-system/core-system.js"
    "core-system/database-service.js" 
    "core-system/mercadopago-service.js"
    "core-system/payment-monitor.js"
    "core-system/whatsapp-handler.js"
    "core-system/order-service.js"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        log_success "Arquivo $file: OK"
    else
        log_error "Arquivo $file: FALTANDO"
    fi
done

# 4. Verificar banco de dados
echo ""
echo "📋 4. Verificando banco de dados..."
if [ -f "$DATABASE_PATH" ]; then
    log_success "Arquivo de banco encontrado"
    
    # Verificar se o banco é acessível
    if command -v sqlite3 &> /dev/null; then
        TABLES=$(sqlite3 "$DATABASE_PATH" ".tables" 2>/dev/null || echo "")
        if [ ! -z "$TABLES" ]; then
            log_success "Banco de dados acessível"
            echo "   Tabelas: $TABLES"
        else
            log_error "Erro ao acessar banco de dados"
        fi
    else
        log_warning "sqlite3 CLI não instalado - não é possível verificar estrutura"
    fi
else
    log_warning "Arquivo de banco não encontrado - será criado na primeira execução"
fi

# 5. Verificar se o Core System está rodando
echo ""
echo "📋 5. Verificando Core System..."
if command -v curl &> /dev/null; then
    HEALTH_CHECK=$(curl -s "$CORE_SYSTEM_URL/health" 2>/dev/null || echo "")
    if [ ! -z "$HEALTH_CHECK" ]; then
        log_success "Core System respondendo"
        
        # Analisar resposta do health check
        if echo "$HEALTH_CHECK" | grep -q '"success":true'; then
            log_success "Sistema reporta status OK"
        else
            log_warning "Sistema reporta problemas"
        fi
        
        if echo "$HEALTH_CHECK" | grep -q '"paymentMonitor":true'; then
            log_success "Payment Monitor ativo"
        else
            log_error "Payment Monitor INATIVO"
        fi
        
        if echo "$HEALTH_CHECK" | grep -q '"mercadoPago":true'; then
            log_success "Mercado Pago configurado"
        else
            log_error "Mercado Pago NÃO CONFIGURADO"
        fi
        
    else
        log_error "Core System não está respondendo"
        log_info "Para iniciar: node core-system/core-system.js"
    fi
else
    log_warning "curl não disponível - não é possível verificar Core System"
fi

# 6. Verificar processos Node.js
echo ""
echo "📋 6. Verificando processos Node.js..."
if command -v pgrep &> /dev/null; then
    NODE_PROCESSES=$(pgrep -f "node.*core-system" 2>/dev/null || echo "")
    if [ ! -z "$NODE_PROCESSES" ]; then
        log_success "Processos Core System encontrados: $NODE_PROCESSES"
    else
        log_warning "Nenhum processo Core System encontrado"
    fi
else
    log_warning "pgrep não disponível"
fi

# 7. Verificar portas
echo ""
echo "📋 7. Verificando portas..."
if command -v netstat &> /dev/null; then
    PORT_3001=$(netstat -tuln 2>/dev/null | grep ":3001" || echo "")
    if [ ! -z "$PORT_3001" ]; then
        log_success "Porta 3001 em uso (Core System)"
    else
        log_warning "Porta 3001 livre"
    fi
    
    PORT_3000=$(netstat -tuln 2>/dev/null | grep ":3000" || echo "")
    if [ ! -z "$PORT_3000" ]; then
        log_success "Porta 3000 em uso (WhatsApp Bot)"
    else
        log_warning "Porta 3000 livre"
    fi
elif command -v lsof &> /dev/null; then
    PORT_3001=$(lsof -ti:3001 2>/dev/null || echo "")
    if [ ! -z "$PORT_3001" ]; then
        log_success "Porta 3001 em uso (PID: $PORT_3001)"
    else
        log_warning "Porta 3001 livre"
    fi
else
    log_warning "netstat/lsof não disponível"
fi

# 8. Executar diagnóstico JavaScript (se disponível)
echo ""
echo "📋 8. Executando diagnóstico detalhado..."
if [ -f "diagnostic-script.js" ]; then
    log_info "Executando diagnóstico JavaScript..."
    node diagnostic-script.js
else
    log_warning "Script de diagnóstico JavaScript não encontrado"
    echo "   Para diagnóstico completo, execute:"
    echo "   node diagnostic-script.js"
fi

# 9. Gerar relatório final
echo ""
echo "📊 RESUMO DO DIAGNÓSTICO"
echo "========================"

# Contadores
SUCCESS_COUNT=0
ERROR_COUNT=0
WARNING_COUNT=0

# Verificar resultados e dar recomendações
echo ""
if [ -f "$DATABASE_PATH" ] && [ -d "$NODE_MODULES_PATH" ]; then
    log_success "Estrutura básica: OK"
    ((SUCCESS_COUNT++))
else
    log_error "Estrutura básica: PROBLEMAS"
    ((ERROR_COUNT++))
fi

# Testar conexão novamente para relatório final
if command -v curl &> /dev/null; then
    FINAL_HEALTH=$(curl -s "$CORE_SYSTEM_URL/health" 2>/dev/null || echo "")
    if [ ! -z "$FINAL_HEALTH" ]; then
        log_success "Sistema acessível: OK"
        ((SUCCESS_COUNT++))
        
        if echo "$FINAL_HEALTH" | grep -q '"paymentMonitor":true'; then
            log_success "Motor automático: FUNCIONANDO"
            ((SUCCESS_COUNT++))
        else
            log_error "Motor automático: NÃO FUNCIONANDO"
            ((ERROR_COUNT++))
        fi
        
        if echo "$FINAL_HEALTH" | grep -q '"mercadoPago":true'; then
            log_success "Mercado Pago: CONFIGURADO"
            ((SUCCESS_COUNT++))
        else
            log_error "Mercado Pago: NÃO CONFIGURADO"
            ((ERROR_COUNT++))
        fi
    else
        log_error "Sistema inacessível: PROBLEMA"
        ((ERROR_COUNT++))
    fi
fi

echo ""
echo "📈 ESTATÍSTICAS:"
echo "   ✅ Sucessos: $SUCCESS_COUNT"
echo "   ❌ Erros: $ERROR_COUNT"
echo "   ⚠️ Avisos: $WARNING_COUNT"

echo ""
echo "💡 PRÓXIMOS PASSOS:"

if [ $ERROR_COUNT -eq 0 ]; then
    log_success "Sistema funcionando corretamente!"
    echo "   - Execute o monitor em tempo real: node real-time-monitor.js"
    echo "   - Acesse admin panel: $CORE_SYSTEM_URL/admin"
elif [ $ERROR_COUNT -le 2 ]; then
    log_warning "Sistema com problemas menores"
    echo "   - Verifique as configurações do Mercado Pago"
    echo "   - Execute diagnóstico completo: node diagnostic-script.js"
else
    log_error "Sistema com problemas críticos"
    echo "   - Instale dependências: npm install"
    echo "   - Inicie o sistema: node core-system/core-system.js"
    echo "   - Configure Mercado Pago no admin panel"
fi

echo ""
echo "🔗 LINKS ÚTEIS:"
echo "   - Health Check: $CORE_SYSTEM_URL/health"
echo "   - Admin Panel: $CORE_SYSTEM_URL/admin"
echo "   - Diagnóstico completo: node diagnostic-script.js"
echo "   - Monitor tempo real: node real-time-monitor.js"

echo ""
echo "=============================================="
echo "✅ Diagnóstico rápido concluído!"
echo "=============================================="
