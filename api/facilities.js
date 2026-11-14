const { Pool } = require('pg');

// No SSL for a local database; SSL is required for the cloud database (Neon)
const url = process.env.DATABASE_URL || '';
const pool = new Pool({
  connectionString: url,
  ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
});

module.exports = async (req, res) => {
  try {
    const { lat, lon } = req.query;
    const hasPos = lat && lon;
    // ST_AsGeoJSON converts the geometry to GeoJSON, which Leaflet reads directly
    const sql = `
      SELECT json_build_object('type','FeatureCollection','features',
        COALESCE(json_agg(json_build_object(
          'type','Feature',
          'geometry', ST_AsGeoJSON(geom)::json,
          'properties', json_build_object(
            'id',id,'name',name,'type',type,'ownership',ownership,'area',area,'phone',phone
            ${hasPos ? ",'distance_km', round((ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($1::float,$2::float),4326)::geography)/1000)::numeric,2)" : ''}
          ))), '[]'::json)) AS fc
      FROM health_facilities`;
    const { rows } = await pool.query(sql, hasPos ? [lon, lat] : []);
    res.status(200).json(rows[0].fc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};