require("dotenv").config();
const express = require("express");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const admin = require("firebase-admin");
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decoded)
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = 3000;

// middleware
app.use(
  cors({
    origin: ["https://dancing-paprenjak-69a983.netlify.app", "http://localhost:5173", "https://nexuscore-dev.netlify.app"],
    credentials: true,
  })
);
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zc7c13h.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const verfiyFirebaseToken = async(req, res, next) =>{
  const AuthHeader = req.headers?.authorization;
  if(!AuthHeader || !AuthHeader.startsWith('Bearer ')){
    return res.status(401).send({message: 'unauthorized access'})
  }
  const token = AuthHeader.split(' ')[1];

  try{
    const decoded = await admin.auth().verifyIdToken(token)
    console.log('decoded token---------------------', decoded);
    req.decoded = decoded;
    next()
  }
  catch(error){
    return res.status(401).send({message: 'unauthorized access'})
  }
}

const verifyTokenEmail = (req, res, next) =>{
  if(req.query.email !== req.decoded.email){
    return res.status(403).send({message: 'forbidden access'})
  }
  next()
}


async function run() {
  try {
    // await client.connect();

    const CoursesCollection = client
      .db("CourseDB")
      .collection("courses");
    const UsersEnrolledCourses = client
      .db("CourseDB")
      .collection("userCourses");
    const UsersCollection = client
      .db("CourseDB")
      .collection("users")
    const feedbackCollection = client
      .db("CourseDB")
      .collection("feedback")


    // users
    app.get("/users/email/:email", async (req, res) => {
      const email = req.params.email;
      try {
        const user = await UsersCollection.findOne({ email: email });
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        res.json(user);
      } catch (err) {
        res.status(500).json({ message: "Server error", error: err });
      }
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = await UsersCollection.findOne({ email: email });
      res.send(user);
    });

    app.post("/users", async(req, res) => {
      const user = req.body;

      const existingUser = await UsersCollection.findOne({ email: user.email });
      if (existingUser) {
        return res.status(409).json({ message: "User already exists" });
      }
      const result = await UsersCollection.insertOne(user);
      res.send(result);
    })

    app.put("/users/update/:email", async(req, res) => {
      const email = req.params.email;
      const { name, photoURL } = req.body;

      const result = await UsersCollection.updateOne(
        { email },
        {
          $set: {
            name,
            photoURL,
            updatedAt: new Date(),
          },
        }
      );

      if (result.modifiedCount > 0) {
        return res.status(200).send({ message: "Updated" });
      } else {
        return res.status(400).send({ message: "Nothing updated" });
      }
    })

    // api method for feedback
    app.post("/feedback", async (req, res) => {
      const feedback = req.body;
      const result = await feedbackCollection.insertOne(feedback);
      res.send(result);
    });

    app.get("/feedback", async(req, res) => {
      const result = await feedbackCollection.find().toArray();
      res.send(result);
    })

    app.delete("/feedback/:id", async (req, res) => {
      const id = req.params.id;
      const result = await feedbackCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // api method for course collections
    app.post("/courses", verfiyFirebaseToken, verifyTokenEmail,  async (req, res) => {
      const newCourse = req.body;
      const email = req.query.email;
      const result = await CoursesCollection.insertOne(newCourse);
      res.send(result);
    });

    app.get("/courses", async (req, res) => {
      const result = await CoursesCollection.find().toArray();
      res.send(result);
    });

    app.put("/courses/:id", verfiyFirebaseToken, verifyTokenEmail, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateCourse = req.body;
      const updateDoc = {
        $set: updateCourse,
      };
      const result = await CoursesCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    app.delete("/courses/:id", verfiyFirebaseToken, verifyTokenEmail, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await CoursesCollection.deleteOne(query);
      res.send(result);
    });

    // api method for UsersEnrolled courses
    app.post("/userCourses", async (req, res) => {
      const userCourse = req.body;
      const { email, courseId } = userCourse;
       const enrolledCount = await UsersEnrolledCourses.countDocuments({ email });
       if(enrolledCount < 3){
          const result = await UsersEnrolledCourses.insertOne(userCourse);
          res.send(result);
       }
    });

    app.get("/userCourses", async (req, res) => {
      const result = await UsersEnrolledCourses.find().toArray();
      res.send(result);
    });

    app.get("/userCourses/check", async (req, res) => {
      const { courseId, email } = req.query;
      const result = await UsersEnrolledCourses.findOne({ courseId, email });
      res.json({ enrolled: !!result });
    });

    // enrollment add and remove
    // app.patch("/courses/:id", async (req, res) => {
    //   const id = req.params.id;
    //   const { enrolled } = req.body;

    //   const filter = { _id: new ObjectId(id) };
    //   const updateDoc = {
    //     $set: { enrolled },
    //   };

    //   const result = await CoursesCollection.updateOne(filter, updateDoc);
    //   res.send(result);
    // });

    app.patch("/courses/enroll/:id", async (req, res) => {
      try {
        const { id } = req.params;
        console.log("Incoming courseId:", id);

        const objectId = new ObjectId(id);
        console.log("Converted ObjectId:", objectId);

        const found = await CoursesCollection.findOne({ _id: objectId });
        console.log("Found course in DB:", found);

        if (!found) {
          return res.status(404).json({ error: "Course not found" });
        }

        const result = await CoursesCollection.updateOne(
          { _id: objectId },
          { $inc: { enrolled: 1 } }
        );

        console.log("Update result:", result);
        res.send(result);
      } catch (error) {
        console.error("Error updating course enrollment:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.patch("/courses/:id/unenroll", verfiyFirebaseToken, verifyTokenEmail, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $inc: { enrolled: -1 },
      };
      const result = await CoursesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });


    app.get("/userCoursesCount", async (req, res) => {
      const { email } = req.query;
      const count = await UsersEnrolledCourses.countDocuments({ email });
      res.send({ count });
    });




    app.delete("/userCourses/:email/:courseId", async (req, res) => {
      const { email, courseId } = req.params;
      const result = await UsersEnrolledCourses.deleteOne({
        email: email,
        courseId: courseId,
      });
      res.send(result);
    });

    app.delete("/userCourses/:id", verfiyFirebaseToken, verifyTokenEmail, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await UsersEnrolledCourses.deleteOne(query);
      res.send(result);
    });


    // payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { email, price } = req.body;

      try {
        // Convert Taka to poisha
        const amountInPoisha = Math.round(price * 100);

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountInPoisha,
          currency: "bdt",
          metadata: { email },
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        console.error("Payment error:", error);
        res.status(500).json({ error: "Payment initiation failed" });
      }
    });


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
  res.send("course management server is cooking");
});

app.listen(port, () => {
  console.log(`course management working ${port}`);
});