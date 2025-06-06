const express = require('express')
const app = express()
const port = 3000

app.get('/', (req, res) => {
  res.send('course management server is cooking')
})

app.listen(port, () => {
  console.log(`course management working ${port}`)
})
