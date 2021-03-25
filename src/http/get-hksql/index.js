let { requestDbLock } = require("@architect/shared/db-lock");
let { Client } = require("pg");
let config = {
    host: process.env.PG_HOST,
    user: process.env.PG_USERNAME,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
    port: 5432,
    ssl: {
        rejectUnauthorized: false,
    },
};

exports.handler = async function http(req) {
    let query = req.queryStringParameters;
    let bypass = query && query.bypass && query.bypass === "true" ? true : false;
    let now = Date.now();
    let client = new Client(config);
    let dbOperation = async () => {
        await client.connect();
        let res = await client.query('SELECT * FROM "public"."Post" ORDER BY "id" LIMIT 100 OFFSET 0;');
        return res;
    };
    let cleanup = async () => await client.end();

    let result = await requestDbLock(dbOperation, cleanup, { timeout: 10000, poolSize: 20, bypass });

    let duration = Date.now() - now;

    let output = JSON.stringify({ duration, startTime: now, result: result.rows });
    return {
        statusCode: 200,
        headers: {
            "cache-control": "no-cache, no-store, must-revalidate, max-age=0, s-maxage=0",
            "content-type": "application/json; charset=utf8",
        },
        body: output,
    };
};
