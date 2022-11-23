const express = require("express")
const router = express.Router()

const User = require("../../models/user.js")

const jwt = require("jsonwebtoken")

const publicKey = Buffer.from(process.env.PUBLIC_KEY, "base64").toString(
  "ascii"
)

// Logs out user
router.post("/api/logout", async (req, res) => {
  if (req.body.username && req.cookies["refresh_token"]) {
    let jwtRefresh
    jwt.verify(
      req.cookies["refresh_token"],
      publicKey,
      function (err, decoded) {
        console.log(err)
        jwtRefresh = decoded
      }
    )
    if (jwtRefresh) {
      await User.updateOne(
        { username: req.body.username },
        {
          $pull: {
            tokens: {
              refresh_token: jwtRefresh.id,
            },
          },
        }
      )
    } else {
      console.warn("🔐 Missing token.")
    }
    res.sendStatus(200)
  } else {
    console.warn("🔐 Missing username or token.")
    res.sendStatus(400)
  }
})

module.exports = router
