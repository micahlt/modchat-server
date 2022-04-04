const VERSION = "0.8.6"
const express = require("express")
const rateLimit = require("express-rate-limit")
const apiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 60 minutes
  max: 1, // Limit each IP to 1 requests per `window` (here, per 60 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})

var cookie = require("cookie")
const helmet = require("helmet")

const privateKey = Buffer.from(process.env.PRIVATE_KEY, "base64").toString(
  "ascii"
)
const publicKey = Buffer.from(process.env.PUBLIC_KEY, "base64").toString(
  "ascii"
)

const replaceAll = require("string.prototype.replaceall")
const safeHTML = (dirty) => {
  if (dirty.includes("‮")) {
    reverseString(dirty)
  }
  dirty = replaceAll(dirty, "‮", "")
  dirty = replaceAll(dirty, "![", "")
  dirty = replaceAll(dirty, "!(", "")
  dirty = String(dirty)
    .split("&")
    .join("&amp;")
    .split("<")
    .join("&lt;")
    .split(">")
    .join("&gt;")
  return dirty
}

function reverseString(str) {
  return str.split("").reverse().join("")
}

const cryptoRandomString = require("crypto-random-string")
const cookieParser = require("cookie-parser")

const bodyParser = require("body-parser")
const cors = require("cors")

const app = express()

const fetch = require("node-fetch")
const port = process.env.PORT || 8000

app.use(bodyParser.json())
app.use(
  cors({
    origin: [
      "https://modchat-vue.mcv2.repl.co",
      "https://modchat.micahlindley.com",
      "https://s.modchat.micahlindley.com",
    ],
    credentials: true,
    methods: ["GET", "POST"],
  })
)
app.use(helmet())
app.use(cookieParser())

const mongoose = require("mongoose")
const jwt = require("jsonwebtoken")

mongoose.connect(encodeURI(process.env.MONGO_URL))

// Schemas
const User = require("./models/user.js")
const Room = require("./models/room.js")
const Message = require("./models/message.js")

Room.find().then((r) => {
  if (JSON.stringify(r) == "[]") {
    Room.create({
      name: "general",
      current_message_id: 0,
    })
    Room.create({
      name: "developers",
      current_message_id: 0,
    })
    Room.create({
      name: "games",
      current_message_id: 0,
    })
    Room.create({
      name: "random",
      current_message_id: 0,
    })
    Room.create({
      name: "help",
      current_message_id: 0,
    })
  }
})

const base64 = require("base-64")
const socket = require("socket.io")
const bcrypt = require("bcryptjs")

var server = app.listen(
  port,
  console.log(`🟢 Server is running on port ${port}.`)
)
const io = socket(server, {
  pingTimeout: 60000, // tries to fix too many reconnects
  cors: {
    methods: ["GET", "POST"],
    origin: true,
    credentials: true,
  },
})

const { getCurrentUser, userLeave, userJoin, userList } = require("./user.js")
const filterText = require("./filter.js")

app.get("/", (req, res) => {
  res.send(`🏁 modchat-server ${VERSION} is running`)
})

app.get("/api/messages/:room/:id", (req, res) => {
  const room = req.params.room
  const id = req.params.id
  if (String(room) && Number(id)) {
    Message.find({
      room: room,
      id: id,
    }).then((msg) => {
      if (JSON.stringify(msg) == "[]") {
        res.status(404).send("Couldn't find anything that matched.")
      } else {
        res.status(200).send(msg[0])
      }
    })
  } else {
    res.sendStatus(400)
  }
})

app.get("/api/messages/:room", (req, res) => {
  const room = req.params.room
  const first = req.query.first
  const last = req.query.last
  if (room && first && last) {
    Message.find({
      room: room,
      id: {
        $gte: first,
        $lte: last,
      },
    })
      .sort({ id: "asc" })
      .then((msg) => {
        if (JSON.stringify(msg) == "[]") {
          res.status(204).send(msg)
        } else {
          res.status(200).send(msg)
        }
      })
  } else {
    res.sendStatus(400)
  }
})

app.get("/api/rooms/:room?", (req, res) => {
  const room = req.params.room
  if (room) {
    Room.find({
      name: room,
    }).then((rm) => {
      if (JSON.stringify(rm) == "[]") {
        res.status(204).send(rm)
      } else {
        res.status(200).send(rm[0])
      }
    })
  } else {
    Room.find().then((rm) => {
      res.status(200).send(rm)
    })
  }
})

