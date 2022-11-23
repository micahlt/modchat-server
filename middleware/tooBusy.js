const toobusy = require("toobusy-js")

function tooBusy(req, res, next) {
  if (toobusy()) {
    res.status(503).send("Modchat is very busy right now, sorry.")
  } else {
    next()
  }
}

module.exports = tooBusy
