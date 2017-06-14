var LocalTime = require('triplet-core/local-time.js')
var dtString = require('triplet-core/util/client-util.js').dtString
var PAST_TRIP_SEARCH_TIME = 300000

exports.trips = function (query, config) {
  var params = {
    needJourneyDetail: 0,
    format: 'json'
  }

  var from = query.from
  var to = query.to

  if (from.id !== null && from.id !== undefined) {
    params.originId = from.id
  } else {
    params.originCoordName = from.name
    params.originCoordLat = from.location.latitude
    params.originCoordLong = from.location.longitude
  }

  if (to.id !== null && to.id !== undefined) {
    params.destId = to.id
  } else {
    params.destCoordName = to.name
    params.destCoordLat = to.location.latitude
    params.destCoordLong = to.location.longitude
  }

  var localDate = LocalTime.get()
  var date = query.date || new Date(localDate.getTime() - PAST_TRIP_SEARCH_TIME)

  params.date = [
    date.getFullYear(),
    dtString(date.getMonth() + 1),
    dtString(date.getDate())
  ].join('-')

  params.time = dtString(date.getHours()) + ':' + dtString(date.getMinutes())

  params.searchForArrival = 0

  if (query.quickMode) {
    params.walkSpeed = 120
    params.disregardDefaultChangeMargin = 1
    params.additionalChangeTime = 0
  }

  return params
}

exports.nearbyStations = function (query, config) {
  var params = { format: 'json' }
  var location = query.location

  if (location) {
    params.originCoordLat = location.latitude
    params.originCoordLong = location.longitude
  }

  params.maxDist = query.radius || 3000
  params.maxNo = query.resultMaxCount || 50

  return params
}

exports.stations = function (query, config) {
  var string = query.queryString.toLowerCase()
  string = string.replace('å', 'aa')
  string = string.replace('ä', 'ae')
  string = string.replace('ö', 'oe')

  return {
    format: 'json',
    input: string
  }
}
