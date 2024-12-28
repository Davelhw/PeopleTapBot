const { Bot, session, InlineKeyboard } = require("grammy");
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Item, Social, User } = require("./model.js");
const { addHours } = require("date-fns");
const jwt = require("jsonwebtoken");
const { exec } = require("child_process");
const axios = require("axios");

axios.defaults.family = 4;

const fs = require("fs");
const path = require("path");

require("dotenv").config();

// AWS S3 Configuration
// const s3 = new AWS.S3({
//   accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   region: process.env.AWS_REGION
// });

// Initialize express app
const app = express();
const port = process.env.PORT || 6001;

const botToken = process.env.BOT_TOKEN;
const bot = new Bot(botToken);
const JWT_SECRET = process.env.JWT_SECRET;  
const INVITE_SECRET = process.env.INVITE_SECRET;
const baseBotLink = "https://t.me/satoshi_x_ppl_bot";
const baseFrontendUrl = "https://tbot.manik.wtf";

const initial = () => {
  return {};
};

let inviteData = null;

bot.use(session({ initial }));

let play_url = "https://tbot.manik.wtf";

function restartServer() {
  console.log("Attempting to restart the server...");
  exec("pm2 restart satoshi-x-ppl-bot", (error, stdout, stderr) => {
    if (error) {
      console.error(`Error restarting server: ${error}`);
      return;
    }
    console.log(`Server restart output: ${stdout}`);
    if (stderr) {
      console.error(`Server restart errors: ${stderr}`);
    }
  });
}

bot.catch((err) => {
  console.error("Error in bot:", err);
  if (
    err.message.includes("Cannot read properties of null (reading 'items')")
  ) {
    console.log("Detected critical error. Restarting server...");
    restartServer();
  }
});

// Function to save profile photo locally
async function saveProfilePhotoLocally(photoUrl, userId) {
  try {
    // Download the image
    const response = await axios.get(photoUrl, { responseType: "arraybuffer" });
    const buffer = Buffer.from(response.data);

    // Save locally with a unique filename
    const uploadDir = path.join(__dirname, "uploads", "profile-photos");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `${userId}-${Date.now()}.jpg`;
    const filePath = path.join(uploadDir, filename);

    fs.writeFileSync(filePath, buffer);
    console.log("Profile photo saved locally:", filePath);

    return `/uploads/profile-photos/${filename}`; // Return relative path
  } catch (error) {
    console.error("Error saving profile photo locally:", error);
    return null;
  }
}

async function uploadProfilePhotoToS3(photoUrl, userId) {
  try {
    // Download the image from Telegram
    const response = await axios.get(photoUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);

    // Generate a unique filename
    const filename = `profile-photos/${userId}-${Date.now()}.jpg`;

    // Upload parameters
    const uploadParams = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: filename,
      Body: buffer,
      ContentType: 'image/jpeg',
      ACL: 'public-read' // Make the file publicly readable
    };

    // Upload to S3
    const uploadResult = await s3.upload(uploadParams).promise();
    return uploadResult.Location; // Return the public URL
  } catch (error) {
    console.error('Error uploading to S3:', error);
    return null;
  }
}

