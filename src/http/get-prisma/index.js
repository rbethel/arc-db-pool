let { PrismaClient } = require("@prisma/client");
let { requestDbLock } = require("@architect/shared/db-lock");
let prisma = new PrismaClient();

exports.handler = async function http(req) {
    let output;
    try {
        let query = req.queryStringParameters;
        let bypass = query && query.bypass && query.bypass === "true" ? true : false;
        let now = Date.now();
        let dbOperation = async () => {
            let res = await prisma.post.findMany({ where: { published: false } });
            return res;
        };
        let cleanup = async () => await prisma.$disconnect();

        let result = await requestDbLock(dbOperation, cleanup, { maxTime: 10000, poolSize: 5 });

        let output = JSON.stringify(result);
    } catch (e) {
        console.log(e);
    }
    return {
        statusCode: 200,
        headers: {
            "cache-control": "no-cache, no-store, must-revalidate, max-age=0, s-maxage=0",
            "content-type": "application/json; charset=utf8",
        },
        body: output,
    };
};
