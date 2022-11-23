const express = require("express")
const router = express.Router()

const User = require("../../models/user.js")
const jwt = require("jsonwebtoken")
const crypto = require("crypto")

const publicKey = Buffer.from(process.env.PUBLIC_KEY, "base64").toString(
  "ascii"
)
const privateKey = Buffer.from(process.env.PRIVATE_KEY, "base64").toString(
  "ascii"
)

// Refreshing the the session tokens
router.post("/api/refresh", async (req, res) => {
  if (req.cookies["refresh_token"] && req.body.username) {
    const user = await User.findOne({ username: req.body.username })
    if (user && user.banned !== true) {
      let jwtRefresh
      jwt.verify(
        req.cookies["refresh_token"],
        publicKey,
        function (err, decoded) {
          console.log(err)
          jwtRefresh = decoded
        }
      )
      const tokenArray = user.tokens
      if (jwtRefresh) {
        const token = tokenArray.filter(
          (tokenArray) => tokenArray.refresh_token === jwtRefresh.id
        )
        if (tokenArray[0]) {
          if (user.secret === jwtRefresh.secret) {
            if (token[0]) {
              if (Date.now() < token[0].refresh_expiry) {
                const access_token = crypto.randomBytes(65).toString("base64")
                const refresh_token = crypto.randomBytes(65).toString("base64")
                if (Date.now() < token[0].access_expiry) {
                  res.cookie(
                    "refresh_token",
                    jwt.sign(
                      {
                        username: req.body.username,
                        id: token[0].refresh_token,
                        secret: user.secret,
                      },
                      privateKey,
                      { algorithm: "PS256", expiresIn: token[0].refresh_expiry }
                    ),
                    {
                      secure: true,
                      httpOnly: true,
                      maxAge: token[0].refresh_expiry,
                      sameSite: "strict",
                    }
                  )
                  const oldAT = token[0].access_token
                  res.send({
                    access_token: oldAT,
                  })
                } else {
                  const currentDate = Date.now()
                  const oldRefreshTokenArray = tokenArray.filter(
                    (rt) => rt.refresh_token !== jwtRefresh.id
                  )
                  const refreshTokenArray = oldRefreshTokenArray.filter(
                    (old_rt) => old_rt.refresh_expiry > currentDate
                  )

                  const newTokens = {
                    access_token: access_token,
                    refresh_token: refresh_token,
                    access_expiry: Date.now() + 8300000,
                    refresh_expiry: Date.now() + 8640000000,
                  }
                  user.tokens = [...refreshTokenArray, newTokens]
                  user.save()
                  res.cookie(
                    "refresh_token",
                    jwt.sign(
                      {
                        username: req.body.username,
                        id: refresh_token,
                        secret: user.secret,
                      },
                      privateKey,
                      {
                        algorithm: "PS256",
                        expiresIn: "100d",
                      }
                    ),
                    {
                      secure: true,
                      httpOnly: true,
                      maxAge: 60 * 60 * 24 * 100 * 1000,
                      sameSite: "strict",
                      site: "micahlindley.com"
                    }
                  )
                  res.send({
                    access_token,
                  })
                }
              } else {
                console.log("⚠️ Refresh token expired")
                res.sendStatus(403)
              }
            } else {
              console.warn(
                `CRITICAL: Refresh Token Theft Detection has been detected for user ${jwtRefresh.username}.`
              )
              user.tokens = []
              user.secret = crypto.randomBytes(65).toString("base64")
              user.save()
              res.sendStatus(403)
            }
          } else {
            console.warn(
              `Someone either has the signing key or has previously stolen this JWT for user ${jwtRefresh.username}, not a huge threat`
            )
            res.sendStatus(403)
          }
        } else {
          console.warn("This user does not have any tokens.")
          res.sendStatus(403)
        }
      } else {
        console.log("Improper use of the refresh endpoint.")
        res.sendStatus(401)
      }
    } else {
      console.log("User banned or doesn't exist")
      res.sendStatus(401)
    }
  } else {
    console.log("Missing data")
    res.sendStatus(400)
  }
})

module.exports = router
