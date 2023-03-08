require('dotenv').config()
const http = require("http");
const {main} = require('./script');

http
  .createServer(async function (req, res) {
    console.log(`Just got a request at ${req.url}!`);

    const isError = await main(req.headers['x-call-protection']);

    res.write(isError ? 'ok' : 'nok');
    res.end();
  })
  .listen(process.env.PORT || 3000);
