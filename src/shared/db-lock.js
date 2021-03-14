let arc = require("@architect/functions");
let util = require("util");
let setTimeoutPromise = util.promisify(setTimeout);

let ac = new AbortController();
let signal = ac.signal;

setTimeoutPromise(1000, "foobar", { signal })
    .then(console.log)
    .catch((err) => {
        if (err.message === "AbortError") console.log("The timeout was aborted");
    });

ac.abort();

async function requestDbLock(options = { duration: 1000 }) {
    let { duration } = options;

    //Request lock for relational DB from dynamoDb pool with a conditional update

    //if lock is rejected wait with a set timeout using exponential backoff

    //try again eventually abort if lock is not obtained

    //if lock is obtained set a timeout for the whole operation  that will remove lock after timeout regardless of completion
}
