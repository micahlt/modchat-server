// bcrypt is good for our needs as the Scratch password limit is not long enough for it to matter

const express = require("express")
const router = express.Router()

const User = require("../../models/user.js")

const crypto = require("crypto")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const privateKey = Buffer.from(process.env.PRIVATE_KEY, "base64").toString(
  "ascii"
)

// Updating passwords
router.post("/api/updatepassword", async (req, res) => {
  if (req.body.username && req.body.password) {
    const newPwd = await bcrypt.hash(req.body.password, 10)
    const username = req.body.username
    const user = await User.findOne({ username })
    if ("password" in user) res.sendStatus(400)
    await User.updateOne(
      {
        username,
      },
      {
        $set: {
          password: newPwd,
        },
      }
    )
    res.sendStatus(200)
  } else {
    console.warn("❌ Request did not include a body")
    res.sendStatus(403)
  }
})

// Logging in the user
router.post("/api/login", async (req, res) => {
  if (req.body.username && req.body.password) {
    const { username, password } = req.body
    const user = await User.findOne({
      username,
    }).lean()
    if (!user) {
      console.warn("❌ Username or password incorrect")
      res.status(400).send({ reason: "notSignedUp" })
      return
    }
    if (user.banned) {
      if (user.banned == true) {
        if (Date.now() > user.ban_expiry) {
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
        } else {
          return
        }
      }
    }
    let secret = crypto.randomBytes(65).toString("base64")
    if (!user.secret) {
      await User.updateOne(
        {
          username,
        },
        {
          $set: {
            secret: secret,
          },
        }
      )
    } else {
      secret = user.secret
    }

    if (await bcrypt.compare(password, user.password)) {
      console.log(`✅ Correct username and password`)
      const access_token = crypto.randomBytes(65).toString("base64")
      const refresh_token = crypto.randomBytes(65).toString("base64")
      await User.updateOne(
        {
          username,
        },
        {
          $push: {
            tokens: {
              access_token: access_token,
              refresh_token: refresh_token,
              access_expiry: Date.now() + 8300000,
              refresh_expiry: Date.now() + 8640000000,
            },
          },
        },
        { upsert: true, setDefaultsOnInsert: true }
      )

      res.cookie(
        "refresh_token",
        jwt.sign(
          { username: username, id: refresh_token, secret: secret },
          privateKey,
          { algorithm: "PS256", expiresIn: "100d" }
        ),
        {
          secure: true,
          httpOnly: true,
          maxAge: 60 * 60 * 24 * 100 * 1000,
          sameSite: "strict",
          site: "micahlindley.com"
        }
      )
      res.status(200).send({ access_token })
    } else {
      res.status(400).send({ reason: "wrongPassword" })
    }
  } else {
    console.warn("🔐 Missing username, password, or both")
    res.status(400).send({ reason: "missingData" })
  }
})

module.exports = router
