const express = require("express")
const router = express.Router()

// Check if user is mod
router.get("/api/session/isMod/:username", (req, res) => {
  const username = req.params.username
  if (username && String(username)) {
    User.find({
      username: username,
    }).then((rm) => {
      if (JSON.stringify(rm) == "[]") {
        res.sendStatus(400)
      } else {
        let isMod = false
        if (rm[0].role && rm[0].role == "moderator") {
          isMod = true
        }
        res.status(200).send(isMod)
      }
    })
  } else {
    res.sendStatus(400)
  }
})

// not sure if used right now

module.exports = router
