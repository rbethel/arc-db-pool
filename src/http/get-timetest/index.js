let { requestDbLock } = require("@architect/shared/db-lock");

exports.handler = async function http(req) {
    let dbOperation = () =>
        new Promise((resolve) => setTimeout(() => resolve({ message: "hello world" }), 100 + Math.random() * 20));
    let cleanup = () => new Promise((resolve) => setTimeout(resolve, 10));

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
