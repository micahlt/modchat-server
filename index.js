const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
const fetch = require("node-fetch");
const port = process.env.PORT || 8000;
app.use(bodyParser.json());
app.use(cors());
const color = require("colors");
let db = require("./db");
let base64 = require("base-64");
const socket = require("socket.io");
var server = app.listen(
  port,
  console.log(
    `Server is running on port ${process.env.PORT || 8000}.`
    .yellow.bold
  )
);
const io = socket(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

require('socketio-auth')(io, {
  authenticate: function(socket, data, callback) {
    //get credentials sent by the client
    var username = data.username;
    var password = data.password;
    db.findOne({
      username: username
    }, function(err, user) {
      //inform the callback of auth success/failure
      if (err || !user) return callback(new Error("User not found"));
      if (user.password != password) {
        console.log('UNAUTHED USER'.red)
      }
      return callback(null, user.password == password);
    });
  }
});

const cryptoRandomString = require("crypto-random-string");
const {
  getCurrentUser,
  userLeave,
  userJoin
} = require("./user");

app.post("/api/soa2code", (req, res) => {
  if (req.body.code && req.body.state) {
    console.log("Passed checks".green);
    fetch("https://oauth2.scratch-wiki.info/w/rest.php/soa2/v0/tokens", {
      method: "POST",
      body: JSON.stringify({
        "client_id": parseInt(process.env.MC_CLIENT_ID, 10),
        "client_secret": process.env.MC_CLIENT_SECRET,
        "code": req.body.code,
        "scopes": "identify"
      })
    }).then((response) => {
      return response.json()
    }).then((json) => {
      if (!json) {
        res.sendStatus(400);
      } else {
        fetch("https://oauth2.scratch-wiki.info/w/rest.php/soa2/v0/user", {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${base64.encode(json.access_token)}`
          }
        }).then((newRes) => {
          return newRes.json();
        }).then((newResJson) => {
          if (newResJson.user_id) {
            newResJson.session = cryptoRandomString(46);
            console.log("Adding user to DB");
            db.findOne({
              username: newResJson.user_name
            }, (err, doc) => {
              if (doc) {
                db.update({
                  username: newResJson.user_name
                }, {
                  username: newResJson.user_name,
                  token: newResJson.session
                })
              } else {
                db.insert({
                  username: newResJson.user_name,
                  token: newResJson.session,
                  status: "offline"
                })
              }
            })
            res.json(newResJson);
            return;
          } else {
            try {
              res.sendStatus(400);
            } catch (err) {
              console.log(err)
            }
            return;
          }
        })
      }
    })
  } else {
    console.log("Missing code, state, or both".red);
    res.sendStatus(400);
  }
})

app.post("/api/updatepassword", (req, res) => {
  if (req.body.token && req.body.password) {
    console.log("Passed checks".green);
    db.findOne({
      token: req.body.token
    }, (err, doc) => {
      if ((!doc) || err) {
        console.log(`Couldn"t find a valid user`.red);
        res.sendStatus(400);
      } else {
        db.update({
          token: req.body.token
        }, {
          $set: {
            password: req.body.password
          }
        }, {}, (err) => {
          if (err) {
            console.log(`Error updating document`.red);
            res.sendStatus(500);
          } else {
            res.sendStatus(200);
          }
        })
      }
    })
  } else {
    console.log("Missing token, password, or both".red);
    res.sendStatus(400);
  }
})

app.post("/api/login", (req, res) => {
  if (req.body.username && req.body.password) {
    console.log("Passed checks".green);
    db.findOne({
      username: req.body.username.toLowerCase(),
      password: req.body.password
    }, (err, doc) => {
      if ((!doc) || err) {
        console.log(`Username or password incorrect`.red);
        res.sendStatus(400);
      } else {
        console.log(`Correct username and password`.green)
        res.send(doc.token);
      }
    })
  } else {
    console.log("Missing username, password, or both".red);
    res.sendStatus(400);
  }
})

//everything related to socketio will go here
io.on("connection", (socket) => {
  //when new user join room
  socket.on("joinRoom", ({
    username,
    roomname,
    token
  }) => {
    //* create user
    /*
    if (username == "Unauthed User") {
      console.log(`An ${"unauthenicated user".bgRed} connected on socket ${socket.id.bgBlue} in room ${roomname.bgBlue}`)
      return 1;
    } */
    console.log('Joining user to chat'.blue)
    let user = userJoin(socket.id, username, roomname, token);
    socket.join(roomname);
    console.log(`${username.bgBlue} connected on socket ${socket.id.bgBlue} in room ${roomname.bgBlue}`);
    //* Broadcast message to everyone except user that he has joined
    io.to(roomname).emit("message", {
      userId: "000000",
      username: "Modchat Bot",
      profilePicture: "https://pics.freeicons.io/uploads/icons/png/13314222861581065997-512.png",
      type: "text",
      content: `🎉 @${username} has joined the chat 🎉`,
      id: cryptoRandomString(34)
    });

    app.get("/api/finduser", (req, res) => {
      db.find({
        socket: socket.id
      }, (err, docs) => {
        res.send(docs);
        return docs;
      })
    })
  });

  //when somebody send text
  socket.on("chat", (object) => {
    if(!object || object == null || !("token" in object && "content" in object)) {
      if (!getCurrentUser(socket.id)) {
        console.log(`An ${"unauthenicated user".bgYellow} attempted to DoS the server on listener "chat".`.red);
        return;
      }
      console.log(`${getCurrentUser(socket.id).username.bgBlue} attempted to DoS the server on listener "chat".`.red);
      return;
    }
    let user;
    db.find({
      token: object.token
    }, (err, docs) => {
      user = docs[0];
      const content = object.content;
      // moderate message with external server
      fetch('https://mc-filterbot.micahlt.repl.co/api/checkstring', {
        method: 'POST',
        body: content
      }).then((res) => {
        if (res.status == 200) {
          // get user room and emit message
          // console.log(`${user.username.bgBlue} says ${object.content.bgBlue} in the ${user.room.bgBlue} room`);
          io.to(user.room).emit("message", {
            username: user.username,
            profilePicture: user.pic,
            type: "text",
            content: object.content,
            id: cryptoRandomString(34)
          });
        }
      });
    });
  });

  // Disconnect , when user leave room
  socket.on("disconnect", () => {
    // * delete user from users & emit that user has left the chat
    if (!getCurrentUser(socket.id)) {
      console.log(`An ${"unauthenicated user".bgRed} disconnected`)
      return 1;
    }
    console.log(`${getCurrentUser(socket.id).username.bgBlue} left the ${getCurrentUser(socket.id).room.bgBlue} room`)
    const user = getCurrentUser(socket.id);
    if (getCurrentUser) {
      io.to(user.room).emit("message", {
        userId: "000000",
        username: "Modchat Bot",
        profilePicture: "https://pics.freeicons.io/uploads/icons/png/13314222861581065997-512.png",
        type: "text",
        content: `😥 @${user.username} left the chat 🎉`,
        id: cryptoRandomString(34)
      });
    }
    userLeave(socket.id);
  });
});
