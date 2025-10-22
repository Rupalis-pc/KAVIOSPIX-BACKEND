const mongoose = require("mongoose");
require("dotenv").config();

const mongoUri = process.env.MONGODB;

async function initialiseDatabase() {
  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to the Database.");
  } catch (error) {
    console.error("Error connecting to the Database.", error);
  }
}

module.exports =  {initialiseDatabase} ;
