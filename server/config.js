const path = require('path');
const cluster = require('cluster');
const git = require('git-rev-sync');

const workerID = cluster.worker ? cluster.worker.id : 0;
let buildHash = "unknown";
try { buildHash = git.short() + (git.isDirty() ? '-dirty' : ''); } catch(ex) { console.log(ex); }
const PRODUCTION = process.env.NODE_ENV === 'production';

module.exports = {
    mysql: {
        host: '127.0.0.1',
        user: 'root',
        password: '',
        database: 'ks_visor',
		socketPath: PRODUCTION ? '/var/run/mysqld/mysqld.sock' : undefined
    },
    spaces: {
        endpoint: 'nyc3.digitaloceanspaces.com',
        edge_endpoint: 'nyc3.cdn.digitaloceanspaces.com',
        bucket: 'ks-visor3d',
        key: 'BRR4OXPXVRF6GYKTD4L5',
        secret: 'JQZFerudf/bfooWdaAg5ELFfeEtomzyog2RUoexLmp0'
    },
    panel_users: {
        'visorks': 'ksvisor2020'
    },
    PUBLIC_DIR: path.join(__dirname, '../client/public'),
    STORAGE_DIR: path.join(__dirname, '../storage'),
    PRODUCTION: PRODUCTION,
    UPLOAD_EVICT_INTERVAL_SECONDS: 60 * 60 * 3, // 3 horas
    UPLOAD_EVICT_AFTER_SECONDS: 60 * 60 * 24, // 1 dia
    workerID,
    buildHash
};