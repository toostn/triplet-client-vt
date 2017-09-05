module.exports = vtOAuth

function vtOAuth (apiKey, uniqueId, http, PromiseLib) {
  var _token = null
  var _fetchingToken = false
  var _requestQueue = []

  function authorize (request) {
    return new PromiseLib(function (resolve, reject) {
      if (hasValidToken()) {
        resolve(addTokenHeader(request))
      } else {
        _requestQueue.push({
          resolve: function () { resolve(addTokenHeader(request)) },
          reject: function (response) { reject(response) }
        })

        if (_fetchingToken) return

        _fetchingToken = true

        fetchToken()
          .then(function () {
            _fetchingToken = false
            _requestQueue.forEach(function (req) { req.resolve() })
            _requestQueue = []
          })
          .catch(function (response) {
            _fetchingToken = false
            _requestQueue.forEach(function (req) { req.reject(response) })
            _requestQueue = []
          })
      }
    })
  }

  function resetToken () {
    _token = null
  }

  function hasValidToken () {
    return _token !== null && _token.expires_at > Date.now() + 10000
  }

  function fetchToken () {
    return http({
      method: 'POST',
      url: 'https://api.vasttrafik.se/token',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + apiKey
      },
      data: 'grant_type=client_credentials&scope=' + uniqueId
    })
    .then(function (response) {
      var token = Object.assign({}, response.data)
      token.expires_at = Date.now() + (token.expires_in * 1000)
      _token = token
    })
  }

  function addTokenHeader (request) {
    return Object.assign(
      {},
      request,
      {
        headers: Object.assign(
          {Authorization: 'Bearer ' + _token.access_token},
          request.headers
        )
      }
    )
  }

  return {
    authorize: authorize,
    resetToken: resetToken
  }
}
