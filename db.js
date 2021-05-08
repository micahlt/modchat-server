var Datastore = require('nedb');
let db = new Datastore({
  filename: './users.db',
  autoload: true
});
db.persistence.setAutocompactionInterval(19000);

module.exports = db;