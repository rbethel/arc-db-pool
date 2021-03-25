let test = require("tape");
let sandbox = require("@architect/sandbox");
let arc = require("@architect/functions");
let { monotonicFactory } = require("ulid");
let { requestDbLock } = require("../src/shared/db-lock");
let ulid = monotonicFactory();

// this starts a sandbox environment for the tests to excecute in.
test("start", async (t) => {
    t.plan(1);
    await sandbox.start();
    t.ok(true, "started");
});

test("on queue immediately", async (t) => {
    let poolSize = 5;
    let poolName = "pool1";
    let dynamo = await arc.tables();
    let bypass = false;
    t.plan(1);

    //fill queue with items that will stay for duration of this test
    let lockId, nowMs, nowSec, ttl;
    let timeoutMs = 10000;
    let stayOnQueue = 4;
    for (let index = 1; index <= stayOnQueue; index++) {
        nowMs = Date.now();
        lockId = ulid(nowMs);
        nowSec = Math.round(nowMs / 1000);
        ttl = nowSec + 60 * 60;
        await dynamo.dbpool.put({ pk: poolName, sk: lockId, exp: nowMs + timeoutMs, ttl });
    }
    //put some short lived items on the que that will expire
    timeoutMs = 200;
    let shortOnQueue = 0;
    for (let index = 1; index <= shortOnQueue; index++) {
        nowMs = Date.now();
        lockId = ulid(nowMs);
        nowSec = Math.round(nowMs / 1000);
        ttl = nowSec + 60 * 60;
        await dynamo.dbpool.put({ pk: poolName, sk: lockId, exp: nowMs + timeoutMs, ttl });
    }

    //start the test
    let dbOperation = () =>
        new Promise((resolve) => setTimeout(() => resolve({ message: "hello world" }), 100 + Math.random() * 20));
    let cleanup = () => new Promise((resolve) => setTimeout(resolve, 10));

    let startTime = Date.now();

    let result = await requestDbLock(dbOperation, cleanup, { timeout: 10000, poolSize, poolName, bypass });
    let duration = Date.now() - startTime;
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
    await oldPool.Items.forEach(async (item) => await dynamo.dbpool.delete({ pk: poolName, sk: item.sk }));
    t.ok(result && result.message && result.message === "hello world", `Off to on Time: ${duration}`);
});

test("full for 1sec", async (t) => {
    let poolSize = 5;
    let poolName = "pool1";
    let dynamo = await arc.tables();
    let bypass = false;
    t.plan(1);

    //fill queue with items that will stay for duration of this test
    let lockId, nowMs;
    let timeoutMs = 10000;
    let stayOnQueue = 4;
    for (let index = 1; index <= stayOnQueue; index++) {
        nowMs = Date.now();
        lockId = ulid(nowMs);
        nowSec = Math.round(nowMs / 1000);
        ttl = nowSec + 60 * 60;
        await dynamo.dbpool.put({ pk: poolName, sk: lockId, exp: nowMs + timeoutMs, ttl });
    }
    //put some short lived items on the que that will expire
    timeoutMs = 1000;
    let shortOnQueue = 5;
    for (let index = 1; index <= shortOnQueue; index++) {
        nowMs = Date.now();
        lockId = ulid(nowMs);
        nowSec = Math.round(nowMs / 1000);
        ttl = nowSec + 60 * 60;
        await dynamo.dbpool.put({ pk: poolName, sk: lockId, exp: nowMs + timeoutMs, ttl });
    }

    //start the test
    let dbOperation = () =>
        new Promise((resolve) => setTimeout(() => resolve({ message: "hello world" }), 100 + Math.random() * 20));
    let cleanup = () => new Promise((resolve) => setTimeout(resolve, 10));

    let startTime = Date.now();

    let result = await requestDbLock(dbOperation, cleanup, { timeout: 10000, poolSize, poolName, bypass });
    let duration = Date.now() - startTime;
    oldPool = await dynamo.dbpool.query({
        ExpressionAttributeNames: { "#p": "pk" },
        KeyConditionExpression: "#p = :p ",
        ExpressionAttributeValues: { ":p": poolName },
        ScanIndexForward: false,
        Limit: 1000,
        ConsistentRead: true,
    });
    // console.dir(oldPool.Items);
    t.ok(result && result.message && result.message === "hello world", `Off to on Time: ${duration}`);
});

// this ends sandbox
test("end", async (t) => {
    t.plan(1);
    await sandbox.end();
    t.ok(true, "ended");
});
