const express = require('express');
const session = require('express-session');

const bcrypt = require('bcrypt');
const saltRounds = 10;

const mysql = require('mysql');
const pool=require('./dbpool.js')

const path = require('path');

require("dotenv").config();
const OpenAI = require('openai');

const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));

app.set('trust proxy', 1)
app.use(session({
  secret: "top secret!",
  resave: true,
  saveUninitialized: true,
  cookie: { secure: true }
}));

const googleAPIKey = process.env.google_API_key;

// Initialize OpenAI configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // This is also the default, can be omitted
});

// Define the path to the data folder and JSON file
const locationsPath = path.join(__dirname, 'data', 'locations.json');
const locations = require(locationsPath);


//add express middleware to parse form data
app.use(express.urlencoded({extended: true}));
app.use(express.json());

app.use(function(req, res, next) {
  res.locals.username = req.session.username;
  res.locals.loggedIn = req.session.authenticated;
  next();
});

//routes
app.get('/', (req, res) => {
  res.render('home',{googleAPIKey})
});

app.get('/itinerary-detail', (req, res) => {
  const { destination, startDate, endDate, guests } = req.query;
  res.render('itinerary', {googleAPIKey, itinerary: [], activities: []});
});


app.get('/savedItineraries', isAuthenticated, async (req, res) => {
  const sql = `SELECT * FROM itinerary WHERE userId = ?`;
  let itineraries = await executeSQL (sql, [req.session.userId]);
  // Format the dates
  itineraries = itineraries.map(itinerary => {
    return {
      ...itinerary,
      startDate: formatDate(itinerary.startDate),
      endDate: formatDate(itinerary.endDate)
    };
  });
  res.render('savedItineraries',{googleAPIKey, itineraries})
});

app.get('/itinerary-edit/:id', isAuthenticated, async (req, res) => {
  try {
    const itineraryId = req.params.id;
    let sql = 'SELECT * FROM itinerary WHERE itineraryId = ?';
    const itinerary = await executeSQL(sql, [itineraryId]);
    sql = 'SELECT * FROM activities WHERE itineraryId = ?';
    const activities = await executeSQL(sql, [itineraryId]);
    res.render('itinerary', { googleAPIKey, itinerary, activities });
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred while fetching itinerary details.');
  }
});

//process sign-up request
app.post("/user/new", async function(req, res) {
  let fName = req.body.firstName;
  let lName = req.body.lastName;
  let email = req.body.emailAddress.toLowerCase();
  let password = req.body.password;
  let verifyPassword = req.body.confirmPassword;
  let newsletterSignup = req.body.newsletterCheck;
  let subscribed = 0;
  let message = "";

  // verify passwords match
  if (password == verifyPassword) {
    // verify email address does not already exist in database
    let sql = `SELECT * FROM users WHERE emailAddress = ?`;
    let data = await executeSQL(sql, [email]);
    if (data.length > 0) {
      message = "Email address already exists! Please try again.";
    } else {
      if (newsletterSignup == "on") {
        subscribed = 1;
      }
      // generate bcrypted password
      let bcryptPassword = generateBcrypt(password);
      let sql = `INSERT INTO users (firstName, lastName, emailAddress, password, subscribed)
                    VALUES (?, ?, ?, ?, ? )`;
      let params = [fName, lName, email, bcryptPassword, subscribed];
      await executeSQL(sql, params);
      message = "Sign up successful! Please sign in. ";
    }
  } else {
    message = "Passwords do not match! Please try again. ";
  }
  res.render('home', {message, googleAPIKey});
});

// process login request
app.post("/user/login", async function(req, res) {
  let email = req.body.emailAddress.toLowerCase();
  let password = req.body.password;
  let passwordHash = "";
  let message = "";

  console.log(email);
  
  let sql = `SELECT * FROM users WHERE emailAddress = ?`;
  let data = await executeSQL(sql, [email]);

  // verify username with that email address exists
  if (data.length > 0) {
    passwordHash = data[0].password;
    const matchPassword = await bcrypt.compare(password, passwordHash);
    console.log(matchPassword);

    // verify correct password
    if (matchPassword) {
      req.session.authenticated = true;
      res.locals.loggedIn = await req.session.authenticated;
      req.session.username = data[0].firstName + " " + data[0].lastName;
      req.session.userId = data[0].userId;
      message = `Welcome back, ${req.session.username}! `;
    } else {
      message = "Incorrect Password  ";
    }
  } else {
    message = "Email address not found  ";
  }
  res.render('home', {message, googleAPIKey});
});


// log out
app.get('/logout', isAuthenticated, (req, res) => {
  req.session.authenticated = false;
  req.session.destroy();   // remove the session, including all variables
  res.redirect('/loggedOut');
});

app.get('/loggedOut', (req, res) => {
  let message = "";
  if (!req.session.authenticated) {
    message = "Logged out";
  } else {
    message = "Error Logging Out";
  }
  res.render('home', {message, googleAPIKey});
})

// user settings
app.get('/accountSettings', isAuthenticated, async (req, res) =>{
  const {userId}=req.session;
  let sql = `SELECT * FROM users WHERE userId=?`;
  let user = await executeSQL(sql, [userId]);
  res.render('accountSettings', {googleAPIKey, user});
});

