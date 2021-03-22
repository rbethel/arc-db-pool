const tiny = require("tiny-json-http");
const test = require("tape");
const sandbox = require("@architect/sandbox");

const baseUrl = "http://localhost:3333";

// this starts a sandbox environment for the tests to excecute in.
test("start", async (t) => {
    t.plan(1);
    await sandbox.start();
    t.ok(true, "started");
});

test("timing test", async (t) => {
    t.plan(1);
    Array(10)
        .fill()
        .map((_, idx) => console.time(1 + idx));
    await Promise.all([
        tiny.get({ url: baseUrl + "/timetest" }).then(() => console.timeEnd(1)),
        tiny.get({ url: baseUrl + "/timetest" }).then(() => console.timeEnd(2)),
        tiny.get({ url: baseUrl + "/timetest" }).then(() => console.timeEnd(3)),
        tiny.get({ url: baseUrl + "/timetest" }).then(() => console.timeEnd(4)),
        tiny.get({ url: baseUrl + "/timetest" }).then(() => console.timeEnd(5)),
        tiny.get({ url: baseUrl + "/timetest" }).then(() => console.timeEnd(6)),
        tiny.get({ url: baseUrl + "/timetest" }).then(() => console.timeEnd(7)),
        tiny.get({ url: baseUrl + "/timetest" }).then(() => console.timeEnd(8)),
        tiny.get({ url: baseUrl + "/timetest" }).then(() => console.timeEnd(9)),
        tiny.get({ url: baseUrl + "/timetest" }).then(() => console.timeEnd(10)),
    ]);
    Array(10)
        .fill()
        .map((_, idx) => console.time(11 + idx));
    await Promise.all([
        tiny.get({ url: baseUrl }).then(() => console.timeEnd(11)),
        tiny.get({ url: baseUrl }).then(() => console.timeEnd(12)),
        tiny.get({ url: baseUrl }).then(() => console.timeEnd(13)),
        tiny.get({ url: baseUrl }).then(() => console.timeEnd(14)),
        tiny.get({ url: baseUrl }).then(() => console.timeEnd(15)),
        tiny.get({ url: baseUrl }).then(() => console.timeEnd(16)),
        tiny.get({ url: baseUrl }).then(() => console.timeEnd(17)),
        tiny.get({ url: baseUrl }).then(() => console.timeEnd(18)),
        tiny.get({ url: baseUrl }).then(() => console.timeEnd(19)),
        tiny.get({ url: baseUrl }).then(() => console.timeEnd(20)),
    ]);

    t.ok(true, "timing test");
});

// this ends sandbox
test("end", async (t) => {
    t.plan(1);
    await sandbox.end();
    t.ok(true, "ended");
});
