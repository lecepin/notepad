var express = require("express");

var app = (module.exports = express.Router());

app.get("/api/valid", function (req, res) {
  res.status(200).send({ success: true });
});
