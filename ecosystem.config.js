/*
    Esta es la configuración para PM2
    https://pm2.keymetrics.io/
*/

module.exports = {
  apps : [{
    name: 'ks-visor3d-web',
    script: './server/index.js',
	
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env_production: {
      NODE_ENV: 'production'
    }
  }, {
    name: 'ks-visor3d-processor',
    script: './server/process/processor.js',
	
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};