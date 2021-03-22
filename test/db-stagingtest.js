const tiny = require("tiny-json-http");
const test = require("tape");
// const sandbox = require("@architect/sandbox");

const baseUrl = "https://rugq9oorec.execute-api.us-east-1.amazonaws.com";

// this starts a sandbox environment for the tests to excecute in.
// test("start", async (t) => {
//     t.plan(1);
//     await sandbox.start();
//     t.ok(true, "started");
// });

test("timing test", async (t) => {
    t.plan(1);
    Array(20)
        .fill()
        .map((item, index) => 1 + index)
        .map((i) => console.time(i));
    await Promise.all([
        Array(20)
            .fill()
            .map((item, index) => 1 + index)
            .map((i) => tiny.get({ url: baseUrl + "/timetest" }).then(() => console.timeEnd(i))),
    ]);
    t.ok(true, "timing test");
});

// this ends sandbox
// test("end", async (t) => {
//     t.plan(1);
//     await sandbox.end();
//     t.ok(true, "ended");
// });
