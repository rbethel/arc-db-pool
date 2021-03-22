let arc = require("@architect/functions");
let { ulid } = require("ulid");

async function requestDbLock(operation, cleanup, { maxTime = 10000, poolName = "pool1", poolSize = 20 }) {
    let dynamo = await arc.tables();
    let nowMs = Date.now();
    let lockId = ulid(nowMs);
    let nowSec = Math.round(nowMs / 1000);
    let ttl = nowSec + 60 * 60;

    // Grab a spot in line in the Pool
    await dynamo.dbpool.put({ pk: poolName, sk: lockId, exp: nowMs + maxTime, ttl });

    //if db operations don't complete in max time window attempt to disconnect and remove lock from pool
    let didTimeout = false;
    let maxTimeout = timeout(maxTime, "Max Time Expired");
    maxTimeout.promise
        .then(async () => {
            await cleanup();
            await dynamo.dbpool.delete({ pk: poolName, sk: lockId });
            didTimeout = true;
        })
        .catch((e) => {
            if (e !== "silent") {
                console.log(e);
            }
        });

    let waitForQue = 100; //ms to wait if que full
    let waitVariance = 50; //ms variation in wait time
    let maxTimeToQue = await checkQue(dynamo, { lockId, nowMs, poolName, poolSize });
    let n = 0;

    while (maxTimeToQue > Date.now() && n < 3) {
        n++;
        await wait(Math.min(Math.max(maxTimeToQue - Date.now(), 0), waitForQue + Math.random() * waitVariance));
        maxTimeToQue = await checkQue(dynamo, { lockId, nowMs, poolName, poolSize });
    }

    let result = await operation();

    if (!didTimeout) {
        maxTimeout.cancel("silent");
        await cleanup();
        await dynamo.dbpool.delete({ pk: poolName, sk: lockId });
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
    let pool = poolQuery.Items.filter((item) => item.exp >= nowMs);
    let orderedQue = pool.slice().sort((a, b) => (a.sk > b.sk ? 1 : -1));
    let myPlaceInQue = orderedQue.map((item) => item.sk).indexOf(lockId);
    let expirationTimesBeforeMe = orderedQue.slice(0, myPlaceInQue - 1).sort((a, b) => (a.exp > b.exp ? 1 : -1));
    let maxTimeToQue = myPlaceInQue > poolSize ? expirationTimesBeforeMe[myPlaceInQue - poolSize - 1].exp : Date.now();
    return maxTimeToQue;
}

function timeout(ms, value) {
    let promise, timeout, cancel;
    promise = new Promise(function (resolve, reject) {
        timeout = setTimeout(function () {
            resolve(value);
        }, ms);
        cancel = function (err) {
            reject(err || new Error("Timeout Cancelled"));
            clearTimeout(timeout);
        };
    });
    return { promise, cancel };
}

function wait(ms) {
    new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { requestDbLock };
