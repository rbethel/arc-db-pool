let arc = require("@architect/functions");
let { PrismaClient } = require("@prisma/client");
let util = require("util");
let setTimeoutPromise = util.promisify(setTimeout);
let ulid = require("ulid");
let AbortController = require("abort-controller");

let prisma = new PrismaClient();
let dbOperation = async () => {
    await prisma.$connect();
    await prisma.findMany({});
};

let dbCleanup = prisma.$disconnect;

async function requestDbLock(operation, cleanup, options = { maxLock: 5000 }) {
    let { maxLock } = options;
    let queryLimit = 1000;
    let poolSize = 20;
    let waitForQue = 50;
    let waitVariance = 20;
    let dynamo = await arc.tables();
    let nowMs = Date.now();
    let lockId = ulid();
    let nowSec = now / 1000;
    let ttl = nowSec + 60 * 60;

    // Grab a spot in line in the Pool
    await dynamo.dbpool.put({ pk: "pool1", sk: lockId, exp: nowMs + maxLock, ttl });

    //if db operations don't complete in max window attempt to disconnect and remove lock from pool
    let ac = new AbortController();
    let signal = ac.signal;
    let timeExpired = false;
    setTimeoutPromise(maxLock, timeExpired, { signal })
        .then(async (expired) => {
            expired = true;
            await cleanup();
            await dynamo.dbpool.delete({ pk: "pool1", sk: lockId });
        })
        .catch((err) => {
            if (err.message === "AbortError") console.log("The timeout was aborted");
        });

    let maxTimeToQue = await checkQue(dynamo);
    let n = 0;
    while (maxTimeToQue > Date.now() && n < 3) {
        n++;
        await new Promise((resolve) => {
            setTimeout(resolve, min(maxTimeToQue - Date.now(), waitForQue + Math.random() * waitVariance));
        });
        maxTimeToQue = await checkQue(dynamo);
    }

    let result = await operation();

    if (!timeExpired) {
        ac.abort();
        await cleanup();
        await dynamo.dbpool.delete({ pk: "pool1", sk: lockId });
    }
    return result;
}

async function checkQue(dyn) {
    let poolQuery = await dyn.dbpool.query({
        ExpressionAttributeNames: { "#p": "pk" },
        KeyConditionExpression: "#p = :p ",
        ExpressionAttributeValues: { ":p": "pool1" },
        ScanIndexForward: false,
        Limit: queryLimit,
        ConsistentRead: true,
    });
    let pool = poolQuery.Items.filter((item) => item.exp <= nowMs);
    let orderedQue = pool.slice().sort((a, b) => (a.sk > b.sk ? 1 : -1));
    let myPlaceInQue = orderedQue.map((item) => item.sk).indexOf(lockId);
    let expirationTimesBeforeMe = orderedQue.slice(0, myPlaceInQue - 1).sort((a, b) => (a.exp > b.exp ? 1 : -1));
    let maxTimeToQue = myPlaceInQue > poolSize - 1 ? expirationTimesBeforeMe[myPlaceInQue - pool - 1].exp : Date.now();
    return maxTimeToQue;
}
