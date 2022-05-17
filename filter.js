var Filter = require("badwords-filter") // for filtering messages
var frenchBadwords = require("french-badwords-list") // import French curse words for filtering
var moreBadwords = require("badwordspluss")
let addWords = [
  "wtf",
  "lmao",
  "imao",
  "discord",
  "dlscord",
  "instagram",
  "slack",
  "snapchat",
  "siack",
  "lnstagram"
]
addWords.push.apply(addWords, frenchBadwords.array) // Add French curse words to the filter
addWords.push.apply(addWords, moreBadwords) // Add other curse words to the filter
let removeWords = ["god", "youd", "you'd"]

addWords = addWords.filter(function (word) {
  return removeWords.indexOf(word) < 0 ? word : null
})

const emojiBlacklist = ["🍆", "🖕", "🍑", "🍌", ":middle_finger:", ":fu:", ":peach:", ":eggplant:", ":banana:"]

const filter = new Filter({
  list: addWords,
})

const massIncludes = (string, array) => {
  let doesInclude = false
  array.every((item) => {
    if (string.includes(item)) {
      doesInclude = true
      return false
    } else {
      return true
    }
  })
  return doesInclude
}

const test = (string) => {
  if (
    filter.isUnclean(string.replace(String.fromCharCode(8203), "")) === true ||
    massIncludes(string, emojiBlacklist)
  ) {
    return true
  } else {
    return false
  }
}

module.exports = test