bot.command("start", async (ctx) => {
  const userid = ctx.from.username;
  const tgid = ctx.from.id;
  let firstname = "";
  let lastname = "";

  if (ctx.from.first_name) {
    firstname = ctx.from.first_name;
  }
  if (ctx.from.last_name) {
    lastname = ctx.from.last_name;
  }

  let avatarUrl = "";
  try {
    const userProfilePhotos = await ctx.api.getUserProfilePhotos(tgid, {
      limit: 1,
    });

    if (userProfilePhotos.total_count > 0) {
      const fileId = userProfilePhotos.photos[0][0].file_id;
      const file = await ctx.api.getFile(fileId);
      const telegramPhotoUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

      // Save locally and get the file path
      avatarUrl = await saveProfilePhotoLocally(telegramPhotoUrl, userid);

      // If saving fails, fall back to Telegram URL
      if (!avatarUrl) {
        avatarUrl = telegramPhotoUrl;
      }
    }
  } catch (error) {
    console.error("Error handling profile photo:", error);
  }

  const name = firstname + " " + lastname;
  const isPremium = ctx.from.is_premium || false;
  const referalToken = ctx.match;

  let inviterTGId = "";
  let inviteBalance = 2000;

  if (isPremium) inviteBalance = 10000;

  if (referalToken) {
    inviterTGId = await register(
      tgid,
      userid,
      name,
      isPremium,
      avatarUrl,
      inviteBalance,
      referalToken
    );
  } else {
    inviterTGId = await register(tgid, userid, name, isPremium, avatarUrl);
  }

  const token = await login(userid);
  if (!token) {
    await ctx.reply(
      "Sorry, seems like you don't have any telegram id, set your telegram id and try again."
    );
    return;
  }

  play_url = `${baseFrontendUrl}/?id=${tgid}`;
  console.log(play_url);
  const menus = new InlineKeyboard().webApp("🕹 Start", play_url).row();

  await ctx.reply(
    inviterTGId === ""
      ? `Hello, @${userid}, Welcome To People Tap Game !\nFirst Tap 2 Earn On TON.\n💰Tap - Earn - Claim💰`
      : `Hello, @${userid}, Welcome To People Tap Game !\nYou were invited by @${inviterTGId}.\nFirst Tap 2 Earn On TON.\n💰Tap - Earn - Claim💰`,
    {
      reply_markup: menus,
      parse_mode: "HTML",
    }
  );
});

bot.on("callback_query:data", async (ctx) => {
  const userid = ctx.from.username;
  const data = ctx.callbackQuery.data;

  switch (data) {
    case "howToEarn":
      const menus = new InlineKeyboard()
        .webApp("🕹 Start", play_url)
        .row()
        .url("Subscribe to the channel", `https://t.me/MagicVipClub`);
      await ctx.reply(
        "How to play VWS Worlds ⚡️\n\nFull version of the guide.\n\n💰 Tap to earn\nTap the screen and collect coins.\n\n⛏ Mine\nUpgrade cards that will give you passive income.\n\n⏰ Profit per hour\nThe exchange will work for you on its own, even when you are not in the game for 3 hours.\nThen you need to log in to the game again.\n\n📈 LVL\nThe more coins you have on your balance, the higher the level of your exchange is and the faster you can earn more coins.\n\n👥 Friends\nInvite your friends and you'll get bonuses. Help a friend move to the next leagues and you'll get even more bonuses.\n\n/help to get this guide",
        {
          reply_markup: menus,
          parse_mode: "HTML",
        }
      );
    default:
      break;
  }
});

(async () => {
  await bot.api.deleteWebhook();
  bot.start();
})();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

// MongoDB connection
const dbURI = process.env.DB_URI;
mongoose
  .connect(dbURI)
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((err) => console.log("MongoDB connection error:", err));


// Functions for registration, login, token generation, etc. remain unchanged...
const register = async (
  tgId,
  tgUserId,
  tgName,
  isPremium,
  avatarUrl,
  balance,
  inviterId
) => {
  if (!tgId) {
    console.log("Telegram ID required.");
    return "";
  }

  const user = await User.findOne({ t_id: tgId });

  if (user) {
    console.log(`An account already exists with ${tgId}`);
    return "";
  }

  let inviterTGId = "";

  if (inviterId) {
    const inviter = await User.findById(inviterId);

    if (!inviter) {
      console.log("Inviter invalid");
      return "";
    }

    if (inviter.t_id == tgId) {
      console.log(`You can't invite yourself.`);
      return "";
    }

    const currentTime = new Date();

    inviter.balance += balance;
    inviter.invitees.push({ tgId, timestamp: currentTime });
    await inviter.save();

    inviterTGId = inviter.t_id;
  }

  try {
    const newUser = new User({
      t_id: tgUserId,
      tg_numeric_id: tgId,
      t_name: tgName,
      balance,
      inviter: inviterId,
      isPremium,
    });
    await newUser.save();

    const referalLink = baseBotLink + "?start=" + newUser.id;

    newUser.referalLink = referalLink;
    newUser.avatar = avatarUrl;
    await newUser.save();

    console.log("Successfully registered");
    return inviterTGId;
  } catch (error) {
    console.log("Error in register");
    return "";
  }
};

