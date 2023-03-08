require('dotenv').config()
const http = require("http");
const {main} = require('./script');

http
  .createServer(async function (req, res) {
    console.log(`Just got a request at ${req.url}!`);

    const mainResponse = await main(req.headers);

    res.write(mainResponse);
    res.end();
  })
  .listen(process.env.PORT || 3000);
