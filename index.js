var quickshot = require('./quickshot.js');
var express = require('express');
var Url = require('url');

// configure express
var app = express();

// query string
app.get('/', function (req, res) {
  var url = Url.parse(req.url, true, true);
  var href = url.query.url;
  if (href) {
    quickshot.get(href, function (err, data) {
      if (err) {
        return res.send("error: " + err.message || err);
      }
      return res.end(data, 'binary');
    });
  } else {
    res.status(404).json({message: "invalid or null 'url' in querystring"}).end();
  }
});

// works for hosts only (no slashes)
// ex: dev.jin.fi
app.get('/ss/:url', function (req, res) {
  var url = req.params.url;

  quickshot.get(url, function (err, data) {
    if (err) {
      return res.send("error: " + err.message || err);
    }
    return res.end(data, 'binary');
  });
});

var port = process.env.PORT || 3099;
var server = app.listen(port, function () {
  var h = server.address().address;
  var p = server.address().port;
  console.log("QuickShot Server running at http://%s:%s", h, p);
});
