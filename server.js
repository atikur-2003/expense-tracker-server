const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// Middleware
app.use(express.json());
app.use(cors());

// database connection
const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASS}@cluster0.g93sy5b.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    // await client.connect();

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
        const savedExpense = await expenseCollection.findOne({
          _id: result.insertedId,
        });
        res.send(savedExpense);
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
            icon: updatedIncome.emoji || updatedIncome.icon || "💰",
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


    // Update expense by ID
    app.put("/expenses/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedExpense = req.body;

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            source: updatedExpense.source,
            amount: Number(updatedExpense.amount),
            date: updatedExpense.date,
            icon: updatedExpense.emoji || updatedExpense.icon || "💰", 
          },
        };

        const result = await expenseCollection.updateOne(filter, updateDoc);

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

    //  Get all incomes for the logged-in user
    app.get("/incomes", async (req, res) => {
      try {
        const email = req.query.email;
        const filter = email ? { userEmail: email } : {};
        const income = await incomeCollection
          .find(filter)
          .sort({ createdAt: 1 })
          .toArray();

        res.send(income);
      } catch (error) {
        console.error("Error fetching incomes:", error);
        res.status(500).send({ message: "Failed to fetch incomes" });
      }
    });

    //  Get all expenses
    app.get("/expenses", async (req, res) => {
      try {
        const email = req.query.email;
        const filter = email ? { userEmail: email } : {};
        const expense = await expenseCollection
          .find(filter)
          .sort({ createdAt: 1 })
          .toArray();
        res.send(expense);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to fetch expenses" });
      }
    });

    // get summary of total balance, total income and total expense
    app.get("/summary", async (req, res) => {
      try {
        const email = req.query.email?.toLowerCase();
        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }

        const filter = { userEmail: email };

        const [incomeSum, expenseSum] = await Promise.all([
          incomeCollection
            .aggregate([
              { $match: filter },
              { $addFields: { amount: { $toDouble: "$amount" } } },
              { $group: { _id: null, total: { $sum: "$amount" } } },
            ])
            .toArray(),
          expenseCollection
            .aggregate([
              { $match: filter },
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
        const email = req.query.email?.toLowerCase();
        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }

        const filter = { userEmail: email };

        const [incomes, expenses] = await Promise.all([
          incomeCollection.find(filter).sort({ date: -1 }).toArray(),
          expenseCollection.find(filter).sort({ date: -1 }).toArray(),
        ]);

        // Combine and sort by date descending
        const allTx = [...incomes, ...expenses].sort(
          (a, b) => new Date(b.date) - new Date(a.date)
        );

        res.send(allTx);
      } catch (error) {
        console.error("Error fetching transactions:", error);
        res.status(500).send({ message: "Error fetching transactions", error });
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


    // Delete expense by ID
    app.delete("/expenses/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await expenseCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount > 0) {
          res.send({ success: true, message: "Expense deleted successfully" });
        } else {
          res.status(404).send({ success: false, message: "Expense not found" });
        }
      } catch (error) {
        console.error("Error deleting Expense:", error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
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
