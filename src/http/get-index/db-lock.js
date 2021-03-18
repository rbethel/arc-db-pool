let arc = require("@architect/functions");
// let { PrismaClient } = require("@prisma/client");
let util = require("util");
let setTimeoutPromise = util.promisify(setTimeout);
let { ulid } = require("ulid");
let AbortController = require("abort-controller");

// let prisma = new PrismaClient();
// let dbOperation = async () => {
//     await prisma.$connect();
//     await prisma.findMany({});
// };

// let dbCleanup = prisma.$disconnect;

async function requestDbLock(operation, cleanup, { maxLock = 100, poolName = "pool1", poolSize = 20 }) {
    console.time("dynUp");
    let dynamo = await arc.tables();
    console.timeEnd("dynUp");
    let nowMs = Date.now();
    let lockId = ulid(nowMs);
    let nowSec = Math.round(nowMs / 1000);
    let ttl = nowSec + 60 * 60;

    // Grab a spot in line in the Pool
    console.time("dynPut");
    await dynamo.dbpool.put({ pk: poolName, sk: lockId, exp: nowMs + maxLock, ttl });
    console.timeEnd("dynPut");

    //if db operations don't complete in max time window attempt to disconnect and remove lock from pool
    let ac = new AbortController();
    let signal = ac.signal;
    let timeExpired = false;
    setTimeoutPromise(maxLock, timeExpired, { signal })
        .then(async (expired) => {
            expired = true;
            await cleanup();
            await dynamo.dbpool.delete({ pk: poolName, sk: lockId });
        })
        .catch((err) => {
            if (err.message === "AbortError") console.log("The timeout was aborted");
        });

    ac.abort();
    let waitForQue = 50; //ms to wait if que full
    let waitVariance = 50; //ms variation in wait time
    console.time("dynQuery");
    let maxTimeToQue = await checkQue(dynamo, { lockId, nowMs, poolName, poolSize });
    console.timeEnd("dynQuery");
    let n = 0;
    //
    console.time("dynQueryWhile");
    while (maxTimeToQue > Date.now() && n < 3) {
        n++;
        await setTimeoutPromise(
            Math.min(maxTimeToQue - Date.now(), waitForQue + Math.random() * waitVariance),
            undefined
        );
        maxTimeToQue = await checkQue(dynamo, { lockId, nowMs, poolName, poolSize });
    }
    console.timeEnd("dynQueryWhile");

    console.time("op");
    let result = await operation();
    console.timeEnd("op");

    if (!timeExpired) {
        console.time("ac");
        ac.abort();
        console.timeEnd("ac");
        await cleanup();
        console.time("dynDelete");
        await dynamo.dbpool.delete({ pk: poolName, sk: lockId });
        console.timeEnd("dynDelete");
    } else console.log("time expired");
    return result;
}

async function checkQue(dynamo, { queryLimit = 1000, poolName, poolSize, nowMs, lockId }) {
    let poolQuery = await dynamo.dbpool.query({
        ExpressionAttributeNames: { "#p": "pk" },
        KeyConditionExpression: "#p = :p ",
        ExpressionAttributeValues: { ":p": poolName },
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

module.exports = { requestDbLock };
