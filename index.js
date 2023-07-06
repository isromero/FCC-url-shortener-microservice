require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const dns = require('dns');
const { MongoClient } = require('mongodb');

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const client = new MongoClient(process.env.MONGO_URI);
const db = client.db("urlshortener");
const urls = db.collection("shorturl");

// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.urlencoded({ extended: true }));

app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

const ShortUrlSchema = new mongoose.Schema({
  original_url: { type: String, unique: false },
  short_url: Number
});

const urlModel = mongoose.model('shortUrl', ShortUrlSchema, "shorturl");

async function hostAsync(host) {
  return new Promise((resolve, reject) => {
    dns.lookup(host, (err, address) => {
      if(err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

app.post('/api/shorturl', async function (req, res) {
  const url = req.body.url;
  try {
    const host = new URL(url).hostname;
    await hostAsync(host);
    const existingUrl = await urlModel.findOne({ original_url: url });
    if (existingUrl) {
      // La URL original ya existe en la base de datos
      const resObj = {
        original_url: url,
        short_url: existingUrl.short_url
      };
      res.json(resObj);
    } else {
      const maxShortUrl = await urlModel.findOne({}, { short_url: 1 }, { sort: { short_url: -1 } });
      const count_url = maxShortUrl ? maxShortUrl.short_url + 1 : 1;
      const shortUrl = new urlModel({
        original_url: url,
        short_url: count_url
      });
      await shortUrl.save();
      const resObj = {
        original_url: url,
        short_url: count_url
      };
      res.json(resObj);
    }
  } catch (err) {
    res.json({ error: "Invalid URL" });
  }
});


app.get('/api/shorturl/:short_url', async function(req, res) {
  const shorturl = req.params.short_url;
  try {
    const redirect_url = await urlModel.findOne({ short_url: parseInt(shorturl) });
    if (redirect_url) {
      res.redirect(redirect_url.original_url);
    } else {
      res.status(404).json({ error: "Short URL not found" });
    }
  } catch (err) {
    res.status(500).json({ error: "An error occurred" });
  }
})


app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
