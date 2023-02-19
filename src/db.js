import { Schema } from 'mongoose'

/**
 * Migration object
 *
 * @typedef Migration
 *
 * @prop {string} name - Name of the migration
 * @prop {string} filename - Filename of the migration (`<created-date>-<name>`)
 * @prop {string} state - State of the migration (`up` or `down`)
 *
 * @example
 * {
 *   name: 'my-migration',
 *   filename: '149213223424_my-migration.js',
 *   state: 'up'
 * }
 */

/**
 * Factory function for a mongoose model
 * @param {string} [collection=migrations]
 * @param {mongoose.Connection} dbConnection
 *
 * @private
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
