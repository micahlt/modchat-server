"use strict"

const express = require("express")

const app = express()
const PORT = process.env.PORT || 8001

const mongoUrl = process.env.MONGO_URL
const mongoose = require("mongoose")

const User = require("./models/user.js")
const Room = require("./models/room.js")
const Message = require("./models/message.js")

const cors = require("cors")
const cookieParser = require("cookie-parser")

const rateLimit = require("express-rate-limit")
const hpp = require("hpp")

const helmet = require("helmet")

const vs = require("varstruct")
const vi = require("varint")

const bodyParser = require("body-parser")

const errorHandler = require("./middleware/errorHandler.js")
const tooBusy = require("./middleware/tooBusy.js")

const userJoin = require("./helpers/userJoin.js")
const filterText = require("./helpers/filter.js")

const apiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 60 minutes
  max: 500, // Limit each IP to 100 requests per `window` (here, per 60 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
})

const crypto = require("crypto")

// do we want to do something so people can make custom clients?
const allowedOrigins = [
  "https://modchat-vue.mcv2.repl.co",
  "https://modchat.micahlindley.com",
  "https://s.modchat.micahlindley.com",
  "https://panel.modchat.micahlindley.com",
  "https://s.panel.modchat.micahlindley.com",
  "https://modchat-vue.mcv2.repl.co/",
]

// Automute data

let b64tbl = { "-": "+", _: "/", "/": "_", "+": "-", "=": "", ".": "" }
let decb64 = (b) => b.replace(/[-_.]/g, (m) => b64tbl[m])
let encb64 = (b) => b.replace(/[+/=]/g, (m) => b64tbl[m])

let minf = vs([
  ["q", vs.Byte],
  ["t", vs.Byte],
  ["e", vs.VarArray(vi, vi)],
  ["i", vs.VarArray(vi, vi)],
])

let slowmoRules = [
  [50, 3, 60000, 2],
  [1000, 10, 60000, 5],
  [5000, 40, 30000, 20],
  [30000, 50, 40000, 40],
  [5000, 8, 30000, 6],
  [1000, 4, 30000, 3],
]
let sm = {}
let slowmo = {}

app.use("/", require("./routes/root.js"))

function credentials(req, res, next) {
  const origin = req.headers.origin
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Credentials", true)
  }
  next()
}

function replaceAll(string, replacer) {
  return string.split(replacer).join("")
}

const corsUsage = {
  origin: (origin, callback) => {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true)
    } else {
      callback(null, true)
      callback(new Error("Not allowed by CORS"))
    }
  },
  optionsSuccessStatus: 200,
}
const safeHTML = (dirty) => {
  if (dirty && replaceAll(dirty, " ") === "") {
    return
  } else {
    dirty = replaceAll(dirty, "‮")
    dirty = replaceAll(dirty, "!(")
    dirty = replaceAll(dirty, "![")
    dirty = String(dirty)
      .split("&")
      .join("&amp;")
      .split("<")
      .join("&lt;")
      .split(">")
      .join("&gt;")
    return dirty
  }
}

function genMuteInfo(u, t, st, ...ext) {
  let d = []
  let ls = 0
  sm[u].forEach((e) => {
    if (d.length === 0) {
      d.push(0)
    } else {
      d.push(Math.floor((e - ls) / 50))
    }
    ls = e
  })
  let extended = []
  if (st === 0) {
    let sm = slowmoRules[ext[0]]
    extended.push(sm[0] / 50, sm[3], sm[1], sm[2] / 2000)
  }
  return encb64(minf.encode({ t, i: d, e: extended, q: st }).toString("base64"))
}

try {
  mongoose.connect(encodeURI(mongoUrl), {
    useUnifiedTopology: true,
    useNewUrlParser: true,
  })
} catch (err) {
  console.error(err)
}

app.use(credentials)

app.use(cors(corsUsage))

app.use(express.urlencoded({ extended: false, limit: "1kb" }))

app.use(express.json({ limit: "1kb" }))

app.use(cookieParser())

app.use(apiLimiter)

app.use(hpp())

app.use(bodyParser.json())

app.use(helmet.hsts())
app.use(helmet.frameguard({ action: "deny" }))
app.use(helmet.noSniff())
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'"],
      styleSrc: ["'none'"],
    },
  })
)
app.use(helmet.ieNoOpen())
app.use(helmet.hidePoweredBy())

app.use(tooBusy)
app.use(apiLimiter)

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
    Room.create({
      name: "roleplay",
      current_message_id: 0,
    })
  }
})

const server = app.listen(
  PORT,
  console.log(`🟢 Server is running on port ${PORT}.`)
)

