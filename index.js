const http = require("http");
const {main} = require('./script');

http
  .createServer(function (req, res) {
    console.log(`Just got a request at ${req.url}!`);

    const data = main();

    res.write(data);
    res.end();
  })
  .listen(process.env.PORT || 3000);
