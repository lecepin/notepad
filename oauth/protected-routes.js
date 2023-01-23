var express = require("express"),
  jwt = require("express-jwt"),
  config = require("./config"),
  fs = require("fs");

var app = (module.exports = express.Router());

// Validate access_token
var jwtCheck = jwt({
  secret: config.secret,
  audience: config.audience,
  issuer: config.issuer,
});

// Check for scope
function requireScope(scope) {
  return function (req, res, next) {
    var has_scopes = req.user.scope === scope;
    if (!has_scopes) {
      res.sendStatus(401);
      return;
    }
    next();
  };
}

app.use("/api/protected", jwtCheck, requireScope("full_access"));

app.post("/api/protected/push-to-server", function (req, res) {
  try {
    const data = JSON.parse(req.body.data.replace(/%2B/g, "+"));

    fs.writeFileSync(
      __dirname + "/db/" + req.user.username + ".json",
      JSON.stringify(data)
    );

    res.status(200).send({ success: true });
  } catch (error) {
    res.status(200).send({ success: false, error });
  }
});

app.get("/api/protected/get-server-data", function (req, res) {
  try {
    let data = [];
    try {
      data = fs.readFileSync(
        __dirname + "/db/" + req.user.username + ".json",
        "utf8"
      );
    } catch (error) {}

    res.status(200).send({ success: true, data: JSON.parse(data) });
  } catch (error) {
    res.status(200).send({ success: false, error });
  }
});
