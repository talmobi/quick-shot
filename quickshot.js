var http = require('http');
var Url = require('url');
var webshot = require('webshot');

var opts = {
  method: 'HEAD',
  host: "bittysound.jin.fi",
  path: "/"
}

var webshot_settings = {
  screenSize: {
    width: 192,
    height: 108
  },
  zoomFactor: .25,
  quality: 75,
  timeout: 60000,
  settings: {
    javascriptEnabled: false
  }
}

var cache = {};
var limit = 100;

String.prototype.startsWith = function (str) {
  return this.indexOf(str) === 0;
}

function handleError (cash, err) {
  if (!cash)
    return;
  if (cash.listeners instanceof Array)
    cash.listeners.map(function (val, ind, arr) {
      val(err);
    });
  cache[cash.hostpath] = null;
}

function get (url, callback) {

  if (!url.startsWith('http') && !url.startsWith('//')) {
    url = '//' + url;
  }

  var url = Url.parse(url, true, true);

  var opts = {
    method: 'HEAD',
    host: url.host,
    path: url.path
  }

  var hostpath = (url.host + (url.path || "/"));

  var cash = cache[hostpath];
  if (cash && cash.data) { // url is cached
    console.log("responding from cache to: " + hostpath);
    return callback(null, cash.data);
  } else { // url not cached
    if (cash) {
      // add listeners
      console.log("adding a pending listener to: " + hostpath);
      return cash.listeners.push(callback);
    } else {
      cache[hostpath] = {
        hostpath: hostpath,
        url: url,
        data: null,
        listeners: [callback]
      };
      var cash = cache[hostpath];

      // run webshot
      console.log("Webshooting: " + hostpath);

      var settings = webshot_settings;

      return webshot(hostpath, settings, function (err, renderStream) {
        if (err) {
          // kill the litener callbacks and reset the cache
          handleError(err, cash);
        } else {
          var buffer = "";

          // gather the data
          renderStream.on('data', function (data) {
            buffer += data.toString('binary');
          });

          // responde to all pending callbacks and update the cache with data
          renderStream.on('end', function () {
            if (!cash) {
              return console.log("error on finished webshot - no cash");
            }
            console.log(
                "responding on finished webshot to: %s for %s listeners",
                cash.hostpath, cash.listeners.length
                );
            if (cash.listeners instanceof Array)
              cash.listeners.map(function (val, ind, arr) {
                if (typeof(val) == "function")
                  val(null, buffer);
              });
            cash.data = buffer;
            cash.listeners = 0;
          });

          // kill the pending callbacks and reset the cache
          renderStream.on('error', function (err) {
            return handleError(err, cash);
          });
        }
      });
    }

  }

  console.log("http req for host: " + opts.host + ", path: " + opts.path);

  var req = http.request(opts, function (res) {
    console.log("STATUS: " + res.statusCode);
    console.log("HEADERS: " + JSON.stringify(res.headers));
    res.setEncoding('utf8');
    var data = "";
    res.on('data', function (chunk) {
      console.log("BODY: " + chunk);
      data += chunk;
    });
    res.on('end', function () {
      callback(null, data);
    });
  });

  req.on('error', function (err) {
    console.log("problem with request: " + err.message);
    callback(err);
  });

  req.end();
}

function takeShot (url, callback, opts) {
  webshot(url, callback, opts || webshot_settings);
}

module.exports = {
  get: get
}
