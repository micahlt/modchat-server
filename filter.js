var Filter = require("bad-words") // for filtering messages
var frenchBadwords = require("french-badwords-list") // import French curse words for filtering
var moreBadwords = require("badwordspluss")
var filter = new Filter({
  placeHolder: "_",
}) // set up the filter
let removeWords = ["GOD"] // Make a list of word to be uncensored.
let addWords = [
  "WTF",
  "LMAO",
  "IMAO",
  "DISCORD",
  "DLSCORD",
  "INSTAGRAM",
  "SLACK",
  "SNAPCHAT",
  "SIACK",
  "LNSTAGRAM",
] // Any words in this list will be censored. SIACK because SIACK looks like SLACK. Same for LNSTAGRAM.
filter.addWords(...addWords) // Add those to the filter
filter.addWords(...frenchBadwords.array) // Add French curse words to the filter
filter.addWords(...moreBadwords) // Add other curse words to the filter
filter.removeWords(...removeWords) //Remove those from the filter
const test = (string) => {
  if (!filter.isProfane(string.replace(String.fromCharCode(8203), ""))) {
    return true
  } else {
    return false
  }
}
module.exports = test