app.use(require("./api/rooms/messages.js"))
app.use(require("./api/rooms/rooms.js"))
app.use(require("./api/moderation/messages.js"))
app.use(require("./api/moderation/mod.js")) // Function doesn't seem to be used right now?
app.use(require("./api/moderation/ban.js"))
app.use(require("./api/moderation/revoke.js"))
app.use(require("./api/authentication/logout.js"))
app.use(require("./api/authentication/passwords.js"))
app.use(require("./api/authentication/refresh.js"))
app.use(require("./api/authentication/soa2.js"))

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
        socket.scratch_picture = o.scratch_picture
        socket.room = o.room
        const tokenArray = o.tokens
        const token = tokenArray.filter(
          (tokenArray) => tokenArray.access_token === access_token
        )
        if (token[0]) {
          if (token[0].access_expiry > Date.now()) {
            const res = access_token == token[0].access_token
            if (o.banned == true) {
              o.tokens = []
              o.secret = crypto.randomBytes(65).toString("base64")
              o.save()
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
        if (authed.state && authed.state == true) {
          // create user
          console.log("✅ Authenticated")

          const oldUser = authed.object

          const user = userJoin(socket.id, username, roomname)
          socket.join(roomname)
          const online = []
          for (let [id, socket] of io.of("/").sockets) {
            online.push({
              room: socket.room,
              name: socket.username,
              scratch_picture: socket.scratch_picture,
            })
          }
          socket.emit("users", online)
          io.to(roomname).emit("user connected", {
            room: roomname,
            name: username,
            scratch_picture: oldUser.scratch_picture,
          })
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
            id: crypto.randomBytes(65).toString("base64"),
            time: new Date(),
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
                if (authed && authed.state == true) {
                  if (!object || object == null) {
                    console.warn(
                      `⚠️ Someone has attempted to DoS the server on listener 'chat'.`
                    )
                    return
                  }
                  if (safeHTML(object.content).length > 500) {
                    io.to(socket.id).emit("message", {
                      userId: "000000",
                      username: "Modchat Bot",
                      profilePicture:
                        "https://cdn.micahlindley.com/assets/modchat-pfp.png",
                      type: "text",
                      content: `You are ${
                        safeHTML(object.content).length - 500
                      } characters over the character limit. The character limit is 500 characters`,
                      time: new Date(),
                      id: crypto.randomBytes(34).toString("base64"),
                    })
                    return
                  }
                  if (!safeHTML(object.content)) {
                    return
                  }
                  const user = authed.object
                  if (user.mutedFor && Date.now() < user.mutedFor) {
                    io.to(socket.id).emit("message", {
                      userId: "000000",
                      username: "Modchat Bot",
                      profilePicture:
                        "https://cdn.micahlindley.com/assets/modchat-pfp.png",
                      type: "text",
                      content: `You are muted until ${user.mutedFor.toString()} If you'd like to appeal, then contact a moderator.`,
                      time: new Date(),
                      id: crypto.randomBytes(34).toString("base64"),
                    })
                    return
                  }
                  if (
                    slowmo[user.username] &&
                    slowmo[user.username] > Date.now()
                  ) {
                    io.to(socket.id).emit("message", {
                      userId: "000000",
                      username: "Modchat Bot",
                      profilePicture:
                        "https://cdn.micahlindley.com/assets/modchat-pfp.png",
                      type: "text",
                      content:
                        "You are muted. You may talk again in " +
                        Math.ceil((slowmo[user.username] - Date.now()) / 1000) +
                        " seconds.",
                      time: new Date(),
                      id: crypto.randomBytes(34).toString("base64"),
                    })
                    return
                  }
                  if (!sm[user.username]) {
                    sm[user.username] = []
                  }
                  sm[user.username].push(Date.now())
                  sm[user.username] = sm[user.username].filter(
                    (x) => x > Date.now() - 60000
                  )
                  let trig = false
                  let muteInfo
                  let trigWarn = false
                  slowmoRules.forEach((x, i) => {
                    let fl = sm[user.username].filter(
                      (y) => y > Date.now() - x[0]
                    ).length
                    if (fl >= x[1]) {
                      trig = x[2]
                      muteInfo = genMuteInfo(user.username, 0, 0, i)
                    }

                    if (fl >= x[3] && (fl === x[3] || fl % 5 === 0)) {
                      trigWarn = genMuteInfo(user.username, 1, 0, i)
                    }
                  })
                  if (trig) {
                    io.to(socket.id).emit("message", {
                      userId: "000000",
                      username: "Modchat Bot",
                      profilePicture:
                        "https://cdn.micahlindley.com/assets/modchat-pfp.png",
                      type: "text",
                      content: `You are muted for ${
                        trig / 1000
                      } seconds. This is because of spamming and you are on a cooldown.`,
                      time: new Date(),
                      id: crypto.randomBytes(34).toString("base64"),
                    })
                    slowmo[user.username] = Date.now() + trig
                    return
                  }
                  if (trigWarn) {
                    io.to(socket.id).emit("message", {
                      userId: "000000",
                      username: "Modchat Bot",
                      profilePicture:
                        "https://cdn.micahlindley.com/assets/modchat-pfp.png",
                      type: "text",
                      content: `Please slow down with your messages.`,
                      time: new Date(),
                      id: crypto.randomBytes(34).toString("base64"),
                    })
                  }
                  const oldID = await Room.findOne({
                    name: object.room,
                  })
                  if (oldID) {
                    const id = oldID.current_message_id + 1
                    const content = safeHTML(object.content)

                    const res = filterText(object.content) ? 400 : 200

                    if (res) {
                      if (res == 200) {
                        switch (content.split(" ")[0]) {
                          case "/shrug":
                            io.to(roomname).emit("message", {
                              userId: "000000",
                              username: "Modchat Bot",
                              profilePicture:
                                "https://cdn.micahlindley.com/assets/modchat-pfp.png",
                              type: "text",
                              content: `**${user.username}** shrugged ¯\\\_(ツ)_/¯`,
                              id: crypto.randomBytes(34).toString("base64"),
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
                              reply_id: object.reply_id,
                            })
                            await Room.updateOne(
                              {
                                name: object.room,
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
                              reply_id: object.reply_id,
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
              id: crypto.randomBytes(34).toString("base64"),
              time: new Date(),
            })
            let index = online.findIndex((u) => {
              return u.name == username
            })
            online.splice(index, 1)
            if (index != -1) {
              console.log("✅ Removed user from online list at index ", index)
            }
            io.to(roomname).emit("users", online)
          })
        } else {
          console.warn("⚠️ Error authenticating user.")
        }
      })
    }
  )
})

app.use(errorHandler)

process.on("uncaughtException", function (err) {
  console.log("Caught unhandled exception " + err)
})

process.on("unhandledRejection", function (err) {
  console.log("Caught unhandled rejection: " + err)
})
