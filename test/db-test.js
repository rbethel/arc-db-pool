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
    let numberRequests = 2;
    t.plan(1);

    let results = await Promise.all(
        Array(numberRequests)
            .fill()
            .map((_, index) =>
                tiny
                    .get({ url: "http://localhost:3333/hksql", data: { bypass: false } })
                    .catch((e) => t.fail((index + 1).toString()))
            )
    );
    let times = results
        .map((item, index) => {
            if (item && item.body) {
                return { duration: item.body.duration, startTime: item.body.startTime };
            } else return "error";
        })
        .sort((a, b) => a.startTime <= b.startTime);
    console.log(times);
    t.ok(true, "timing test");
});

// this ends sandbox
test("end", async (t) => {
    t.plan(1);
    await sandbox.end();
    t.ok(true, "ended");
});
