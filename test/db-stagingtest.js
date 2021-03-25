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
    // t.plan(2);

    await Promise.all(
        Array(100)
            .fill()
            .map((_, index) => {
                console.time((index + 1).toString());
                tiny.get({ url: baseUrl + "/hksql", data: { bypass: "true" } })
                    .then(() => {
                        console.timeEnd((index + 1).toString());
                        return;
                    })
                    .catch((e) => t.fail((index + 1).toString()));
                // .finally(() => t.ok(true, (index + 1).toString()));
            })
    );
    t.timeoutAfter(10000);
    // t.ok(true, "timing test");
});

// this ends sandbox
// test("end", async (t) => {
//     t.plan(1);
//     await sandbox.end();
//     t.ok(true, "ended");
// });
