module.exports = {
  apps: [{
    name: 'core-system',
    script: 'core-system.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      WHATSAPP_BOT_URL: 'http://localhost:3000',
      MERCADO_PAGO_TOKEN: '',
      WEBHOOK_URL: 'http://localhost:3001',
      LOG_LEVEL: 'info'
    },
    env_development: {
      NODE_ENV: 'development',
      PORT: 3001,
      WHATSAPP_BOT_URL: 'http://localhost:3000',
      MERCADO_PAGO_TOKEN: '',
      WEBHOOK_URL: 'http://localhost:3001',
      LOG_LEVEL: 'debug'
    },
    
    // Configurações específicas para VPS
    node_args: '--max-old-space-size=512',
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 5000,
    
    // Logs
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Restart em caso de falha
    min_uptime: '10s',
    max_restarts: 5,
    
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001,
      WHATSAPP_BOT_URL: process.env.WHATSAPP_BOT_URL || 'http://localhost:3000',
      MERCADO_PAGO_TOKEN: process.env.MERCADO_PAGO_TOKEN || '',
      WEBHOOK_URL: process.env.WEBHOOK_URL || 'http://localhost:3001',
      LOG_LEVEL: 'info',
      TZ: 'America/Sao_Paulo'
    }
  }]
};
