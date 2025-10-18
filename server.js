const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

// Middleware
app.use(cors());
app.use(express.json());

// database connection
const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("Expense_Tracker_DB");
    const incomesCollection = db.collection("incomes");

    // api to add income to database
    app.post("/income", async (req, res) => {
      try {
        const income = req.body;
        income.createdAt = new Date();

        const result = await incomesCollection.insertOne(income);
        res.status(201).json(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to add income" });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Expense tracker server");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
