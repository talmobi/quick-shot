var quickshot = require( './quickshot.js' )
var express = require( 'express' )
var Url = require( 'url' )

// configure express
var app = express()

// query string
app.get( '/', function ( req, res ) {
  var url = Url.parse( req.url, true, true )
  var href = url.query.url
  // parse urls inside quotes
  if ( href[ 0 ] === '"' && href[ href.length - 1 ] === '"' ) {
    href = href.substring( 1, href.length - 1 )
  }
  console.log( 'href: ' + href )
  if ( href && typeof href === 'string' ) {
    quickshot.get( href, function ( err, data ) {
      if ( err ) {
        return res.send( 'error: ' + err.message || err )
      }
      return res.end( data, 'binary' )
    } )
  } else {
    res.status( 404 ).json( { message: "invalid or null 'url' in querystring" } ).end()
  }
} )

var port = process.env.PORT || 30999
var server = app.listen( port, function () {
  var h = server.address().address
  var p = server.address().port
  console.log( 'QuickShot Server running at http://%s:%s', h, p )
} )
