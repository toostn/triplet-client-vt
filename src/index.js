var Client = require('triplet-core/client.js')
var vtOAuth = require('./oauth.js')
var parsers = require('./parsers.js')
var urlParams = require('./url-params')

var BASE_URL = 'https://api.vasttrafik.se/bin/rest.exe/v2'

function vtUrl (endpoint) {
  return BASE_URL + endpoint
}

function serverErrorText (res) {
  return (res.status === -1) ? 'No internet connection' : res.statusText
}

module.exports = function (apiKey, uniqueId, http, PromiseLib) {
  var vtClient = new Client(http, {
    apiKey: apiKey,
    shortName: 'vt',
    fullName: 'Västtrafik AB',
    params: urlParams,
    parsers: parsers,
    stations: vtUrl('/location.name'),
    trips: vtUrl('/trip'),
    nearbyStations: vtUrl('/location.nearbystops'),
    geojson: require('./area.json'),
    supports: {
      realtime: true,
      coordinateSearch: true,
      quickMode: true
    }
  })

  var oAuth = vtOAuth(apiKey, uniqueId, http, PromiseLib)

  // Patches to work with async oAuth2 API

  vtClient._request = function (endpoint, query) {
    var config = this.config
    var request = {
      method: 'GET',
      url: config[endpoint],
      params: config.params[endpoint](query, config)
    }

    return oAuth.authorize(request)
      .then(function (authorizedRequest) {
        return http(authorizedRequest)
      })
      .then(function (res) {
        var errorParser = config.parsers[endpoint + 'Error']
        query.error = errorParser ? errorParser(res.data) : null
        query.results = query.error ? null : config.parsers[endpoint](res.data, query)
        return query
      })
      .catch(function (res) {
        if (res && res.status === 401) {
          oAuth.resetToken()
          return vtClient._request(endpoint, query)
        }

        query.error = serverErrorText(res)

        return query
      })
  }

  return vtClient
}