app.get("/api/session/isBanned/:username", (req, res) => {
  const username = req.params.username
  if (username && String(username)) {
    User.find({
      username: username,
    }).then((rm) => {
      res.status(200).send({banned: rm[0].banned, expiry: rm[0].ban_expiry, reason: rm[0].ban_reason})
    })
  } else {
    res.sendStatus(400)
  }
})

app.post("/api/messages/delete/", async (req, res) => {
  const room = req.body.room
  const id = req.body.id
  const username = req.body.username
  const access_token = req.body.access_token
  if (username && room && id && access_token) {
    if (
      String(room) &&
      Number(id) &&
      String(access_token) &&
      String(username)
    ) {
      const user = await User.findOne({
        username: username,
      })
      const tokenArray = user.tokens
      const token = tokenArray.filter(
        (tokenArray) => tokenArray.access_token === access_token
      )
      if (token[0] && Date.now() < token[0].access_expiry && user.banned !== 'true') {
        if (user.role == "moderator") {
          await Message.deleteOne({
            room: room,
            id: id,
          })
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

app.post("/api/session/revoke", async (req, res) => {
  const username = req.body.username
  const mod = req.body.myUsername
  const access_token = req.body.access_token
  if (username && access_token && mod && String(username) && String(access_token) && String(mod)) {
    const user = await User.findOne({
      username: mod,
    })
    const tokenArray = user.tokens
    const token = tokenArray.filter(
      (tokenArray) => tokenArray.access_token === access_token
    )
    if (token[0] && Date.now() < token[0].access_expiry && user.banned !== 'true') {
      if (user.role == "moderator") {
        user.tokens = []
        user.save()
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
})

app.post("/api/session/ban", async (req, res) => {
  const username = req.body.username
  const mod = req.body.myUsername
  const access_token = req.body.access_token
  const reason = req.body.reason
  const timestamp = req.body.time
  if (username && access_token && reason && timestamp && mod && String(username) && String(access_token) && String(reason) && Number(timestamp) && String(mod)) {
    const user = await User.findOne({
      username: mod,
    })
    const tokenArray = user.tokens
    const token = tokenArray.filter(
      (tokenArray) => tokenArray.access_token === access_token
    )
    if (token[0] && Date.now() < token[0].access_expiry && user.banned !== 'true') {
      if (user.role == "moderator") {
        await User.updateOne(
          {
            username,
          },
          {
            $set: {
              banned: true,
              ban_reason: reason,
              ban_expiry: timestamp
            },
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
})

app.post("/api/session/unban", async (req, res) => {
  const username = req.body.username
  const access_token = req.body.access_token
  const mod = req.body.myUsername
  if (username && access_token && mod && String(username) && String(access_token) && String(mod)) {
    const user = await User.findOne({
      username: mod,
    })
    const tokenArray = user.tokens
    const token = tokenArray.filter(
      (tokenArray) => tokenArray.access_token === access_token
    )
    if (token[0] && Date.now() < token[0].access_expiry && user.banned !== 'true') {
      if (user.role == "moderator") {
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
      res.sendStatus(401)
    }
  } else {
    res.sendStatus(400)
  }
})

app.post("/api/session/mute", async (req, res) => {
  const username = req.body.username
  const access_token = req.body.access_token
  const mod = req.body.myUsername
  const time = req.body.timeStamp
  if (username && access_token && mod && time && String(username) && String(access_token) && String(mod) && Number(time)) {
    const user = await User.findOne({
      username: mod,
    })
    const tokenArray = user.tokens
    const token = tokenArray.filter(
      (tokenArray) => tokenArray.access_token === access_token
    )
    if (token[0] && Date.now() < token[0].access_expiry && user.banned !== 'true') {
      if (user.role == "moderator") {
        await User.updateOne(
          {
            username,
          },
          {
            $set: {
              mutedFor: time,
            },
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
})

app.post("/api/session/unmute", async (req, res) => {
  const username = req.body.username
  const access_token = req.body.access_token
  const mod = req.body.myUsername
  if (username && access_token && mod && String(username) && String(access_token) && String(mod)) {
    const user = await User.findOne({
      username: mod,
    })
    const tokenArray = user.tokens
    const token = tokenArray.filter(
      (tokenArray) => tokenArray.access_token === access_token
    )
    if (token[0] && Date.now() < token[0].access_expiry && user.banned !== 'true') {
      if (user.role == "moderator") {
        await User.updateOne(
          {
            username,
          },
          {
            $set: {
              mutedFor: 0,
            },
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
})

app.post("/api/soa2code", (req, res) => {
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
          fetch("https://oauth2.scratch-wiki.info/w/rest.php/soa2/v0/user", {
            method: "GET",
            headers: {
              Authorization: `Bearer ${base64.encode(json.access_token)}`,
            },
          })
            .then((newRes) => {
              return newRes.json()
            })
            .then((newResJson) => {
              if (newResJson.user_id) {
                newResJson.session = cryptoRandomString(46)
                console.log("💾 Adding user to mongoose")
                User.create({
                  username: newResJson.user_name,
                })
                res.json(newResJson)
              }
            })
        }
      })
  }
})

app.post("/api/updatepassword", async (req, res) => {
  if (req.body.username && req.body.password) {
    const newPwd = await bcrypt.hash(req.body.password, 10)
    const username = req.body.username
    await User.updateOne(
      {
        username,
      },
      {
        $set: {
          password: newPwd,
          role: "user",
        },
      }
    )
    res.sendStatus(200)
  } else {
    console.warn("❌ Request did not include a body")
    res.sendStatus(403)
  }
})

app.post("/api/login", async (req, res) => {
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
    if (user.banned == true && user.ban_expiry) {
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
    let secret = cryptoRandomString(65)
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
      const access_token = cryptoRandomString(65)
      const refresh_token = cryptoRandomString(65)
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
        }
      )
      res.send({
        access_token,
      })
    } else {
      res.status(400).send({ reason: "wrongPassword" })
    }
  } else {
    console.warn("🔐 Missing username, password, or both")
    res.status(400).send({ reason: "missingData" })
  }
})

app.post("/api/refresh", async (req, res) => {
  if (req.cookies["refresh_token"] && req.body.username) {
    const user = await User.findOne({ username: req.body.username })
    if (user) {
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
        if (!tokenArray == []) {
          if (user.secret === jwtRefresh.secret) {
            if (token[0]) {
              if (Date.now() < token[0].refresh_expiry) {
                const access_token = cryptoRandomString(65)
                const refresh_token = cryptoRandomString(65)
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
              user.secret = cryptoRandomString(65)
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
        res.sendStatus(301)
      }
    }
  }
})

//everything related to socketio will go here
io.on("connection", (socket) => {
  const eventList = []
  function authUser(username, access_token) {
    function getObject() {
      return User.findOne({ username: username })
    }
    return getObject().then((o) => {
      if (o) {
        socket.username = username
        const tokenArray = o.tokens
        const token = tokenArray.filter(
          (tokenArray) => tokenArray.access_token === access_token
        )
        if (token[0]) {
          if (token[0].access_expiry > Date.now()) {
            const res = access_token == token[0].access_token
            if (o.banned == true) {
              socket.emit("bannedUser", {
                reason: o.ban_reason,
                expiry: o.ban_expiry,
              })
              socket.leave(o.room)
              return {
                state: false,
              }
            }
            if (res == true) {
              return {
                state: true,
                object: o,
              }
            } else {
              return {
                state: false,
              }
            }
          } else {
            const latestEvent = eventList[eventList.length - 1]
            io.to(socket.id).emit("refresh", {
              name: latestEvent.event,
              args: latestEvent.args,
            })
            return {
              state: false,
            }
          }
        } else {
          return {
            state: false,
          }
        }
      } else {
        return {
          state: false,
        }
      }
    })
  }

  socket.onAny((event, args) => {
    if (event != "userTyping") {
      eventList.push({ event, args })
    }
  })

  //when a user joins room
  socket.on(
    "joinRoom",
    async ({ username, roomname, access_token, sameTab }) => {
      authUser(username, access_token).then(async (authed) => {
        const permaUsername = username

        if (authed.state == true) {
          // create user
          console.log("✅ Authenticated")

          const oldUser = authed.object

          const user = userJoin(socket.id, username, roomname)
          socket.join(roomname)
          console.log(
            `🔗 ${username} connected on socket ${socket.id} in room ${roomname}`
          )
          //* Broadcast message to everyone except user that he has joined
          io.to(roomname).emit("message", {
            userId: "000000",
            username: "Modchat Bot",
            profilePicture:
              "https://cdn.micahlindley.com/assets/modchat-pfp.png",
            type: "text",
            content: safeHTML(`🎉 @${username} has joined the chat 🎉`),
            id: cryptoRandomString(34),
            time: new Date(),
          })

          app.post("/api/logout", async (req, res) => {
            if (req.body.username && req.cookies["refresh_token"]) {
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

          app.get("/api/onlineusers", (req, res) => {
            res.send({
              online: userList,
            })
          })

          socket.on("userTyping", (object) => {
            if (object.username == socket.username) {
              io.to(object.room).emit("isTyping", object)
            }
          })

          //when somebody sends text
          socket.on("chat", async (object) => {
            authUser(object.username, object.access_token).then(
              async (authed) => {
                if (authed.state == true) {
                  if (!object || object == null) {
                    console.warn(
                      `⚠️ Someone has attempted to DoS the server on listener 'chat'.`
                    )
                    return
                  }
                  const user = authed.object
                  const oldID = await Room.findOne({
                    name: object.room,
                  })
                  const id = oldID.current_message_id + 1

                  const content = safeHTML(object.content)

                  if (!content) {
                    return
                  }

                  // moderate message with external server
                  const res = filterText(object.content) ? 200 : 400
                  /*await fetch(
                    "https://mc-filterbot.micahlt.repl.co/api/checkstring",
                    {
                      method: "POST",
                      body: content,
                    }
                  ).catch((err) => {
                    console.error("⚠️ " + err);
                  })*/
                  if (res) {
                    if (res == 200) {
                      switch (content.split(" ")[0]) {
                        case "/ban":
                          const base = content.split(" ")
                          let addOn = 0
                          for (let i = 0; i < base.length / 2; i++) {
                            const day = base[i]
                            const specificTime = base[i + 1]
                            console.log(specificTime)
                            if (specificTime == "months") {
                              addOn += 2629746000 * day
                            } else if (specificTime == "days") {
                              addOn += 86400000 * day
                            } else if (specificTime == "weeks") {
                              addOn += 604800000 * day
                            }
                          }
                          const expiry = Date.now() + addOn

                          function getNumberWithOrdinal(n) {
                            var s = ["th", "st", "nd", "rd"],
                              v = n % 100
                            return n + (s[(v - 20) % 10] || s[v] || s[0])
                          }

                          const formatAMPM = (date) => {
                            let hours = date.getHours()
                            let minutes = date.getMinutes()
                            let seconds = date.getSeconds()
                            let ampm = hours >= 12 ? "PM" : "AM"
                            hours = hours % 12
                            hours = hours ? hours : 12
                            minutes = minutes.toString().padStart(2, "0")
                            let strTime =
                              hours + ":" + minutes + ":" + seconds + " " + ampm
                            return strTime
                          }

                          const list = content
                            .split(" ")
                            .slice(3 + base.length / 2)
                          const reason = list.join(" ")
                          await User.updateOne(
                            {
                              username: content.split(" ")[1],
                            },
                            {
                              $set: {
                                banned: true,
                                ban_expiry: expiry,
                                ban_reason: reason,
                              },
                            }
                          )
                          break
                        case "/unban":
                          await User.updateOne(
                            {
                              username: content.split(" ")[1],
                            },
                            {
                              $set: {
                                banned: false,
                              },
                            }
                          )
                          break
                        case "/shrug":
                          io.to(roomname).emit("message", {
                            userId: "000000",
                            username: "Modchat Bot",
                            profilePicture:
                              "https://cdn.micahlindley.com/assets/modchat-pfp.png",
                            type: "text",
                            content: `**${user.username}** shrugged ¯\_(ツ)_/¯`,
                            id: cryptoRandomString(34),
                          })
                          break
                        default:
                          io.to(object.room).emit("message", {
                            username: user.username,
                            profilePicture: user.scratch_picture,
                            type: "text",
                            content: content,
                            time: new Date(),
                            id: id,
                          })
                          await Room.updateOne(
                            {
                              current_message_id: oldID.current_message_id,
                            },
                            {
                              $set: {
                                current_message_id: id,
                              },
                            }
                          )

                          const message = {
                            username: user.username,
                            message: content,
                            profile_picture: user.scratch_picture,
                            time: new Date(),
                            id: id,
                            room: roomname,
                          }

                          await Message.create(message)
                          break
                      }
                    } else {
                      console.log("🗣️ A message was filtered.")
                      io.to(socket.id).emit("badMessage")
                    }
                  }
                }
              }
            )
          })
          // Disconnect , when user leave room
          socket.on("disconnect", async () => {
            console.log(socket.username, "disconnected")
            // * deconste user from users & emit that user has left the chat
            io.to(roomname).emit("message", {
              userId: "0000000",
              username: "Modchat Bot",
              profilePicture:
                "https://cdn.micahlindley.com/assets/modchat-pfp.png",
              type: "text",
              content: safeHTML(`😥 @${socket.username} left the chat 😥`),
              id: cryptoRandomString(34),
              time: new Date(),
            })
            userLeave(socket.username)
          })
        } else {
          console.warn("⚠️ Error authenticating user.")
        }
      })
    }
  )
})
