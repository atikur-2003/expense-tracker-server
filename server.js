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
    const incomeCollection = db.collection("incomes");
    const expenseCollection = db.collection("expenses");

    // api to add income to database
    app.post("/income", async (req, res) => {
      try {
        const income = req.body;
        income.createdAt = new Date();

        const result = await incomeCollection.insertOne(income);
        res.status(201).json(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to add income" });
      }
    });


    // get summary of total balance, total income and total expense
    app.get("/summary", async (req, res) => {
      try {
        const [incomeSum, expenseSum] = await Promise.all([
          incomeCollection
            .aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }])
            .toArray(),
          expenseCollection
            .aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }])
            .toArray(),
        ]);

        const totalIncome = incomeSum[0]?.total || 0;
        const totalExpense = expenseSum[0]?.total || 0;

        res.send({ totalIncome, totalExpense });
      } catch (error) {
        res.status(500).send({ message: "Error fetching summary", error });
      }
    });

    // Get all transactions (income + expense)
    app.get("/transactions", async (req, res) => {
      try {
        const [incomes, expenses] = await Promise.all([
          incomeCollection.find().toArray(),
          expenseCollection.find().toArray(),
        ]);

        // Combine and sort by date descending
        const allTx = [...incomes, ...expenses].sort(
          (a, b) => new Date(b.date) - new Date(a.date)
        );

        res.send(allTx);
      } catch (error) {
        res.status(500).send({ message: "Error fetching transactions", error });
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
