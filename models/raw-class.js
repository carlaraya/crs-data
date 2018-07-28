let mongoose = require('mongoose')

let rawClassSchema = new mongoose.Schema({
  html: String
})

module.exports = mongoose.model('rawClass', rawClassSchema)
