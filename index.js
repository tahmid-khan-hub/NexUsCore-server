const express = require('express')
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express()
const port = 3000


// middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zc7c13h.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


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


    const CoursesCollection = client.db("course-management").collection("courses");


    // api method
    app.post('/courses', async(req, res) =>{
      const newCourse = req.body;
      const result = await CoursesCollection.insertOne(newCourse);
      res.send(result);
    })

    app.get('/courses', async(req, res) =>{
      const result = await CoursesCollection.find().toArray();
      res.send(result);
    })

    app.put('/courses/:id', async(req, res) =>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const options = {upsert: true};
      const updateCourse = req.body;
      const updateDoc = {
        $set: updateCourse
      }
      const result = await CoursesCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    })

    app.delete('/courses/:id', async(req, res) =>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await CoursesCollection.deleteOne(query);
      res.send(result);
    })

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('course management server is cooking')
})

app.listen(port, () => {
  console.log(`course management working ${port}`)
})
