var Url = require( 'url' )
var webshot = require( 'webshot' )

var Jimp = require( 'jimp' )

var webshotSettings = { // eslint-disable-line
  screenSize: {
    width: 1080,
    height: Math.floor( 1080 * 9 / 16 )
  },
  quality: 75,
  timeout: 60000,
  settings: {
    javascriptEnabled: false
  }
}

var cache = {}
var cacheList = []
var cacheLimit = 100
var listenersLimit = 300
var cacheTimeoutInterval = 10000 // 10 seconds

String.prototype.startsWith = function ( str ) { // eslint-disable-line
  return this.indexOf( str ) === 0
}

function handleError ( cash, err ) {
  if ( !cash )
  { return }
  if ( cash.listeners instanceof Array )
  { cash.listeners.map( function ( val, ind, arr ) {
    val( err )
  } ) }
  cache[ cash.hostpath ] = null
}

function get ( url, callback ) {
  if ( !url.startsWith( 'http' ) && !url.startsWith( '//' ) ) {
    url = '//' + url
  }

  url = Url.parse( url, true, true )

  var hostpath = ( url.host + ( url.path || '/' ) )

  var cash = cache[ hostpath ]

  // if ( cache ) cache.data = null // TODO remove this line

  if ( cash && cash.data ) { // url is cached
    console.log( 'responding from cache to: ' + hostpath )
    return callback( null, cash.data )
  } else { // url not cached
    if ( cash ) {
      // add listeners
      if ( cash.listeners.length > listenersLimit ) {
        // dont add over listener capacity
        return console.log( 'listener limit reached from: ' + hostpath )
      }
      console.log( 'adding a pending listener to: ' + hostpath )
      return cash.listeners.push( callback )
    } else {
      cash = cache[ hostpath ] = {
        hostpath: hostpath,
        url: url,
        data: null,
        listeners: [ callback ]
      }

      // run webshot
      console.log( 'Webshooting: ' + hostpath )

      cacheList.push( cash )
      return webshot( hostpath, webshotSettings, function ( err, renderStream ) {
        if ( err ) {
          // kill the litener callbacks and reset the cache
          handleError( err, cash )
        } else {
          var buffer = ''

          // gather the data
          renderStream.on( 'data', function ( data ) {
            buffer += data.toString( 'binary' )
          } )

          // respond to all pending callbacks and update the cache with data
          renderStream.on( 'end', function () {
            console.log( 'jimp read' )
            Jimp.read( Buffer.from( buffer, 'binary' ) )
            .then( function ( image ) {
              console.log( 'jimp then' )

              if ( !cash ) {
                return console.log( 'error on finished webshot - no cash' )
              }

              console.log(
                'responding on finished webshot to: %s for %s listeners',
                cash.hostpath, cash.listeners.length
              )

              image
              .cover( 192, 108, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_TOP )
              .getBuffer( Jimp.MIME_JPEG, function ( err, imageBuffer ) {
                if ( err ) {
                  return handleError( err, cash )
                }

                if ( cash.listeners instanceof Array ) {
                  cash.listeners.forEach( function ( val, ind, arr ) {
                    if ( typeof ( val ) === 'function' )
                    { val( null, imageBuffer ) }
                  } )
                }

                cash.data = imageBuffer
                cash.listeners.length = 0
              } )
            } )
            .catch( function ( err ) {
              console.log( 'jimp error' )

              handleError( err, cash )
            } )
          } )

          // kill the pending callbacks and reset the cache
          renderStream.on( 'error', function ( err ) {
            return handleError( err, cash )
          } )
        }
      } )
    }
  }
}

// clean cache every 10 seconds
var cacheTimeout = null
function cleanCache () {
  if ( cacheTimeout ) {
    clearTimeout( cacheTimeout )
    cacheTimeout = null
  }

  // clean cache
  if ( cacheList.length > cacheLimit ) {
    var removeList = cacheList.slice( cacheLimit )
    for ( var i = 0; i < removeList.length; i++ ) {
      var cash = removeList[ i ]
      if ( !cash ) continue
      if ( cash.listeners instanceof Array )
      { cash.listeners.map( function ( val, ind, arr ) {
        if ( typeof ( val ) === 'function' )
        { val( 'Over capacity' ) }
      } ) }
      cache[ cash.hostpath ] = null
    }
    console.log( '%s items removed from cache', removeList.length )
    cacheList.length = cacheLimit
  }

  console.log( 'cacheTimeout rewinded. cache size: [%s/%s]',
    cacheList.length, cacheLimit )
  cacheTimeout = setTimeout( cleanCache, cacheTimeoutInterval )
}
cleanCache()

module.exports = {
  get: get
}
