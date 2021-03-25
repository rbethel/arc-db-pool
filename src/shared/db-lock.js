let arc = require("@architect/functions");
let { ulid } = require("ulid");

async function requestDbLock(
    operation,
    cleanup,
    { timeout = 10000, poolName = "pool1", poolSize = 20, bypass = false }
) {
    if (bypass) {
        let result = await operation();
        await cleanup();
        return result;
    }
    let dynamo = await arc.tables();
    let nowMs = Date.now();
    let lockId = ulid(nowMs);
    let nowSec = Math.round(nowMs / 1000);
    let ttl = nowSec + 60 * 60;

    // Grab a spot in line in the Pool
    await dynamo.dbpool.put({ pk: poolName, sk: lockId, exp: nowMs + timeout, ttl });

    //if db operations don't complete in max time window attempt to disconnect and remove lock from pool
    let didTimeout = false;
    let maxTimeout = timeoutWithCancel(timeout, "Max Time Expired");
    maxTimeout.promise
        .then(async () => {
            didTimeout = true;
            await cleanup();
            await dynamo.dbpool.delete({ pk: poolName, sk: lockId });
        })
        .catch((e) => {
            if (e !== "silent") {
                console.log(e);
            }
        });
    console.time("wait");
    await waitUntilOnQueue(dynamo, { lockId, nowMs, poolName, poolSize });
    console.timeEnd("wait");

    let result = null;
    if (didTimeout === false) result = await operation();
    if (didTimeout === false) {
        maxTimeout.cancel("silent");
        await cleanup();
        await dynamo.dbpool.delete({ pk: poolName, sk: lockId });
    }
    return result;
}

async function waitUntilOnQueue(dynamo, { lockId, nowMs, poolName, poolSize }) {
    let maxTimeToQueue = await checkQueue(dynamo, { lockId, nowMs, poolName, poolSize });

    let waitForQueueMs = 100; //ms to wait if que full
    let waitVariance = 50; //ms variation in wait time
    let retries = 0;

    while (maxTimeToQueue > Date.now() && retries < 3) {
        retries++;
        console.log({
            waitLoop: Math.min(Math.max(maxTimeToQueue - Date.now(), 0), waitForQueueMs + Math.random() * waitVariance),
        });
        await wait(Math.min(Math.max(maxTimeToQueue - Date.now(), 0), waitForQueueMs + Math.random() * waitVariance));
        maxTimeToQueue = await checkQueue(dynamo, { lockId, nowMs, poolName, poolSize });
    }
}

async function checkQueue(dynamo, { queryLimit = 1000, poolName, poolSize, nowMs, lockId }) {
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

function timeoutWithCancel(ms, value) {
    let promise, _timeout, cancel;
    promise = new Promise(function (resolve, reject) {
        _timeout = setTimeout(function () {
            resolve(value);
        }, ms);
        cancel = function (err) {
            reject(err || new Error("Timeout Cancelled"));
            clearTimeout(_timeout);
        };
    });
    return { promise, cancel };
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { requestDbLock };
