const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
require("dotenv").config();
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decoded)
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = 3000;

// middleware
<<<<<<< HEAD
// middleware
app.use(
  cors({
    origin: ["https://cheery-vacherin-a489f2.netlify.app", "http://localhost:5173"],
    credentials: true,
  })
);

=======
// app.use(
//   cors({
//     origin: "http://localhost:5173/",
//     credentials: true,
//   })
// );
app.use(cors())
>>>>>>> 2f2376169efc80009b4ec7b5026fb03ccaea201d
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
    app.patch("/courses/:id", async (req, res) => {
      const id = req.params.id;
      const { enrolled } = req.body;

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { enrolled },
      };

      const result = await CoursesCollection.updateOne(filter, updateDoc);
      res.send(result);
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