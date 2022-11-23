// we should consider switching to something else or hosting our own

const express = require("express")
const router = express.Router()

const User = require("../../models/user.js")

const fetch = require("node-fetch") // old node versions
const crypto = require("crypto")

// Using SOA2 on the Scratch Wiki (this needs to be completely reworked)
router.post("/api/soa2code", (req, res) => {
  if (req.body.code && req.body.state) {
    fetch("https://oauth2.scratch-wiki.info/w/rest.php/soa2/v0/tokens", {
      method: "POST",
      body: JSON.stringify({
        client_id: parseInt(process.env.MC_CLIENT_ID, 10),
        client_secret: process.env.MC_CLIENT_SECRET,
        code: req.body.code,
        scopes: "identify",
      }),
    })
      .then((response) => {
        return response.json()
      })
      .then((json) => {
        if (!json) {
          res.sendStatus(400)
        } else {
          const data = json.access_token
          fetch("https://oauth2.scratch-wiki.info/w/rest.php/soa2/v0/user", {
            method: "GET",
            headers: {
              Authorization: `Bearer ${Buffer.from(data, "utf8").toString(
                "base64"
              )}`,
            },
          })
            .then((newRes) => {
              return newRes.json()
            })
            .then((newResJson) => {
              if (newResJson && newResJson.user_id) {
                newResJson.session = crypto.randomBytes(46).toString("base64")
                console.log("💾 Adding user to mongoose")
                User.findOne({ username: newResJson.user_name }).then(
                  (user) => {
                    if (user) {
                      console.log("User already exists")
                      return
                    } else {
                      User.create({
                        username: newResJson.user_name,
                        role: "user",
                      })
                    }
                    res.json(newResJson)
                  }
                )
              }
            })
        }
      })
  }
})

module.exports = router
