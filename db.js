var Datastore = require('nedb'); 
module.exports = new Datastore({filename: './users.db', autoload: true});
