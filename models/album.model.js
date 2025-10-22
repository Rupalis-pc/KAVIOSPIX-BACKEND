const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const albumSchema = new mongoose.Schema({
  albumId: {
    type: String,
    default: uuidv4,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  ownerId: {
    type: String, // userId from Google
    required: true,
  },
  sharedUsers: {
    type: [String], // list of user emails
    default: [],
  },
});

const Album = mongoose.model("Album", albumSchema);
module.exports = Album;
