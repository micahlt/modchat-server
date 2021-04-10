const express = require("express");
const app = express();
const socket = require("socket.io");
const color = require("colors");
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

const io = socket(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

//everything related to io will go here
io.on("connection", (socket) => {
  //when new user join room
  socket.on("joinRoom", ({
    username,
    roomname
  }) => {
    //* create user
    if (username == "Unauthed User") {
      console.log(`An ${'unauthenicated user'.bgRed} connected on socket ${socket.id.bgBlue} in room ${roomname.bgBlue}`)
      return 1;
    }
    const user = userJoin(socket.id, username, roomname);
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