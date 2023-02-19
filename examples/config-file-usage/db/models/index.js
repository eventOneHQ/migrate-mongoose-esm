import { connect } from 'mongoose'
import { UserModel } from './user.model.js'

await connect('mongodb://localhost:27017/mydb')

export { UserModel }
