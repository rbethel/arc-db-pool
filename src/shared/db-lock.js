let arc = require("@architect/functions");
 let { PrismaClient } = require("@prisma/client");
let util = require("util");
let setTimeoutPromise = util.promisify(setTimeout);
let ulid = require("ulid");
let AbortController = require("abort-controller")



    let prisma = new PrismaClient()
let action = ()=>{
    await prisma.$connect()
    await prisma.findMany({})
}

    let cleanup = prisma.$disconnect


async function requestDbLock(action, cleanup, options = { maxLock: 5000 }) {
    let ac = new AbortController();
    let signal = ac.signal;

    let { maxLock } = options;
    let queryLimit = 1000;
    let poolSize = 20;
    let dynamo = await arc.tables();
    let nowMs = Date.now();
    let lockId = ulid();
    let nowSec = now / 1000;
    let ttl = nowSec + 60 * 60;
    let clean=async (cleanup)=>{
        await cleanup()
 await dynamo.dbpool.delete({ pk: "pool1", sk: lockId }); 
 return
  }

    //if db operations don't complete in max window a disconnect and remove lock from pool
    setTimeoutPromise(maxLock, "foobar", { signal })
        .then({
            //cleanup 
        })
        .catch((err) => {
            if (err.message === "AbortError") console.log("The timeout was aborted");
        })


    await dynamo.dbpool.put({ pk: "pool1", sk: lockId, exp: nowMs + maxLock, ttl });
    let poolQuery= await dynamo.dbpool.query({
        ExpressionAttributeNames: { "#p": "pk" },
        KeyConditionExpression: "#p = :p ",
        ExpressionAttributeValues: { ":p": "pool1" },
        ScanIndexForward: false,
        Limit: queryLimit,
        ConsistentRead: true,
    });
let pool = poolQuery.Items.filter(item=>item.exp<=nowMs)






    let result = await action();

    ac.abort();
    await clean()
    return result
}
