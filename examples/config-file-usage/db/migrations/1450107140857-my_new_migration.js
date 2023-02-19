import { UserModel } from '../models/index.js'

export async function up() {
  await UserModel.create({ firstName: 'Ada' })
}

export async function down() {
  await UserModel.deleteOne({ firstName: 'Ada' })
}
