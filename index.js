const VERSION = "0.8.3"
const express = require("express")
const helmet = require("helmet")

const replaceAll = require("string.prototype.replaceall")
const createDOMPurify = require("dompurify")
const { JSDOM } = require("jsdom")
const window = new JSDOM("").window
const DOMPurify = createDOMPurify(window)
DOMPurify.setConfig({ ALLOWED_TAGS: [] })
const safeHTML = (dirty) => {
  dirty = replaceAll(dirty, "![", "<img>")
  dirty = replaceAll(dirty, "!(", "<img>")
  dirty = DOMPurify.sanitize(dirty)
  return dirty
}

const bodyParser = require("body-parser")
const cors = require("cors")

const app = express()

const fetch = require("node-fetch")
const port = process.env.PORT || 8000

app.use(bodyParser.json())
app.use(cors())
app.use(helmet())

const mongoose = require("mongoose")
mongoose.connect(process.env.MONGO_URL)

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
  console.log(`Server is running on port ${process.env.PORT || 3000}.`)
)
const io = socket(server, {
  pingTimeout: 60000, // tries to fix too many reconnects
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
})

require("socketio-auth")(io, {
  authenticate: async (socket, data, callback) => {
    //get credentials sent by the client
    var username = data.username
    var password = data.password
    User.findOne(
      {
        username: username,
      },
      async (err, user) => {
        //inform the callback of auth success/failure
        if (err || !user) return callback(new Error("User not found"))
        if (!bcrypt.compare(password, user.password)) {
          console.log("UNAUTHED USER")
        }
        return callback(null, bcrypt.compare(password, user.password))
      }
    )
  },
})

const cryptoRandomString = require("crypto-random-string")
const { getCurrentUser, userLeave, userJoin, userList } = require("./user.js")

app.get("/", (req, res) => {
  res.send(`modchat-server ${VERSION} is running`)
})

app.post("/api/soa2code", (req, res) => {
  if (req.body.code && req.body.state) {
    console.log("Passed checks")
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
                console.log("Adding user to mongoose")
                res.json(newResJson)
                User.findOneAndUpdate(
                  {
                    username: newResJson.user_name,
                  },
                  {
                    username: newResJson.user_name,
                    token: newResJson.session,
                  }
                ).then((r) => {
                  User.create({
                    username: newResJson.user_name,
                    token: newResJson.session,
                    status: "offline",
                  })
                })
              }
            })
        }
      })
  }
})

app.post("/api/updatepassword", async (req, res) => {
  if (req.body.token && req.body.password) {
    const newPwd = await bcrypt.hash(req.body.password, 10)
    const token = req.body.token
    await User.updateOne(
      {
        token,
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
    console.log("didnt include body")
    res.sendStatus(403)
  }
})

app.post("/api/login", async (req, res) => {
  if (req.body.username && req.body.password) {
    console.log("Passed checks")
    const { username, password } = req.body

    const user = await User.findOne({
      username,
    }).lean()
    if (!user) {
      console.log("Username or password incorrect.")
      res.sendStatus(400)
    }
    if (await bcrypt.compare(password, user.password)) {
      console.log(`Correct username and password`)
      res.send(req.body.token)
    }
  } else {
    console.log("Missing username, password, or both")
    res.sendStatus(400)
  }
})

//everything related to socketio will go here
io.on("connection", (socket) => {
  //when new user join room
  socket.on("joinRoom", async ({ username, roomname, token }) => {
    //* create user
    /*
    if (username == 'Unauthed User') {
      console.log(`An ${'unauthenicated user'} connected on socket ${socket.id.bgBlue} in room ${roomname.bgBlue}`)
      return 1;
    } */
    Room.findOne({ name: roomname }).then((r) => {
      if (!r) {
        Room.create({
          messages: [],
          name: roomname,
          message_id: 0,
        })
      }
    })
    console.log("Joining user to chat")

    const oldUser = User.findOne({ username: username })

    const user = userJoin(socket.id, username, roomname)
    socket.join(roomname)
    console.log(
      `${username} connected on socket ${socket.id} in room ${roomname}`
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
          content: safeHTML(i.message),
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

    app.get("/api/finduser", (req, res) => {
      User.findOne(
        {
          socket: socket.id,
        },
        (err, docs) => {
          res.send(docs)
          return docs
        }
      )
    })
  })

  app.get("/api/onlineusers", (req, res) => {
    res.send({
      online: userList,
    })
  })

  socket.on("leaveRoom", (room) => {
    socket.leave(room)
  })

  socket.on("userTyping", (object) => {
    io.to(object.room).emit("isTyping", object)
  })

  //when somebody sends text
  socket.on("chat", async (object) => {
    if (!object || object == null) {
      console.log(`Someone has attempted to DoS the server on listener 'chat'.`)
      return
    }
    const user = await User.findOne({
      username: object.username,
    })
    const oldID = await Room.findOne({
      name: user.room,
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
      io.to(user.room).emit("message", {
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
          name: user.room,
        },
        { $push: { messages: message } }
      )

      const room = await Room.findOne({
        name: user.room,
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
    }
  })
  // Disconnect , when user leave room
  socket.on("disconnect", async () => {
    const user = await getCurrentUser(socket.id)
    // * deconste user from users & emit that user has left the chat
    if (!user) {
      console.log(`An unauthenicated user disconnected`)
      return 1
    } else {
      io.to(user.room).emit("message", {
        userId: "0000000",
        username: "Modchat Bot",
        profilePicture: "https://cdn.micahlindley.com/assets/modchat-pfp.png",
        type: "text",
        content: safeHTML(`😥 @${user.username} left the chat 😥`),
        id: cryptoRandomString(34),
      })
    }
    userLeave(user.username)
  })
})
