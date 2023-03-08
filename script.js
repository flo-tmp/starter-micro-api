const {Client} = require("@googlemaps/google-maps-services-js");
const { GoogleSpreadsheet } = require('google-spreadsheet');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc')
dayjs.extend(utc)
require('dayjs/locale/fr');

const conf = {
  destination: {
    name: 'Esker',
    placeId: 'place_id:ChIJlyjGPpHq9EcRci0IZ8Aa_Rw'
  },
  origins: [
    {
      name: 'Beynost',
      placeId: 'place_id:ChIJsd1H7Rq59EcRA9yuP0D38fs'
    },
    {
      name: 'Meyzieu',
      placeId: 'place_id:ChIJH6mROQnH9EcRIeXqAObPNKo'
    },
    {
      name: 'Jonage',
      placeId: 'place_id:ChIJYWOITgK49EcRcRoIOyzL8A8'
    },
    {
      name: 'Miribel',
      placeId: 'place_id:ChIJKTNATuW-9EcRgArC5CqrCAQ'
    },
    {
      name: 'La Boisse',
      placeId: 'place_id:ChIJLRFeJ6O59EcR4BXC5CqrCAQ'
    },
    {
      name: 'Dagneux',
      placeId: 'place_id:ChIJQ0yPcUG39EcR3DETwiDxmLE'
    },
    {
      name: 'Montluel',
      placeId: 'place_id:ChIJJ8lL4-a59EcRToCv5v9Ghi4'
    },
  ]
};

const client = new Client();

async function writeInSheet(objects) {
  try {
    const gDoc = new GoogleSpreadsheet(process.env.GSHEET_ID);
    await gDoc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    });
    await gDoc.loadInfo();
    const sheet = gDoc.sheetsByTitle['DATA'];
    await sheet.addRows(objects.map((o) => ({
      'time': o.time,
      'origin': o.origin,
      'destination': o.destination,
      'distance': o.distance,
      'distanceText': o.distanceText,
      'duration': o.duration,
      'durationText': o.durationText,
    })))
    return {error: false}
  } catch (e) {
    console.error(e);
    return {error: true, err: e}
  }
}

async function computeDistanceDuration({ origin, destination }) {
  try {
    const res = await client.directions({
      params: {
        origin,
        destination,
        mode: 'driving',
        language: 'fr',
        units: 'metric',
        key: process.env.GMAPS_API_KEY
      }
    })
    const {distance, duration} = res.data.routes[0].legs[0];
    return {error: false, distance, duration}
  } catch (e) {
    console.error(e);
    return {error: true, err: e}
  }
}

async function main() {
  const now = dayjs().utc('z');
  const allRes = await Promise.all(conf.origins.map(async (origin) => {
    const res = await computeDistanceDuration({
      origin: origin.placeId,
      destination: conf.destination.placeId
    })

    return {
      ...res,
      origin,
      destination: conf.destination
    }
  }));

  const results = allRes.filter((r) => !r.error);

  await writeInSheet(results.map((r) => ({
    time: now.locale('fr').format('DD/MM/YYYY HH:mm'),
    origin: r.origin.name,
    destination: r.destination.name,
    distance: r.distance.value,
    distanceText: r.distance.text,
    duration: r.duration.value,
    durationText: r.duration.text,
  })));

  return true;
}

module.exports = { main }
