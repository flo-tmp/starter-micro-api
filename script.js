const {Client} = require("@googlemaps/google-maps-services-js");
const { GoogleSpreadsheet } = require('google-spreadsheet');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc')
const timezone = require('dayjs/plugin/timezone')
dayjs.extend(utc)
dayjs.extend(timezone)
require('dayjs/locale/fr');

const conf = {
  destination: {
    name: 'Esker',
    placeId: 'place_id:ChIJlyjGPpHq9EcRci0IZ8Aa_Rw'
  },
  origins: [ // calcul des placeIds => https://developers.google.com/maps/documentation/places/web-service/place-id
    {
      name: 'Jonage',
      placeId: 'place_id:ChIJYWOITgK49EcRcRoIOyzL8A8'
    },
    {
      name: 'Miribel',
      placeId: 'place_id:ChIJKTNATuW-9EcRgArC5CqrCAQ'
    },
    {
      name: 'Dagneux',
      placeId: 'place_id:ChIJQ0yPcUG39EcR3DETwiDxmLE'
    },
    {
      name: 'Tramoyes',
      placeId: 'place_id:ChIJtc6azga89EcR2dl2dVbFyNo'
    },
    {
      name: 'Mionnay',
      placeId: 'place_id:ChIJBxzR17m99EcRkArC5CqrCAQ'
    },
    {
      name: 'Les Échets',
      placeId: 'place_id:ChIJTflb3XS-9EcR4G_TYC2rCAo'
    },
    {
      name: 'Saint-André-de-Corcy',
      placeId: 'place_id:ChIJWV7pE-a89EcRtAwjU0fAJFk'
    },
    {
      name: 'Sainte-Croix',
      placeId: 'place_id:ChIJs3qn5We69EcRUAXC5CqrCAQ'
    },
    {
      name: 'Genay',
      placeId: 'place_id:ChIJUfhMAu2W9EcRgBi75CqrCAQ'
    },
    {
      name: 'Cailloux-sur-Fontaines',
      placeId: 'place_id:ChIJ8R4JnZGV9EcRjK_6_YPEfOs'
    },
    {
      name: 'Genas',
      placeId: 'place_id:ChIJsxwEtxLG9EcRkBi75CqrCAQ'
    },
  ],
  ranges: {
    isAller: (d) => { // 7h15 => 7h45
      const h = d.utc().tz('Europe/Paris').hour();
      const m = d.utc().tz('Europe/Paris').minute();
      if (h === 7) {
        return m >= 12 && m <= 48;
      } else {
        return false
      }
    },
    isRetour: (d) => { // 17h45 => 18h15
      const h = d.utc().tz('Europe/Paris').hour();
      const m = d.utc().tz('Europe/Paris').minute();
      if (h === 17) {
        return m >= 42;
      } else if (h === 18) {
        return m <= 18
      } else {
        return false
      }
    }
  }
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
      'type': o.type,
      'time': o.time,
      'origin': o.origin,
      'destination': o.destination,
      'distance': o.distance,
      'distanceText': o.distanceText,
      'duration': o.duration,
      'durationText': o.durationText,
      'durationInTraffic': o.durationInTraffic,
      'durationInTrafficText': o.durationInTrafficText,
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
        departure_time: 'now',
        key: process.env.GMAPS_API_KEY
      }
    })
    const {distance, duration, duration_in_traffic} = res.data.routes[0].legs[0];
    return {error: false, distance, duration, durationInTraffic: duration_in_traffic}
  } catch (e) {
    console.error(e);
    return {error: true, err: e}
  }
}

async function main(headers) {
  if (headers['x-call-protection'] !== process.env.CALL_PROTECTION) {
    console.error('Wrong call protection', callProtection)
    return 'error';
  }

  const now = dayjs();
  let type = conf.ranges.isAller(now) ? 'aller' : (conf.ranges.isRetour(now) ? 'retour' : undefined);
  if (headers['x-bypass-type']) {
    type = headers['x-bypass-type'];
  }

  if (type === undefined) {
    return 'noAllerNorRetour';
  }

  const allRes = await Promise.all(conf.origins.map(async (origin) => {
    let a, b;
    if (type === 'aller') {
      a = origin;
      b = conf.destination;
    } else {
      a = conf.destination;
      b = origin;
    }

    const res = await computeDistanceDuration({
      origin: a.placeId,
      destination: b.placeId
    })

    return {
      ...res,
      origin: a,
      destination: b
    }
  }));

  const results = allRes.filter((r) => !r.error);

  await writeInSheet(results.map((r) => ({
    time: now.utc().tz('Europe/Paris').format('DD/MM/YYYY HH:mm'),
    origin: r.origin.name,
    destination: r.destination.name,
    distance: r.distance.value,
    distanceText: r.distance.text,
    duration: r.duration.value,
    durationText: r.duration.text,
    durationInTraffic: r.durationInTraffic.value,
    durationInTrafficText: r.durationInTraffic.text,
    type,
  })));

  return 'ok';
}

module.exports = { main }
