# Dependencies

## Why does Modchat use dependencies?

Modchat uses many dependencies in Node.JS for ease of use and to add features. In development, dependencies are always trying to be updated or being completely removed. That being said, Modchat still uses dependencies to make development a lot more accessible and because it reduces a lot of work needed to be done.

## Dependency List (excludes profanity)
20 dependencies in total:
- [badwords-filter](https://github.com/3chospirits/badwords-filter) is used to moderate profanity (0 dependencies)
- [bcrypt.js](https://github.com/dcodeIO/bcrypt.js) is used for password hashing (0 dependencies)
- [expressjs](https://github.com/expressjs/express) is used for the server and endpoints (48 dependencies. We could use something like [ServerFire](https://github.com/AmazingMech2418/ServerFire) (0 dependencies) but there's no reason to atm)
- [body-parser (express)](https://github.com/expressjs/body-parser) is used to parse JSON requests (24 dependencies)
- [cookie-parser (express)](https://github.com/expressjs/cookie-parser) is used to parse cookies (12 dependencies)
- [cors (express)](https://github.com/expressjs/cors) is used to enable cors for security (8 dependencies)
- [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) is used to rate limit Express requests (19 dependencies)
- [helmetjs](https://github.com/helmetjs/helmet) is used to set secure HTTP headers (14 dependencies)
- [hpp](https://github.com/analog-nico/hpp) is used to prevent parameter pollution in Express (17 dependencies)
- [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) is used to secure refresh tokens (19 dependencies, may no longer be needed)
- [mongoose](https://github.com/Automattic/mongoose) is used to connect to MongoDB with better features than the native MongoDB wrapper (45 dependencies)
- [node-fetch](https://github.com/node-fetch/node-fetch) is used to bring the fetch API to NodeJS (19 dependencies, no longer needed if using Node V18 or beyond)
- [nodemon](https://github.com/remy/nodemon) is used in the DEVELOPMENT stage to test the server (21 dependencies)
- [prettier](https://github.com/prettier/prettier) is used in the DEVELOPMENT stage to clean JS files (114 dependencies)
- [socketio](https://github.com/socketio/socket.io) is used for all chatting elements with better features than plain WebSockets (19 dependencies)
- [toobusy](https://github.com/VinayaSathyanarayana/node-toobusy) is used to tell the client if ModChat is too busy (3 dependencies)
- [varint](https://github.com/chrisdickinson/varint) is used to generate automute data (1 dependency)
- [varstruct](https://github.com/varstruct/varstruct) is used to generate automute data (6 dependencies)