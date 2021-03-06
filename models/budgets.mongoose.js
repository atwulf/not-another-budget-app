/**
 * Budgets Model
 */

// deps
const db = require('mongoose')
const Schema = db.Schema

// create schema
const budgetsSchema = new Schema({
  category: String,
  amount: Number
})

// register model with schema
const B = db.model('budgets', budgetsSchema)

// create a few
// [
//   { category: 'Other Travel', amount: 200 },
//   { category: 'Merchandise', amount: 20 }
// ].map(function(bg) {
//   B.create(bg, function(err, b) {
//     if (err) console.log(err)
//   })
// })
