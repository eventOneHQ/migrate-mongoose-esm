import { Schema } from 'mongoose'

/**
 * Factory function for a mongoose model
 * @param {string} collection
 * @param {*} dbConnection
 */
export function MigrationModelFactory(collection = 'migrations', dbConnection) {
  const MigrationSchema = new Schema(
    {
      name: String,
      createdAt: Date,
      state: {
        type: String,
        enum: ['down', 'up'],
        default: 'down'
      }
    },
    {
      collection,
      toJSON: {
        virtuals: true,
        transform: function (doc, ret, options) {
          delete ret._id
          delete ret.id
          delete ret.__v
          return ret
        }
      }
    }
  )

  MigrationSchema.virtual('filename').get(function () {
    return `${this.createdAt.getTime()}-${this.name}.js`
  })

  dbConnection.on('error', (err) => {
    console.error(`MongoDB Connection Error: ${err}`)
  })

  return dbConnection.model(collection, MigrationSchema)
}
