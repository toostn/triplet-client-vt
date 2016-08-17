var Client = require('triplet-core/client.js')
var parsers = require('./parsers.js')
var urlParams = require('./url-params')

var BASE_URL = 'https://api.vasttrafik.se/bin/rest.exe/v1'

function vtUrl (endpoint) {
  return BASE_URL + endpoint
}

module.exports = function (apiKey, http) {
  return new Client(http, {
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
}
