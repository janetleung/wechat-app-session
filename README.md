# wechat-app-session

[![NPM Version][npm-image]][npm-url]

由于微信小程序没有 cookie 的概念，一般的 session 库并不适用。wechat-app-session 通过校验请求 header 特定字段的方式， 以 express-session 为基础修改成适用于微信小程序场景的 session middleware。

## install
```sh
$ npm install wechat-app-session
# or
$ yarn add wechat-app-session
```

## Example

```js
var express = require('express')
var session = require('wechat-app-session')

app.use(session({
  serect: 'this is a serect',
}))

app.use(function (req, res, next) {
  if (!req.session.views) {
    req.session.views = {}
  }

  // get the url pathname
  var pathname = parseurl(req).pathname

  // count the views
  req.session.views[pathname] = (req.session.views[pathname] || 0) + 1

  next()
})

app.get('/foo', function (req, res, next) {
  res.send('you viewed this page ' + req.session.views['/foo'] + ' times')
})

app.get('/bar', function (req, res, next) {
  res.send('you viewed this page ' + req.session.views['/bar'] + ' times')
})

```

小程序不能利用 cookie 自动存储 session，因此需要小程序端增加本地存储以及发送 session 的处理。简单例子如下：

```js
// 发送 session
var session = wx.getStorageSync(LOCALSTORAGE_SESSION_KEY)
var header = {}
if (!!session) {
  header[SESSION_KEY] = session // SESSION_KEY 即为设置的 key
}
wx.request({
  header,
  url: '/product',
  success: function() {},
})

//本地存储 session
wx.request({
  url: '/login',
  success: function(res) {
    wx.setStorageSync(LOCALSTORAGE_SESSION_KEY, res.header[SESSION_KEY])
  }
})
```

## API

### session(options)

#### Options
暂时只支持设置以下四个配置项：

**serect**

对 session key 进行签名的 serect，必填项。

**key**

选填项，默认值为 `wx_app_session.id`。为请求头部添加的特定 header 字段。要求从微信小程序端发出的请求必须携带此字段，若无则会新生成 session key。

> **info**
> 需与小程序端代码配合使用，请求头部需携带服务器返回的 session。

**store**

存储 session 的 store，若不传则默认值使用内存来进行 session 存储。开发环境下允许不设置 store，生产环境不允许。

支持的 store 与 express-session 一致，详情请参考：[express-session][express-session-url]

**maxAge**

session 有效期限，选填项。默认为： `24 * 3600 * 1000`。

[npm-image]: https://img.shields.io/npm/v/wechat-app-session.svg
[npm-url]: https://www.npmjs.com/package/wechat-app-session
[express-session-url]: https://github.com/expressjs/session/blob/master/README.md#compatible-session-stores
