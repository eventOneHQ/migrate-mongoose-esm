import { Schema, model } from 'mongoose'

// models/User.js
const UserSchema = new Schema({
  firstName: String,
  lastName: String
})

export const UserModel = model('user', UserSchema)
