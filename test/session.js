var express = require('express')
var request = require('supertest')
var signature = require('cookie-signature')
var uid = require('uid-safe').sync
var session = require('../index.js')
var expect = require('chai').expect

var defaultKey = 'wx_app_session.id'
var serect = 'test'
var cookie = {
  path: '/',
  _expires: '2018-05-06T12:28:08.589Z',
  get expires() {return this._expires},
  originalMaxAge: 86400000,
  httpOnly: true
}

var _c = function (noop, opts) {
  var options = noop || {}
  var app = express()

  if (typeof noop === 'function') {
    noop()
    options = opts
  }
  app.use(session(options))
  app.get('/', function(req, res) {
    res.end()
  })
  return app
}
var _n = function(noop, opts) {
  noop = noop || {}
  if (typeof noop === 'function') {
    opts.serect = serect
  } else {
    noop.serect = serect
  }
  return _c(noop, opts)
}

describe('session', function() {
  it('should export constructors', function(){
    expect(typeof session.Session === 'function').to.be.true
    expect(typeof session.Store === 'function').to.be.true
    expect(typeof session.MemoryStore === 'function').to.be.true
  })

  it('should error without secret', function(done) {
    expect(session.bind(session, {serect: undefined})).to.throw('serect is required')
    done()
  })

  it('should not use memory store in production environment', function(done) {
    process.env.NODE_ENV = 'production'
    expect(session.bind(session, {serect: 'test'})).to.throw('MemoryStore is not designed for a production environment')
    process.env.NODE_ENV = ''
    done()
  })

  it('#option key exits', function(done) {
    request(_n({key: 'test_key'}))
    .get('/')
    .expect(function(res) {
      if (!('test_key' in res.header)) throw new Error('set special key fail')
    })
    .end(done)
  })

  it('#option key not exits', function(done) {
    request(_n())
    .get('/')
    .expect(function(res) {
      if (!(defaultKey in res.header)) throw new Error('set default key fail')
    })
    .end(done)
  })

  it('#option maxAge exits', function(done) {
    var server = _n({maxAge: 1})
    request(server)
    .get('/')
    .expect(200, function(err , res) {
      if (err) done(err)
      var signature = res.header[defaultKey]

      request(server)
      .get('/')
      .set(defaultKey, signature)
      .expect(function(res) {
        if (res.header[defaultKey] === signature) throw new Error('set special maxAge fail')
      })
      .expect(200, done)
    })
  })

  it('#option store exits', function(done) {
    var store = new session.MemoryStore()
    var server = _n({store})

    request(server)
    .get('/')
    .expect(200, function(err, res) {
      if (err) done(err)
      var sessionKey = signature.unsign(res.header[defaultKey], serect)
      store.get(sessionKey, function(err, session) {
        if (err || !session) throw new Error('set special store fail')
      })
    }).expect(200, done)
  })

  it('should get session from store if default header exists', function(done){
    var store = new session.MemoryStore()
    var serect = 'test'
    var id = uid(24)
    var signatureStr = signature.sign(id, serect)
    store.set(id, {test: 'test', cookie}, function() {
      request(_n({store, serect}))
      .get('/')
      .set(defaultKey, signatureStr)
      .expect(function(res) {
        if (res.header[defaultKey] !== signatureStr) throw new Error('get default session error')
        store.get(id, function(err, session) {
          if (err || !session) throw new Error('get session fail')
          expect(session.test).to.be.deep.equal('test')
        })
      })
      .end(done)
    })
  })

  it('should get session from store if special header exists', function(done){
    var key = 'test_key'
    request(_n({key}))
    .get('/')
    .expect(function(res) {
      if (!res.header[key]) throw Error('get special session error')
    })
    .end(done)
  })

  it('shoud session maxAge work well', function(done) {
    this.timeout(10000)
    var store = new session.MemoryStore()
    var server = _n({maxAge: 5, store})
    request(server)
    .get('/')
    .expect(200, function(err , res) {
      if (err) done(err)
      var signature = res.header[defaultKey]

      request(server)
      .get('/')
      .set(defaultKey, signature)
      .expect(function(res) {
        if (res.header[defaultKey] !== signature) throw new Error('session expires prematurely')
      })

      setTimeout(
        function() {
          request(server)
          .get('/')
          .set(defaultKey, signature)
          .expect(200, function(err, res) {
            if (err) done(err)
            if (res.header[defaultKey] === signature) throw new Error('session not properly destroyed')
            done()
          })
        },
        5000
      )
    })
  })

  it('shoud store update while session changed', function(done) {
    var store = new session.MemoryStore()
    var server = _n({store})
    var sessionKey = null

    server.get('/session', function(req, res) {
      req.session.view = req.session.view ? req.session.view + 1 : 1
      sessionKey = req.sessionID
      res.end()
    })
    request(server)
    .get('/session')
    .expect(200, function(err, res) {
      if (err) done(err)
      var signatureStr = res.header[defaultKey]
      store.get(sessionKey, function(err, session) {
        if (err || !session) throw new Error('get session fail')
        if (session.view !== 1) throw new Error('session first update fail')

        request(server)
        .get('/session')
        .set(defaultKey, signatureStr)
        .expect(200, function(err, res) {
          if (err) done(err)
          store.get(sessionKey, function(err, session) {
            if (err || !session) throw new Error('get session fail')
            if (session.view !== 2) throw new Error('session second update fail')
            done()
          })
        })
      })
    })
  })

  it('shoud store destroy while session is null', function(done) {
    var store = new session.MemoryStore()
    var server = _n({store})
    var serect = 'test'
    var id = uid(24)
    var signatureStr = signature.sign(id, serect)

    server.get('/null', function(req, res) {
      req.session = null
      res.status(200).end()
    })

    store.set(id, {view: 1, cookie}, function(err) {
      if (err) done(err)
      request(server)
      .get('/null')
      .set(defaultKey, signatureStr)
      .expect(200, function(err, res) {
        if (err) done(err)
        request(server)
        .get('/null')
        .set(defaultKey, signatureStr)
        .expect(200, function(err, res) {
          if (err) done(err)
          if (res.header[defaultKey] === signatureStr) throw new Error('destroyed session fail')
          done()
        })
      })
    })
  })

  it('shoud session same while the server whicth created by the same store changed', function(done) {
    var store = new session.MemoryStore()
    var serect = 'test'
    var id = uid(24)
    var signatureStr = signature.sign(id, serect)

    store.set(id, {view: 1, cookie}, function(err) {
      if (err) done(err)
      request(_n({store}))
      .get('/')
      .set(defaultKey, signatureStr)
      .expect(200, function(err, res) {
        if (err) done(err)
        request(_n({store}))
        .get('/')
        .set(defaultKey, signatureStr)
        .expect(200, function(err, res) {
          if (err) done(err)
          if (res.header[defaultKey] !== signatureStr) throw new Error('session changed while server changed')
          done()
        })
      })
    })
  })
})