const login = async (tgId) => {
  if (!tgId) {
    console.log("Telegram ID required.");
    return null;
  }

  const user = await User.findOne({ t_id: tgId });

  if (!user) {
    console.log("Unregistered User");
    return null;
  }

  const currentTime = new Date();
  const passiveIncomePerHour = await calculatePassiveIncome(user.items);
  let roundedHours = 0;
  let totalPassiveIncome = 0;

  if (user.last_login_timestamp) {
    const lastLoginTime = new Date(user.last_login_timestamp);
    const hours = (currentTime - lastLoginTime) / 3600000;
    roundedHours = Math.floor(hours * 10) / 10;

    if (roundedHours >= 1) {
      totalPassiveIncome = Math.floor(passiveIncomePerHour * roundedHours);
      user.balance += totalPassiveIncome;
      user.last_login_timestamp = currentTime;
    }
  } else {
    user.last_login_timestamp = currentTime;
  }

  await user.save();

  const token = signToken({ userId: user.id });

  return token;
};

const signToken = (payload = {}, expiresIn = "12h") => {
  const token = jwt.sign(payload, JWT_SECRET);
  return token;
};

const inviteToken = (payload = {}) => {
  const token = jwt.sign(payload, INVITE_SECRET);
  return token;
};

const getUserLevel = (balance) => {
  const levels = [
    { level: 1, name: "Newbie", balance: 0 },
    { level: 2, name: "Explorer", balance: 2500 },
    { level: 3, name: "Adventurer", balance: 7500 },
    { level: 4, name: "Challenger", balance: 15000 },
    { level: 5, name: "Bronze", balance: 30000 },
    { level: 6, name: "Silver", balance: 50000 },
    { level: 7, name: "Gold", balance: 100000 },
    { level: 8, name: "Platinum", balance: 250000 },
    { level: 9, name: "Diamond", balance: 500000 },
    { level: 10, name: "Champion", balance: 1000000 },
    { level: 11, name: "Hero", balance: 2000000 },
    { level: 12, name: "Epic", balance: 5000000 },
    { level: 13, name: "Mythic", balance: 10000000 },
    { level: 14, name: "Legendary", balance: 20000000 },
    { level: 15, name: "Master", balance: 30000000 },
    { level: 16, name: "Grandmaster", balance: 50000000 },
    { level: 17, name: "Overlord", balance: 75000000 },
    { level: 18, name: "Titan", balance: 100000000 },
    { level: 19, name: "Immortal", balance: 150000000 },
    { level: 20, name: "Supreme", balance: 200000000 },
  ];

  for (let i = levels.length - 1; i >= 0; i--) {
    if (balance >= levels[i].balance) {
      return levels[i].level;
    }
  }
  return 0;
};

const calculatePassiveIncome = async (items) => {
  if (!items || !Array.isArray(items)) {
    console.log("Invalid items array");
    return 0;
  }

  let totalPassiveIncomePerHour = 0;

  const passiveIncomePromises = items.map(async (item) => {
    const itemId = item.item_id;
    const item_db = await Item.findById(itemId);
    return item_db ? item_db.passive_income : 0;
  });

  const passiveIncomes = await Promise.all(passiveIncomePromises);

  passiveIncomes.forEach((passiveIncomePerHour) => {
    totalPassiveIncomePerHour += passiveIncomePerHour;
  });

  return totalPassiveIncomePerHour;
};
// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

