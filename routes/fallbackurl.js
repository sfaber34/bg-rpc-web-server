const express = require('express');
const router = express.Router();
const { fallbackUrl } = require('../config');

router.get("/fallbackurl", (req, res) => {
  res.send(
    "<style>" +
      "body { font-family: Arial, sans-serif; margin: 0px; }" +
      ".container { margin: 0px 10px; }" +
    "</style>" +
    "<html><body><div class='container'><div style='padding:20px;font-size:18px'><H1>PROXY TO:</H1></div><pre>" +
      fallbackUrl +
      "</pre></div></body></html>"
  );
});

module.exports = router;