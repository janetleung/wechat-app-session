var expressSession = require('express-session')
var url = require('url')
var uid = require('uid-safe').sync
var signature = require('cookie-signature')

function session(opts) {
  var store = opts.store || new expressSession.MemoryStore()
  var maxAge = opts.maxAge || 24 * 3600 * 1000
  var serect = opts.serect // required
  var key = opts.key || 'wx_app_session.id'

  if (!serect) {
    throw new TypeError('serect is required')
  }

  if (process.env.NODE_ENV === 'production' && store instanceof expressSession.MemoryStore) {
    throw new TypeError('MemoryStore is not designed for a production environment')
  }

  store.generate = function(req) {
    req.sessionID = uid(24)
    req.session = new expressSession.Session(req)
    req.session.cookie = new expressSession.Cookie({maxAge})
  }

  var storeReady = true
  store.on('disconnect', function ondisconnect() {
    storeReady = false
  })
  store.on('connect', function onconnect() {
    storeReady = true
  })

  return function (req, res, next) {
    if (!storeReady) {
      next()
      return
    }

    let signedSession = req.get(key) ? req.get(key) : ''
    var unSigned = signature.unsign(signedSession, serect)
    req.sessionID = unSigned ? unSigned : ''

    req.sessionStore = store
    var _end = res.end
    var ended = false
    var originSessionID

    res.end = function end(chunk, encoding) {
      if (ended) {
        return false
      }
      ended = true
      if (req.session === null) {
        store.destroy(req.sessionID, function(err) {
          if (!err) {
            _end.call(res, chunk, encoding)

          }
        })
      } else if (req.sessionID && originSessionID === req.sessionID) {
        req.session.save(function(err) {
          if (!err) {
            _end.call(res, chunk, encoding)
          }
        })
      } else {
        _end.call(res, chunk, encoding)
      }
    }

    var setHeader = function() {
      var signed = signature.sign(req.sessionID, serect)
      res.set(key, signed)
    }

    var generate = function() {
      store.generate(req)
      setHeader()
      originSessionID = req.sessionID
    }

    if (!req.sessionID) {
      generate()
      next()
      return
    }

    store.get(req.sessionID, function(err, sess) {
      if (err) {
        generate()
        next()
        return
      } else if (sess) {
        store.createSession(req, sess)
        setHeader()
        originalId = req.sessionID
      } else {
        generate()
      }

      next()
    })
  }
}

exports = module.exports = session
exports.Store = expressSession.Store
exports.Cookie = expressSession.Cookie
exports.Session = expressSession.Session
exports.MemoryStore = expressSession.MemoryStore
