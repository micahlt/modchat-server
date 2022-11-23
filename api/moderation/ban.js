const express = require("express")
const router = express.Router()

const verifyAccessToken = require("../../middleware/verifyAccessToken.js")

const verifyRoles = require("../../middleware/verifyRoles.js")

const User = require("../../models/user.js")

// Check if a user is banned or muted
router.get("/api/bannedMuted", (req, res) => {
  User.find({
    $or: [{ banned: true }, { mutedFor: { $gte: Date.now() } }],
  }).then((msg) => {
    res.send(msg)
  })
})

// Check if a user is banned and why
router.get("/api/session/isBanned/:username", (req, res) => {
  const username = req.params.username
  if (username && String(username)) {
    User.find({
      username: username,
    }).then((rm) => {
      if (JSON.stringify(rm) == "[]") {
        res.sendStatus(400)
      } else {
        res.status(200).send({
          banned: rm[0].banned,
          expiry: rm[0].ban_expiry,
          reason: rm[0].ban_reason,
        })
      }
    })
  } else {
    res.sendStatus(400)
  }
})

router.post(
  "/api/session/ban",
  verifyAccessToken,
  verifyRoles("moderator"),
  async (req, res) => {
    const username = req.body.username
    const reason = req.body.reason
    const timestamp = req.body.timestamp
    if (
      username &&
      reason &&
      timestamp &&
      String(username) &&
      String(reason) &&
      Number(timestamp)
    ) {
      const user = req.user
      if (user) {
        if (user.banned !== true) {
          await User.updateOne(
            {
              username,
            },
            {
              $set: {
                banned: true,
                ban_reason: reason,
                ban_expiry: timestamp,
              },
            }
          )
          res.sendStatus(200)
        } else {
          res.sendStatus(401)
        }
      } else {
        res.sendStatus(400)
      }
    } else {
      res.sendStatus(400)
    }
  }
)

router.post(
  "/api/session/unban",
  verifyAccessToken,
  verifyRoles("moderator"),
  async (req, res) => {
    const username = req.body.username
    if (username && String(username)) {
      const user = req.user
      if (user) {
        if (user.banned !== true) {
          await User.updateOne(
            {
              username,
            },
            {
              $set: {
                banned: false,
              },
            }
          )
          res.sendStatus(200)
        } else {
          res.sendStatus(401)
        }
      } else {
        res.sendStatus(400)
      }
    } else {
      res.sendStatus(400)
    }
  }
)

module.exports = router
