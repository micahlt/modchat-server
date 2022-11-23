const express = require("express")
const router = express.Router()

const verifyAccessToken = require("../../middleware/verifyAccessToken.js")

const verifyRoles = require("../../middleware/verifyRoles.js")

const User = require("../../models/user.js")

router.post(
  "/api/session/revoke",
  verifyAccessToken,
  verifyRoles("moderator"),
  async (req, res) => {
    const username = req.body.username
    if (username && String(username)) {
      const user = req.user
      const revokeUser = await User.findOne({
        username: username,
      })
      if (revokeUser && user) {
        if (user.banned !== true) {
          revokeUser.tokens = []
          revokeUser.save()
          res.sendStatus(200)
        }
      } else {
        res.sendStatus(401)
      }
    } else {
      res.sendStatus(400)
    }
  }
)

router.post(
  "/api/session/mute",
  verifyAccessToken,
  verifyRoles("moderator"),
  async (req, res) => {
    const username = req.body.username
    const timestamp = req.body.timeStamp
    if (username && timestamp && String(username) && Number(timestamp)) {
      const user = req.user
      if (user) {
        if (user.banned !== true) {
          await User.updateOne(
            {
              username,
            },
            {
              $set: {
                mutedFor: new Date(Date.now() + timestamp),
              },
            }
          )
          res.sendStatus(200)
        }
      } else {
        res.sendStatus(401)
      }
    } else {
      res.sendStatus(400)
    }
  }
)

module.exports = router
