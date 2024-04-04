const express = require('express');
const sql = require('mssql');

const app = express();

const config = {
  user: 'hikmaadmin',
  password: 'hikma@123',
  server: 'dbweatherserver.database.windows.net',
  database: 'realtime_weather_db',
  options: {
    encrypt: true
  }
};

const port = process.env.PORT || 3000;

sql.connect(config)
.then(pool => {
  console.log('Connected to Azure SQL DB');
})
.catch(err => {
  console.error('Database connection failed: ',err);
});

// Function to generate random values for temperature, humidity, and air pressure
function generateWeatherData() {
  const temperature = (Math.random() * (40 - 10) + 10).toFixed(2); // Random temperature between 10 and 40
  const humidity = (Math.random() * (100 - 20) + 20).toFixed(2); // Random humidity between 20 and 100
  const airPressure = (Math.random() * (1100 - 900) + 900).toFixed(2); // Random air pressure between 900 and 1100
  return { temperature, humidity, airPressure };
}

// Function to insert weather data into the database for a specific district
async function insertWeatherDataForDistrict(district) {
  try {
    // Connect to the database
    const pool = await sql.connect(config);

    // Generate random weather data
    const weatherData = generateWeatherData();

    // Update the status of previous data for this district to 0
    await pool.request()
      .input('district', sql.NVarChar, district)
      .query('UPDATE districts SET status = 0 WHERE name = @district AND status = 1');


    // Insert the generated data into the database for the specified district
    await pool.request()
      .input('district', sql.NVarChar, district)
      .input('temperature', sql.VarChar, weatherData.temperature.toString())
      .input('humidity', sql.VarChar, weatherData.humidity.toString())
      .input('airPressure', sql.VarChar, weatherData.airPressure.toString())
      .query('INSERT INTO districts (name, temperature, humidity, air_pressure, status) VALUES (@district, @temperature, @humidity, @airPressure, 1)');
    
    console.log(`Weather data updated successfully for district: ${district}`);
  } catch (error) {
    console.error(`Error updating data for district ${district}:`, error.message);
  }
}


// Function to update weather data for all districts
async function updateWeatherDataForAllDistricts() {
  try {
    // Connect to the database
    const pool = await sql.connect(config);
    
    // Query all districts from the database
    const result = await pool.request().query('SELECT name FROM districts');
    
    // Close the database connection
    await sql.close();

    // Iterate over each district and update weather data
    for (const district of result.recordset) {
      await insertWeatherDataForDistrict(district.name);
    }
  } catch (error) {
    console.error('Error updating weather data for all districts:', error.message);
  }
}

// Schedule the weather data update to run every 5 minutes
setInterval(updateWeatherDataForAllDistricts, 5 * 60 * 1000);


//Endpoint to get all data
app.get('/weather', async (req, res) => {
  try {
    // Connect to the database
    await sql.connect(config);

    // Query to select all data from the weather table
    const result = await sql.query`SELECT * FROM districts`;

    // Close the database connection
    await sql.close();

    // Send the data as JSON in the response
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching data:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to fetch data from the weather table based on district
app.get('/weather/:district', async (req, res) => {
  const district = req.params.district;
  try {
    // Connect to the database
    await sql.connect(config);

    // Query to select data from the weather table based on district
    const result = await sql.query`SELECT * FROM districts WHERE name = ${district} AND status = 1;`;

    // Close the database connection
    await sql.close();

    // Send the data as JSON in the response
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching data:', error.message);
    res.status(500).send('Internal Server Error');
  }
});



app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});