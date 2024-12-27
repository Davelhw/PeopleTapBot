const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const socialSchema = new Schema({
  t_id: { type: Schema.ObjectId, required: true, ref: "Item" },
  s_name: { type: String, required: true },
  s_date: { type: Date, required:true}
});

const Social = mongoose.model('Social', socialSchema)

const itemSchema = new Schema({
    // t_id: { type: String },
    // t_name: { type: String, required: true },
    // t_friend_id: {type: String},
    // mount: { type: Number, required: true }

    level_required : {type: Number, required: true},
    item_name : {type: String, required: true},
    cost : {type: Number, required: true},
    passive_income : {type: Number, required: true}
});

const Item = mongoose.model('Item', itemSchema)


const userSchema = new Schema({
  t_id: { type: String, required: true },
  t_name: { type: String, required: true },
  balance: { type: Number, default: 0 },
  earnPerTap: { type: Number, default: 1 },
  energy: { type: Number, default: 500 },
  items: {
    type: [
      {
        item_id: String,
        level: { type: Number, default: 1 },
        time_stamp: { type: Date, default: Date.now }
      }
    ],
    default: []
  },
  referalLink: { type: String },
  inviter: { type: String },
  invitees: { type: Array, default: [] },
  isPremium: { type: Boolean, default: false },
  last_login_timestamp: { type: String },
  last_daily_reward: { type: Number },
  last_daily_claim_timestamp: { type: String },
  last_hourly_reward: { type: Number },
  last_hourly_claim_timestamp: { type: String },
  social_claim: {type: Number},
  avatar: { type: String }
});

const User = mongoose.model('User', userSchema);

module.exports = { Item, Social, User }
