let test = require("tape");
let sandbox = require("@architect/sandbox");
let arc = require("@architect/functions");
let { ulid } = require("ulid");
let { requestDbLock, wait } = require("../src/shared/db-lock");

// this starts a sandbox environment for the tests to excecute in.
test("start", async (t) => {
    t.plan(1);
    await sandbox.start();
    t.ok(true, "started");
});

// test("start immediately", async (t) => {
//     t.plan(1);
//     let dynamo = await arc.tables();
//     //add 4 long items to queue
//     await addToQueue({ number: 4, timeoutMs: 10000, poolName: "pool1" }, ulid, dynamo);
//     await wait(10); //make sure next items ulid is not in same ms
//     //start the test
//     let dbOperation = async () => await wait(100, "success");
//     let cleanup = async () => await wait(10);
//     let startTime = Date.now();
//     let result = await requestDbLock(dbOperation, cleanup, {
//         timeout: 10000,
//         poolSize: 5,
//         poolName: "pool1",
//         bypass: false,
//     });
//     let duration = Date.now() - startTime;
//     //clear queue
//     await clearPool("pool1", dynamo);
//     t.ok(result === "success", `time to execute: ${duration}`);
// });

test("wait for one item that timed out after 1sec", async (t) => {
    let dynamo = await arc.tables();
    t.plan(1);
    await addToQueue({ number: 4, timeoutMs: 10000, poolName: "pool1" }, ulid, dynamo);
    await addToQueue({ number: 1, timeoutMs: 1000, poolName: "pool1" }, ulid, dynamo);
    await wait(10); //make sure next items ulid is not in same ms
    //start the test
    let dbOperation = async () => await wait(100, "success");
    let cleanup = async () => await wait(10);
    let startTime = Date.now();
    let result = await requestDbLock(dbOperation, cleanup, {
        timeout: 10000,
        poolSize: 5,
        poolName: "pool1",
        bypass: false,
        maxRetries: 10,
        minWaitQueueMs: 100,
    });
    let duration = Date.now() - startTime;
    await clearPool("pool1", dynamo);
    t.ok(result === "success" && duration > 1000, `time to execute: ${duration}`);
});

test("test bypass mode", async (t) => {
    let dynamo = await arc.tables();
    t.plan(1);
    await addToQueue({ number: 6, timeoutMs: 10000, poolName: "pool1" }, ulid, dynamo);
    //start the test
    let dbOperation = async () => await wait(100, "success");
    let cleanup = async () => await wait(10);
    let startTime = Date.now();
    let result = await requestDbLock(dbOperation, cleanup, {
        timeout: 10000,
        poolSize: 5,
        poolName: "pool1",
        bypass: true,
    });
    let duration = Date.now() - startTime;
    await clearPool("pool1", dynamo);
    t.ok(result === "success" && duration < 1000, `time to execute: ${duration}`);
});

// this ends sandbox
test("end", async (t) => {
    t.plan(1);
    await sandbox.end();
    t.ok(true, "ended");
});

async function clearPool(poolName, dynamo) {
    //clear the pool
    let oldPool = await dynamo.dbpool.query({
        ExpressionAttributeNames: { "#p": "pk" },
        KeyConditionExpression: "#p = :p ",
        ExpressionAttributeValues: { ":p": poolName },
        ScanIndexForward: false,
        Limit: 1000,
        ConsistentRead: true,
    });
    // console.dir(oldPool.Items);
    for (let index = 0; index < oldPool.Items.length; index++) {
        await dynamo.dbpool.delete({ pk: poolName, sk: oldPool.Items[index].sk });
    }
}

async function addToQueue({ number, timeoutMs = 10000, poolName }, ulid, dynamo) {
    //fill queue with items that will stay for duration of this test
    let lockId, nowMs, nowSec, ttl;
    for (let index = 1; index <= number; index++) {
        nowMs = Date.now();
        lockId = ulid(nowMs);
        nowSec = Math.round(nowMs / 1000);
        ttl = nowSec + 60 * 60;
        await dynamo.dbpool.put({ pk: poolName, sk: lockId, exp: nowMs + timeoutMs, ttl });
    }
}
