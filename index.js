const VERSION = "0.5.1"
const express = require("express")
const bodyParser = require("body-parser")
const cors = require("cors")

const app = express()
const fetch = require("node-fetch")
const port = process.env.PORT || 8000

app.use(bodyParser.json())
app.use(cors())

const mongoose = require("mongoose")
mongoose.connect(process.env.MONGO_URL)

// Schemas
const User = require("./models/user.js")
const Message = require("./models/message.js")
const Room = require("./models/room.js")

const base64 = require("base-64")
const socket = require("socket.io")
const bcrypt = require("bcryptjs")

var server = app.listen(
  port,
  console.log(`Server is running on port ${process.env.PORT || 3000}.`)
)
const io = socket(server, {
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

Room.create({
  messages: [],
  name: "default",
}) // creates mongo object for default room

app.get("/", (req, res) => {
  res.send("modchat-server is running")
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
  socket.on("joinRoom", ({ username, roomname, token }) => {
    //* create user
    /*
    if (username == 'Unauthed User') {
      console.log(`An ${'unauthenicated user'} connected on socket ${socket.id.bgBlue} in room ${roomname.bgBlue}`)
      return 1;
    } */
    console.log("Joining user to chat")

    const user = userJoin(socket.id, username, roomname, token)
    socket.join(roomname)
    console.log(
      `${username} connected on socket ${socket.id} in room ${roomname}`
    )
    //* Broadcast message to everyone except user that he has joined
    io.to(roomname).emit("message", {
      userId: "000000",
      username: "Modchat Bot",
      profilePicture: "https://cdn.micahlindley.com/assets/modchat-pfp.png",
      type: "text",
      content: `🎉 @${username} has joined the chat 🎉`,
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
  socket.on("chat", (object) => {
    if (!object || object == null) {
      console.log(`Someone has attempted to DoS the server on listener 'chat'.`)
      return
    }
    let user
    User.findOne(
      {
        username: object.username,
      },
      (err, docs) => {
        user = docs
        const content = object.content
        // moderate message with external server
        fetch("https://mc-filterbot.micahlt.repl.co/api/checkstring", {
          method: "POST",
          body: content,
        }).then((res) => {
          if (res.status == 200 && object.content) {
            const id = cryptoRandomString(34)

            io.to(user.room).emit("message", {
              username: user.username,
              profilePicture: user.scratch_picture,
              type: "text",
              content: object.content,
              id: id,
            })
            /*
            Message.create({
              username: user.username,
              message: object.content,
              profile_picture: user.scratch_picture,
              time: 50,
              message_id: id,
            })
            Room.updateOne(
              {
                name: user.room,
              },
              {
                $push: {
                  messages: { message_id: id },
                },
              }
            )
            */
          }
        })
      }
    )
  })

  // Disconnect , when user leave room
  socket.on("disconnect", async () => {
    const user = await getCurrentUser(socket.id)
    // * deconste user from users & emit that user has left the chat
    if (!user) {
      console.log(`An unauthenicated user disconnected`)
      return 1
    } else {
      console.log(`${user.username} left the ${user.room} room`)
      io.to(user.room).emit("message", {
        userId: "0000000",
        username: "Modchat Bot",
        profilePicture: "https://cdn.micahlindley.com/assets/modchat-pfp.png",
        type: "text",
        content: `😥 @${user.username} left the chat 😥`,
        id: cryptoRandomString(34),
      })
    }
    userLeave(socket.id, user.username, user.room)
  })
})
