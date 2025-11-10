const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
	port: process.env.DB_PORT,
	ssl:
		process.env.DB_HOST &&
		process.env.DB_HOST !== "localhost" &&
		process.env.DB_HOST !== "127.0.0.1" &&
		!process.env.DB_HOST.startsWith("/cloudsql/")
			? { rejectUnauthorized: false }
			: false,
});

module.exports = pool;
