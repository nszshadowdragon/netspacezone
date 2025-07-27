// testConnection.js
const { MongoClient, ServerApiVersion } = require('mongodb');

const uri =
  "mongodb+srv://netspaceoc:sYiJs.cvu%23E%216Df@nsz.szp1eag.mongodb.net/netspacezone?retryWrites=true&w=majority&appName=NSZ";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("✅ Successfully connected to MongoDB!");
  } finally {
    await client.close();
  }
}

run().catch(err => {
  console.error("❌ Connection test failed:", err);
});
