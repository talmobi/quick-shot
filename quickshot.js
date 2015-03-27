var http = require('http');
var Url = require('url');
var webshot = require('webshot');

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
var cacheList = [];
var cacheLimit = 100;
var listenersLimit = 300;
var cacheTimeoutInterval = 10000; // 10 seconds

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

  var hostpath = (url.host + (url.path || "/"));

  var cash = cache[hostpath];
  if (cash && cash.data) { // url is cached
    console.log("responding from cache to: " + hostpath);
    return callback(null, cash.data);
  } else { // url not cached
    if (cash) {
      // add listeners
      if (cash.listeners.length > listenersLimit) {
        // dont add over listener capacity
        return console.log("listener limit reached from: " + hostpath);
      }
      console.log("adding a pending listener to: " + hostpath);
      return cash.listeners.push(callback);
    } else {
      var cash = cache[hostpath] = {
        hostpath: hostpath,
        url: url,
        data: null,
        listeners: [callback]
      };

      // run webshot
      console.log("Webshooting: " + hostpath);
      var settings = webshot_settings;
      cacheList.push(cash);
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
            cash.listeners.length = 0;
          });

          // kill the pending callbacks and reset the cache
          renderStream.on('error', function (err) {
            return handleError(err, cash);
          });
        }
      });
    }
  }
}

// clean cache every 10 seconds
var cacheTimeout = null;
function cleanCache () {
  if (cacheTimeout) {
    clearTimeout(cacheTimeout);
    cacheTimeout = null;
  }

  // clean cache
  if (cacheList.length > cacheLimit) {
    var removeList = cacheList.slice(cacheLimit);
    for (var i = 0; i < removeList.length; i++) {
      var cash = removeList[i];
      if (!cash) continue;
      if (cash.listeners instanceof Array)
        cash.listeners.map(function (val, ind, arr) {
          if (typeof(val) == "function")
            val("Over capacity");
        });
      cache[cash.hostpath] = null;
    }
    console.log("%s items removed from cache", removeList.length);
    cacheList.length = cacheLimit;
  }

  console.log("cacheTimeout rewinded. cache size: [%s/%s]",
              cacheList.length, cacheLimit);
  cacheTimeout = setTimeout(cleanCache, cacheTimeoutInterval);
}
cleanCache();

module.exports = {
  get: get
}
