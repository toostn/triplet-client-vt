var Client = require('triplet-core/client.js')
var parsers = require('./parsers.js')
var urlParams = require('./url-params')

var BASE_URL = 'https://api.vasttrafik.se/bin/rest.exe/v2'

function vtUrl (endpoint) {
  return BASE_URL + endpoint
}

function serverErrorText (res) {
  return (res.status === -1) ? 'No internet connection' : res.statusText
}

module.exports = function (apiKey, uniqueId, http) {
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

  // Patches to work with async oAuth2 API
  vtClient._token = null
  vtClient._uniqueId = uniqueId

  vtClient._request = function (endpoint, query) {
    return (this._hasValidToken())
      ? this._fetchResponse(endpoint, query)
      : this._fetchToken()
          .then(function () { return vtClient._fetchResponse(endpoint, query) })
  }

  vtClient._hasValidToken = function () {
    return this._token !== null && this._token.expires_at > Date.now() + 10000
  }

  vtClient._fetchToken = function () {
    return this.http({
      method: 'POST',
      url: 'https://api.vasttrafik.se/token',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + this.config.apiKey
      },
      data: 'grant_type=client_credentials&scope=' + this._uniqueId
    })
    .then(function (response) {
      var token = Object.assign({}, response.data)
      token.expires_at = Date.now() + (token.expires_in * 1000)
      vtClient._token = token
    })
  }

  vtClient._fetchResponse = function (endpoint, query) {
    var config = this.config

    return this.http({
      method: 'GET',
      url: config[endpoint],
      params: config.params[endpoint](query, config),
      headers: {
        Authorization: 'Bearer ' + this._token.access_token
      }
    })
    .then(
      function (res) {
        var errorParser = config.parsers[endpoint + 'Error']
        query.error = errorParser ? errorParser(res.data) : null
        query.results = query.error ? null : config.parsers[endpoint](res.data, query)
        return query
      },
      function (res) {
        if (res && res.status === 401) {
          vtClient._token = null
          return vtClient._request(endpoint, query)
        }

        query.error = serverErrorText(res)

        return query
      })
  }

  return vtClient
}
