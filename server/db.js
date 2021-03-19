const mysql = require("mysql2/promise");

const config = require("./config");

const pool = mysql.createPool({
    ...config.mysql,
    charset: 'utf8mb4_bin',
    multipleStatements: true
});

module.exports = {
    pool,
    query: async (...args) => {
        let [results] = await pool.query(...args);
        return results;
    }
};
