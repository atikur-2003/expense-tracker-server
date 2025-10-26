const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");

// Middleware
app.use(cors());
app.use(express.json());

// firebase admin key decoded
const decodedKey = Buffer.from(process.env.FB_ADMIN_KEY, "base64").toString(
  "utf8"
);
const serviceAccount = JSON.parse(decodedKey);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Verify Firebase Token Middleware
async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).send({ message: "unauthorized access" });

  const token = authHeader.split(" ")[1];
  try {
    const decodedUser = await admin.auth().verifyIdToken(token);
    req.user = decodedUser;
    next();
  } catch (error) {
    return res.status(403).send({ message: "Invalid or expired token" });
  }
}

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
    app.post("/incomes", async (req, res) => {
      try {
        const income = req.body;
        income.createdAt = new Date();

        const result = await incomeCollection.insertOne(income);
        const savedIncome = await incomeCollection.findOne({
          _id: result.insertedId,
        });
        res.send(savedIncome);
        res.status(201).json(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to add income" });
      }
    });

    // api to add expense
    app.post("/expenses", async (req, res) => {
      try {
        const expense = req.body;
        expense.createdAt = new Date();

        const result = await expenseCollection.insertOne(expense);
        res.status(201).json(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to add expense" });
      }
    });

    // Update income by ID
    app.put("/incomes/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedIncome = req.body;

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            source: updatedIncome.source,
            amount: Number(updatedIncome.amount),
            date: updatedIncome.date,
            icon: updatedIncome.emoji || updatedIncome.icon || "💰", // handle emoji/icon
          },
        };

        const result = await incomeCollection.updateOne(filter, updateDoc);

        if (result.modifiedCount > 0) {
          res.send({ success: true, message: "Income updated successfully" });
        } else {
          res.status(404).send({ success: false, message: "Income not found" });
        }
      } catch (error) {
        console.error("Error updating income:", error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    // Delete income by ID
    app.delete("/incomes/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await incomeCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount > 0) {
          res.send({ success: true, message: "Income deleted successfully" });
        } else {
          res.status(404).send({ success: false, message: "Income not found" });
        }
      } catch (error) {
        console.error("Error deleting income:", error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

   
    //  Get all incomes for the logged-in user
    app.get("/incomes", verifyFirebaseToken, async (req, res) => {
      try {
        const email = req.user.email;
        const incomes = await incomeCollection
          .find({ userEmail: email })
          .sort({ createdAt: -1 })
          .toArray();

        res.send(incomes);
      } catch (error) {
        console.error("Error fetching incomes:", error);
        res.status(500).send({ message: "Failed to fetch incomes" });
      }
    });

    //  Get all expenses
    app.get("/expenses", async (req, res) => {
      try {
        const result = await expenseCollection
          .find()
          .sort({ createdAt: -1 })
          .toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to fetch expenses" });
      }
    });

    // get summary of total balance, total income and total expense
    app.get("/summary", async (req, res) => {
      try {
        const [incomeSum, expenseSum] = await Promise.all([
          incomeCollection
            .aggregate([
              { $addFields: { amount: { $toDouble: "$amount" } } },
              { $group: { _id: null, total: { $sum: "$amount" } } },
            ])
            .toArray(),
          expenseCollection
            .aggregate([
              { $addFields: { amount: { $toDouble: "$amount" } } },
              { $group: { _id: null, total: { $sum: "$amount" } } },
            ])
            .toArray(),
        ]);

        const totalIncome = incomeSum[0]?.total || 0;
        const totalExpense = expenseSum[0]?.total || 0;
        const balance = totalIncome - totalExpense;

        res.send({ totalIncome, totalExpense, balance });
      } catch (error) {
        console.error("Error fetching summary:", error);
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