app.post('/accountSettings', isAuthenticated, async (req, res) =>{
  const {userId}=req.session;
  const {firstName, lastName, mobilePhone, addressLine, postalCode, country, state} = req.body;
  let sql = `UPDATE users SET firstName=?, lastName=?, mobilePhone=?, addressLine=?, postalCode=? , country=?, state=? WHERE userId=?`;
  let user = await executeSQL(sql, [firstName, lastName, mobilePhone, addressLine, postalCode, country, state, userId]);
  sql = `SELECT * FROM users WHERE userId=?`;
  user = await executeSQL(sql, [userId]);
  res.render('accountSettings', {googleAPIKey, user});
});

//Chatbot
app.get('/chatbot', (req, res) => {
   const { destination } = req.query;
  res.render('chatbot', { googleAPIKey, destination});
});

app.post('/chatbot-response', async (req, res) => {
  const userQuery = req.body.query;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a travel assistant. Provide helpful information about travel destinations, tips, and itineraries.' },
        { role: 'user', content: userQuery },
      ],
    });

    const assistantResponse = response.choices[0].message.content;
    res.render('chatbot', { query: userQuery, response: assistantResponse, googleAPIKey: googleAPIKey });
  } catch (error) {
    console.error('Error:', error); // Log the error details
    res.render('chatbot', { query: userQuery, response: 'An error occurred while processing your request.', googleAPIKey: googleAPIKey });
  }
});

//Fetch data from to backend to frontend for Homepage endpoint
app.get('/api/locations', (req, res) => {
  res.json(locations);
});

// Save itinerary endpoint
app.post('/api/saveItinerary', async (req, res) => {
  try {
    const { destination, startDate, endDate, duration, guests } = req.body;
    // Log the received data for debugging
    console.log('Received data:', { destination, startDate, endDate, duration, guests });
    // Validate incoming data
    if (!destination || !startDate || !endDate || !duration || !guests) {
      // Log which fields are missing
      console.log('Missing fields:', {
        destination: !!destination,
        startDate: !!startDate,
        endDate: !!endDate,
        duration: !!duration,
        guests: !!guests
      });
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const sql = `INSERT INTO itinerary (destination, startDate, endDate, duration, guests, userId) VALUES (?, ?, ?, ?, ?, ?)`;
    const params = [destination, startDate, endDate, duration, guests, req.session.userId];
    const result = await executeSQL(sql, params);
    const itineraryId = result.insertId;

    res.json({ success: true, message: 'Itinerary saved successfully', itineraryId });
  } catch (error) {
    console.error('Error saving itinerary:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// Delete itinerary endpoint
app.post('/api/deleteItinerary', async (req, res) => {
  const {itineraryId} = req.body;
  let sql = `DELETE FROM itinerary WHERE itineraryId = ?;`;
  let result = await executeSQL(sql, [itineraryId]);
  res.json({ success: true, message: 'Itinerary deleted successfully' });
});

//Save activity endpoint
app.post('/api/saveActivity', async (req, res) => {
  const {itineraryId, dayId, placeId, name, address} = req.body;
  const sql = `INSERT INTO activities (itineraryId, dayId, placeId, name, address) VALUES (?, ?, ?, ?, ?)`;
  const params = [itineraryId, dayId, placeId, name, address];
  const result = await executeSQL(sql, params);
  res.json({ success: true, message: 'Activity saved successfully' });
});

//update activity endpoint
app.post('/api/deleteActivities', async (req, res) => {
  const {itineraryId} = req.body;
  let sql = `DELETE FROM activities WHERE itineraryId = ?;`;
  let result = await executeSQL(sql, [itineraryId]);
  res.json({ success: true, message: 'Activities deleted successfully' });
});

//get saved activities for itinerary endpoint
app.get('/api/savedActivities/:itineraryId', async (req, res) => {
  const { itineraryId } = req.params;
  try {
    const sql = 'SELECT * FROM activities WHERE itineraryId = ?';
    const activities = await executeSQL(sql, [itineraryId]);
    res.json({ success: true, activities });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ success: false, message: 'An error occurred while fetching activities.' });
  }
});

// check authentication status route
app.get('/api/auth/status', (req, res) => {
  res.json({
    loggedIn: req.session.authenticated || false
  });
});

// functions
async function executeSQL(sql, params) {
  return new Promise (function (resolve, reject) {
    pool.query(sql, params, function (err, rows, fields) {
      if (err) throw err;
        resolve(rows);
    });
  });
}

// plan text password -> bcrypt password
function generateBcrypt(plainTextPassword) {
  const salt = bcrypt.genSaltSync(saltRounds);
  const hash = bcrypt.hashSync(plainTextPassword, salt);
  return hash;
}

// middleware function for verifying user has been authenticated 
function isAuthenticated(req, res, next) {
  if (req.session.authenticated) {
    next();
  } else {
    res.status(401).json({
      message: "You need to sign in",
      redirectUrl: req.originalUrl,
    });
  }
}


//date format
function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = ('0' + (d.getMonth() + 1)).slice(-2); // Months are zero-based
  const day = ('0' + d.getDate()).slice(-2);
  return `${year}-${month}-${day}`;
}


//start server
app.listen(process.env.PORT || 3000, () =>{
  console.log("Expresss server running...")
});
