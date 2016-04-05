var Station = require('triplet-core/trip-models/station');
var GeoPoint = require('triplet-core/trip-models/geopoint');
var Trip = require('triplet-core/trip-models/trip');
var Leg = require('triplet-core/trip-models/leg');
var LegStop = require('triplet-core/trip-models/leg-stop');
var Carrier = require('triplet-core/trip-models/carrier');
var Line = require('triplet-core/trip-models/line');
var Location = require('triplet-core/trip-models/location');
var Utils = require('triplet-core/util/client-util.js');
var forceArray = Utils.forceArray;
var parseDate = Utils.parseLocalDate;
var LocalTime = require('triplet-core/local-time.js');

var types = Carrier.Types;
var vtTypes = {
  'TRAM': types.tram,
  'BUS': types.bus,
  'WALK': types.walk,
  'VAS': types.commuterTrain,
  'REG': types.train,
  'LDT': types.train,
  'BOAT': types.boat,
  'TAXI': types.taxi,
};

exports.stationsError = function stationsError(json) {
  return json.LocationList.error || null;
};

exports.nearbyStationsError = exports.stationsError;

exports.stations = function stations(json) {
  var data = json.LocationList;

  if (!data) { return []; }

  return forceArray(data.StopLocation)
    .concat(forceArray(data.CoordLocation))
    .sort(function(a, b) { return a.idx - b.idx; })
    .map(station);
};

exports.nearbyStations = function nearbyStations(json) {
  var data = json.LocationList;

  if (!data) { return []; }

  // Since response contains all stop points (i.e. each place within a station
  // where a vehicle stops), we need to filter thos away.

  return forceArray(data.StopLocation)
    .map(function(s) { return s.track ? null : station(s); })
    .filter(function(s) { return s !== null; });
};

exports.tripsError = function tripsError(json) {
  return json.TripList.error || null;
};

exports.trips = function(json) {
  var data = json.TripList;
  return (!data) ? [] : forceArray(data.Trip).map(trip).map(walkFix);
};

function station(json) {
  if (json.stopid) {
    // Departure station format
    return new Station({
      id: json.stopid,
      name: json.stop,
      clientId: 'VT'
    });
  }

  if (json.id) {
    // Station suggestion format
    var c = json.name.split(', ');
    return new Station({
      id: json.id,
      name: c[0],
      area: c[1],
      location: (json.lat && json.lon) ? new Location({
        latitude: json.lat,
        longitude: json.lon
      }) : undefined,
      clientId: 'VT'
    });
  }

  // GeoPoint
  return location(json);
}

function location(json) {
  return new GeoPoint({
    name: Utils.fixEncodingIssues(json.name),
    location: new Location({
      latitude: json.lat,
      longitude: json.lon
    })
  });
}

function trip(json) {
  return new Trip({
    legs: forceArray(json.Leg).map(leg).filter(function (i) { return i; })
  });
}

function leg(json) {
  if (json.type === 'WALK' && json.Origin.name === json.Destination.name) {
    return null;
  }

  return new Leg({
    from: legStop(json.Origin),
    to: legStop(json.Destination),
    carrier: carrier(json),
    messages: messages(json)
  });
}

function legStop(json) {
  return new LegStop({
    point: station(json),
    track: json.track,
    plannedDate: date(json),
    realTimeDate: realtimeDate(json),
    messages: messages(json)
  });
}

function carrier(json) {
  return new Carrier({
    name: json.name,
    heading: json.direction,
    type: carrierType(json.type),
    line: line(json),
    cancelled: (json.cancelled === true),
    flags: {
      details: json.JourneyDetailRef,
      accessibility: (json.accessibility === 'wheelChair')
    }
  });
}

function carrierType(type) {
  return vtTypes[type] || types.unknown;
}

function date(json) {
  return parseDate(json.date, json.time);
}

function realtimeDate(json) {
  return parseDate(json.rtDate, json.rtTime);
}

function line(json) {
  return new Line({
    name: json.sname,
    colorFg: json.bgColor,
    colorBg: json.fgColor
  });
}

function messages(json) {
  // Some objects contain duplicate messages with different priorites, so we
  // need to reduce them.
  if (json.Notes && json.Notes.Note) {
    return forceArray(json.Notes.Note).map(message).reduce(function(p, c) {
      if (p.indexOf(c) < 0) {
        p.push(c);
      }

      return p;
    }, []);
  }

  return [];
}

function message(json) {
  return json.$;
}

// This moves a single walk leg to current departure time.
// Fix is needed since walk legs are always scheduled to input time, which
// is set to now - 5 min when searching.

function walkFix(trip) {
  if (trip && trip.legs && trip.legs.length === 1) {
    var walkLeg  = trip.legs[0];
    var departureDate = walkLeg.from.date;
    var carrier = walkLeg.carrier;
    var now = LocalTime.get();

    if (carrier.type === Carrier.Types.walk && departureDate < now) {
      var duration = walkLeg.to.date - departureDate;
      walkLeg.from.plannedDate = new Date(now.getTime());
      walkLeg.to.plannedDate = new Date(now.getTime() + duration);
    }
  }

  return trip;
}
