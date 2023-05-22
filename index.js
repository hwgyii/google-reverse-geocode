const axios = require("axios");
const mongoose = require("mongoose");
const { isEmpty } = require("lodash");

const DATA_SCHEMA = new mongoose.Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  data: { type: Object, required: true },
}, {timestamps: true, versionKey: false});

const DATA = mongoose.model("Data", DATA_SCHEMA);

class Client {
  /**
  Parameters: 
    GOOGLE_API_KEY = required* api key for calling google maps api;
    range = default 200, number of meters that are +- to be the range when finding reverse geocoded locations from your database;
    mongoDBConnectionString = the whole connection string needed for the mongoose module to get connected to your database;

    If there are no mongoDBConnectionString, the reverseGeoCode() function will always call google maps api for reverse geocoding.
  **/
  constructor(GOOGLE_API_KEY=undefined, range=200, mongoDBConnectionString=undefined) {
    this.GOOGLE_API_KEY = GOOGLE_API_KEY;
    this.range = range;
    this.connectionString = mongoDBConnectionString;

    if (this.connectionString !== undefined) this.startDB();
  }

  //@ Function for starting the Database connection.
  startDB = async () => {
    //@ Connection options for the database
    const connectionOptions = {
      useUnifiedTopology: true,
      useNewUrlParser: true,
    }
    
    await mongoose.connect(this.connectionString, connectionOptions);
  };
  

  reverseGeoCode = async (latitude, longitude) => {
    try {
      // FUNCTION FOR THE API CALL FOR GETTING DATA FROM GOOGLE MAPS API
      const getReverseGeoCode = async () => {
        try {
          const result = await axios.get("https://maps.googleapis.com/maps/api/geocode/json", {
            params: {
              latlng: `${latitude.toString()},${longitude.toString()}`,
              key: this.GOOGLE_API_KEY
            }
          });
          
          // PARSING THE DATA.
          const addressComponent = result.data.results[0].address_components;
          const addressObject = {
            provider: "Google",
            full_address:  result.data.results[0].formatted_address,
          };
          for (let i = 0; i < addressComponent.length; i ++) addressObject[addressComponent[i].types[0]] = addressComponent[i].long_name;
          
          return addressObject;
        } catch (error) {
          console.log(error);
        }
      };

      // If user does not define mongodb connection, package always call google maps api.
      if(this.connectionString === undefined) return await getReverseGeoCode();

      // Else, package try to see if there are exact coordinates saved in db.
      const exact = await DATA.findOne({ latitude, longitude });

      // If there are not exact coordinates in the db, package will compute for the given range and see if there are documents in the db that is in the range.
      // Then if there are, the package computes the document that is nearest to the given coordinates then returns its data.
      // If there aren't, the package will call google maps api then save that to db and then returns the data from google maps api.
      // If there are exact coordinates in the db, the package will return that.
      if (isEmpty(exact)) {
        const { cos, PI, sin, asin, sqrt } = Math;
        const EARTH_RADIUS = 6372.8;
        
        //@ Reference: https://stackoverflow.com/questions/7477003/calculating-new-longitude-latitude-from-old-n-meters
        const meters = (1 / ((2 * PI / 360) * EARTH_RADIUS)) / 1000;

        const lower_lat = latitude - (this.range * meters);
        const lower_long = longitude - (this.range * meters) / cos(latitude * (PI / 180));
        const higher_lat = latitude + (this.range * meters);
        const higher_long = longitude + (this.range * meters) / cos(latitude * (PI / 180));

        const findOptions = {
          $and: [
            { latitude: { $gte: lower_lat } },
            { latitude: { $lte: higher_lat } },
            { longitude: { $gte: lower_long } },
            { longitude: { $lte: higher_long } },
          ]
        };

        const onRangeCoords = await DATA.find( findOptions );

        if (isEmpty(onRangeCoords)) {
          const addressObject = await getReverseGeoCode();

          const toSave = {
            latitude,
            longitude,
            data: addressObject,
          }

          await new DATA( toSave ).save();

          return addressObject;
        } else {
          //FIND THE NEAREST NEIGHBOR DATA FROM DB
          //THEN RETURN THAT

          //HAVERSINE FORMULA: is an equation important in navigation, giving great-circle distances between two points on a sphere from their longitudes and latitudes. https://rosettacode.org/wiki/Haversine_formula
          let haversine = (lat1, long1, lat2, long2) => {
            let dLat = ((lat2 / 180) * PI) - ((lat1 / 180) * PI);
            let dLong = ((long2 / 180) * PI) - ((long1 / 180) * PI);
            let a = sin(dLat / 2) * sin(dLat / 2) + sin(dLong / 2) * sin(dLong /2) * cos(lat1) * cos(lat2);
            let c = 2 * asin(sqrt(a));
            return EARTH_RADIUS * c;
          };

          let leastDistance = Infinity;
          let index = -1;

          onRangeCoords.forEach((data, i) => {
            let distance = haversine(latitude, longitude, data.latitude, data.longitude);

            if (distance < leastDistance) {
              leastDistance = distance;
              index = i;
            }
          });

          onRangeCoords[index].data["from"] = "MongoDB Database";
          onRangeCoords[index].data["range"] = leastDistance * 1000;
          return onRangeCoords[index].data;
        }
      } else {
        exact.data["from"] = "MongoDB Database";
        exact.data["range"] = 0;
        return exact.data;
      }
    } catch (error) {
      console.log(error);
    }
  }
}

module.exports = {
  Client
}