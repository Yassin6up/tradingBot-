module.exports = {
  apps: [{
    name: 'trading-bot',
    script: 'tsx',
    args: 'server/index.ts',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    watch: false,
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '500M'
  }]
}
