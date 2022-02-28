const VERSION = "0.8.3"
const express = require("express")
var cookie = require("cookie")
const helmet = require("helmet")

const replaceAll = require("string.prototype.replaceall")
const safeHTML = (dirty) => {
  dirty = replaceAll(dirty, "![", "<img>")
  dirty = replaceAll(dirty, "!(", "<img>")
  dirty = String(dirty)
    .split("&")
    .join("&amp;")
    .split("<")
    .join("&lt;")
    .split(">")
    .join("&gt;")
  return dirty
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
    ],
    credentials: true,
    methods: ["GET", "POST"],
  })
)
app.use(helmet())
app.use(cookieParser())

const mongoose = require("mongoose")

mongoose.connect(encodeURI(process.env.MONGO_URL))

// Schemas
const User = require("./models/user.js")
const Room = require("./models/room.js")

Room.find().then((r) => {
  if (JSON.stringify(r) == "[]") {
    Room.create({
      messages: [],
      name: "general",
      message_id: 0,
    })
  }
})

const base64 = require("base-64")
const socket = require("socket.io")
const bcrypt = require("bcryptjs")

var server = app.listen(
  port,
  console.log(`🟢 Server is running on port ${process.env.PORT || 3000}.`)
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

app.get("/", (req, res) => {
  res.send(`🏁 modchat-server ${VERSION} is running`)
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
    if (user.ban_expiry) {
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
    if (await bcrypt.compare(password, user.password)) {
      console.log(`✅ Correct username and password`)
      const access_token = cryptoRandomString(65)
      const refresh_token = cryptoRandomString(65)
      await User.updateOne(
        {
          username,
        },
        {
          $set: {
            tokens: {
              access_token: access_token,
              refresh_token: refresh_token,
              access_expiry: Date.now() + 8300000,
              refresh_expiry: Date.now() + 8640000000,
            },
          },
        }, {upsert: true, setDefaultsOnInsert:true}
      )
      res.cookie("refresh_token", refresh_token, {
        secure: true,
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 100 * 1000,
        sameSite: "strict",
      })
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
      const token = user.tokens[0].refresh_token
      if (req.cookies["refresh_token"] == token) {
        if (Date.now() < user.tokens[0].refresh_expiry) {
          const access_token = cryptoRandomString(65)
          const refresh_token = cryptoRandomString(65)
          await User.updateOne(
            {
              username: req.body.username,
            },
            {
              $set: {
                tokens: {
                  access_token: access_token,
                  refresh_token: refresh_token,
                  access_expiry: Date.now() + 8300000, // 8300000
                  refresh_expiry: Date.now() + 86400000, // 86400000
                },
              },
            }
          )
          res.cookie("refresh_token", refresh_token, {
            secure: true,
            httpOnly: true,
            maxAge: 60 * 60 * 24 * 100 * 1000,
            sameSite: "strict",
          })
          res.send({
            access_token,
          })
        } else {
          console.log("⚠️ Refresh token expired")
          res.sendStatus(403)
        }
      } else {
        res.sendStatus(403)
      }
    } else {
      console.log("Improper use of the refresh endpoint.")
      res.sendStatus(301)
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
        if (o.tokens[0].access_expiry > Date.now()) {
          const res = access_token == o.tokens[0].access_token
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
    })
  }

  socket.onAny((event, args) => {
    if (event != "userTyping") {
      eventList.push({ event, args })
    }
  })

  //when a user joins room
  socket.on("joinRoom", async ({ username, roomname, access_token, sameTab }) => {
    authUser(username, access_token).then(async (authed) => {
      const permaUsername = username
      if (authed.state == true) {
        //* create user
        Room.findOne({ name: roomname }).then((r) => {
          if (!r) {
            Room.create({
              messages: [],
              name: roomname,
              message_id: 0,
            })
          }
        })
        console.log("✅ Authenticated")

        const oldUser = authed.object

        const user = userJoin(socket.id, username, roomname)
        socket.join(roomname)
        console.log(
          `🔗 ${username} connected on socket ${socket.id} in room ${roomname}`
        )

        const roomStorage = await Room.findOne({
          name: roomname,
        }).lean()
        if (roomStorage) {
          roomStorage.messages.forEach((i) => {
            io.to(socket.id).emit("message", {
              username: i.username,
              profilePicture: i.profile_picture,
              type: "text",
              content: i.message,
              id: i.message_id,
              old: true,
            })
          })
        }

        //* Broadcast message to everyone except user that he has joined
        io.to(roomname).emit("message", {
          userId: "000000",
          username: "Modchat Bot",
          profilePicture: "https://cdn.micahlindley.com/assets/modchat-pfp.png",
          type: "text",
          content: safeHTML(`🎉 @${username} has joined the chat 🎉`),
          id: cryptoRandomString(34),
        })

        app.post("/api/logout", async (req, res) => {
          if (req.body.username && req.cookies["access_token"]) {
            authUser(username, req.cookies["access_token"]).then(
              async (authed) => {
                if (authed.state == true) {
                  await User.updateOne(
                    { username: req.body.username },
                    {
                      $set: {
                        tokens: {
                          access_expiry: 0,
                          refresh_expiry: 0,
                        },
                      },
                    }
                  )
                  res.sendStatus(200)
                } else {
                  console.warn("🔐 Unauthenticated")
                  res.sendStatus(400)
                }
              }
            )
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
                const id = oldID.message_id + 1

                const content = safeHTML(object.content)

                if (!content) {
                  return
                }

                // moderate message with external server
                const res = await fetch(
                  "https://mc-filterbot.micahlt.repl.co/api/checkstring",
                  {
                    method: "POST",
                    body: content,
                  }
                )
                if (res.status == 200) {
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

                      const list = content.split(" ").slice(3 + base.length / 2)
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
                    default:
                      io.to(object.room).emit("message", {
                        username: user.username,
                        profilePicture: user.scratch_picture,
                        type: "text",
                        content: content,
                        id: id,
                      })
                      await Room.updateOne(
                        {
                          message_id: oldID.message_id,
                        },
                        {
                          $set: {
                            message_id: id,
                          },
                        }
                      )

                      const message = {
                        username: user.username,
                        message: content,
                        profile_picture: user.scratch_picture,
                        time: 50,
                        message_id: id,
                      }

                      await Room.updateOne(
                        {
                          name: object.room,
                        },
                        { $push: { messages: message } }
                      )

                      const room = await Room.findOne({
                        name: object.room,
                      }).lean()

                      if (room.messages.length > 100) {
                        await Room.updateOne(
                          {
                            username: user.username,
                          },
                          {
                            $pop: {
                              messages: -1,
                            },
                          }
                        )
                      }
                      break
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
            })
          userLeave(socket.username);
        })
      } else {
        console.warn("⚠️ Error authenticating user.")
      }
    })
  })
})
