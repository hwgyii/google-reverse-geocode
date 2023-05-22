## Installation

```bash
$ npm i google-reverse-geocode
```

## Examples

Basic

```js
const { Client } = new require('google-reverse-geocode');

/**
  PARAMETERS:
    1st: GOOGLE_API_KEY = required* api key for calling google maps api;
    2nd: range = default 200, number of meters that are +- to be the range when finding reverse geocoded locations from your database;
    3rd: mongoDBConnectionString = the whole connection string needed for the mongoose module to get connected to your database;

    If there are no mongoDBConnectionString, the reverseGeoCode() function will always call google maps api for reverse geocoding
 **/
const client = new Client("<your GOOGLE_API_KEY>", 350, `mongodb+srv://<username>:<password>@<MONGO_URL_POST_FIX>`);

client.reverseGeoCode(14.602325069654146, 121.02413661450402).then(data => {
  console.log(data);
});

// Will return this object if from Google API.
{
  provider: 'Google',
  full_address: '42 E.Fernandez, Manila, Metro Manila, Philippines',
  street_number: '42',
  route: 'E.Fernandez',
  locality: 'Manila',
  administrative_area_level_1: 'Metro Manila',
  country: 'Philippines'
}

//Will return this object if there are documents in your database within the range.
{
  provider: 'Google',
  full_address: '133 F. Manalo, Batis, San Juan, 1500 Metro Manila, Philippines',
  street_number: '133',
  route: 'F. Manalo',
  political: 'Batis',
  locality: 'San Juan',
  administrative_area_level_1: 'Metro Manila',
  country: 'Philippines',
  postal_code: '1500',
  from: 'MongoDB Database',
  range: '110.11202864343689'
}