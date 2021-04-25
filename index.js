const express = require("express");
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const fetch = require('node-fetch');
app.use(bodyParser.json());
app.use(cors());
let base64 = require('base-64');
const socket = require("socket.io");
const io = socket(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const color = require("colors");
let db = require('./db');
const cryptoRandomString = require("crypto-random-string");
const {
  getCurrentUser,
  userLeave,
  userJoin
} = require("./user");

const port = process.env.PORT || 8000;

var server = app.listen(
  port,
  console.log(
    `Server is running on port ${process.env.PORT || 8000}.`
    .yellow.bold
  )
);

app.post('/api/soa2code', (req, res) => {
  if (req.body.code && req.body.state) {
    console.log('Passed checks'.green + ': ' + JSON.stringify(req.body));
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
      console.log(`1st request JSON: `, json)
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
          console.log('Got access code', newResJson)
          if (newResJson.user_id) {
            newResJson.session = cryptoRandomString(46);
            console.log('Adding user to DB');
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
                console.log(newResJson.session)
              } else {
                db.insert({
                  username: newResJson.user_name,
                  token: newResJson.session,
                  status: 'offline'
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
    console.log('Missing code, state, or both'.red);
    res.sendStatus(400);
  }
})

app.post('/api/updatepassword', (req, res) => {
  if (req.body.token && req.body.password) {
    console.log('Passed checks'.green + ': ' + JSON.stringify(req.body));
    db.findOne({
      token: req.body.token
    }, (err, doc) => {
      if ((!doc) || err) {
        console.log(`Couldn't find a valid user`.red);
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
          }
        })
      }
    })
  } else {
    console.log('Missing token, password, or both'.red);
    console.log(req.body)
    res.sendStatus(400);
  }
})

//everything related to socketio will go here
io.on("connection", (socket) => {
  console.log('new connection')
  socket.on('authenticate', () => {
    console.log('HEY WE AUTHED');
  })
  //when new user join room
  socket.on("joinRoom", ({
    username,
    roomname,
    token
  }) => {
    //* create user
    /*
    if (username == "Unauthed User") {
      console.log(`An ${'unauthenicated user'.bgRed} connected on socket ${socket.id.bgBlue} in room ${roomname.bgBlue}`)
      return 1;
    } */
    const user = userJoin(socket.id, username, roomname, token);
    socket.join(roomname);
    console.log(`${username.bgBlue} connected on socket ${socket.id.bgBlue} in room ${roomname.bgBlue}`);
    //* Broadcast message to everyone except user that he has joined
    io.to(roomname).emit("message", {
      userId: "000000",
      username: "Modchat Bot",
      profilePicture: "https://pics.freeicons.io/uploads/icons/png/13314222861581065997-512.png",
      type: 'text',
      content: `🎉 @${username} has joined the chat 🎉`,
      id: cryptoRandomString(34)
    });
  });

  //when somebody send text
  socket.on("chat", (object) => {
    //* get user room and emit message
    if (!getCurrentUser(socket.id)) {
      console.log('WARNING:'.bgRed + ' unauthenicated user attempting to send messages!'.red)
      return 1;
    }
    if (getCurrentUser(socket.id).token != object.token) {
      return 1;
      console.log('WARNING:'.bgRed + ' unauthenicated user attempting to masquerade as someone else!'.red)
    }
    const user = getCurrentUser(socket.id);
    console.log(`${user.username.bgBlue} says ${object.content.bgBlue} in the ${user.room.bgBlue} room`);
    io.to(user.room).emit("message", {
      username: user.username,
      profilePicture: user.pic,
      type: 'text',
      content: object.content,
      id: cryptoRandomString(34)
    });
  });

  // Disconnect , when user leave room
  socket.on("disconnect", () => {
    // * delete user from users & emit that user has left the chat
    if (!getCurrentUser(socket.id)) {
      console.log(`An ${'unauthenicated user'.bgRed} disconnected`)
      return 1;
    }
    console.log(`${getCurrentUser(socket.id).username.bgBlue} left the ${getCurrentUser(socket.id).room.bgBlue} room`)
    const user = getCurrentUser(socket.id);
    if (getCurrentUser) {
      io.to(user.room).emit("message", {
        userId: "000000",
        username: "Modchat Bot",
        profilePicture: "https://pics.freeicons.io/uploads/icons/png/13314222861581065997-512.png",
        type: 'text',
        content: `😥 @${user.username} left the chat 🎉`,
        id: cryptoRandomString(34)
      });
    }
    userLeave(socket.id);
  });
});