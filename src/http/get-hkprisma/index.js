let { PrismaClient } = require("@prisma/client");
let { requestDbLock } = require("@architect/shared/db-lock");
let prisma = new PrismaClient();

exports.handler = async function http(req) {
    // let dbOperation = async () => await prisma.user.findMany({ include: { posts: true } });
    let dbOperation = async () => {
        await prisma.post.create({ data: { title: "test" + Date.now() } });
        return await prisma.post.findMany({ where: { published: false } });
    };
    let cleanup = async () => await prisma.$disconnect();

    let result = await requestDbLock(dbOperation, cleanup, { maxTime: 10000, poolSize: 5 });

    let output = JSON.stringify(result);
    return {
        statusCode: 200,
        headers: {
            "cache-control": "no-cache, no-store, must-revalidate, max-age=0, s-maxage=0",
            "content-type": "text/html; charset=utf8",
        },
        body: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body class="padding-32">
        <h1 class="margin-bottom-16">
          Hello from Node.js!
        </h1>
        <pre>${output}</pre>
</body>
</html>
`,
    };
};
