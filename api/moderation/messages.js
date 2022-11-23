const express = require("express")
const router = express.Router()

const verifyAccessToken = require("../../middleware/verifyAccessToken.js")

const verifyRoles = require("../../middleware/verifyRoles.js")

// Reporting a message
router.post("/api/messages/report", verifyAccessToken, async (req, res) => {
  const room = req.body.room
  const id = req.body.id
  const type = req.body.type
  if ((room && id && type == true) || type == false) {
    if (String(room) && Number(id)) {
      const user = req.user
      if (user) {
        if (user.banned !== true) {
          if (type === false) verifyRoles("moderator")
          await Message.update(
            {
              room: room,
              id: id,
            },
            {
              reported: type,
            }
          )
          res.sendStatus(200)
        } else {
          res.sendStatus(401)
        }
      } else {
        res.sendStatus(401)
      }
    } else {
      res.sendStatus(400)
    }
  } else {
    res.sendStatus(400)
  }
})

// Deleting a message by room and ID
router.post(
  "/api/messages/delete/",
  verifyAccessToken,
  verifyRoles("moderator"),
  async (req, res) => {
    const room = req.body.room
    const id = req.body.id
    if (room && id) {
      if (String(room) && Number(id)) {
        const user = req.user
        if (user) {
          if (user.banned !== true) {
            await Message.deleteOne({
              room: room,
              id: id,
            })
            res.sendStatus(200)
          }
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

// Find if a message is reported by ID
router.post(
  "/api/reported",
  verifyAccessToken,
  verifyRoles("moderator"),
  (req, res) => {
    Message.find({
      reported: true,
    })
      .sort({ id: "desc" })
      .then((msg) => {
        res.send(msg)
      })
  }
)

module.exports = router
