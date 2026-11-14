CREATE TABLE health_facilities (
  id        SERIAL PRIMARY KEY,
  name      VARCHAR(150) NOT NULL,
  type      VARCHAR(30) NOT NULL CHECK (type IN ('Hospital','Clinic','Pharmacy','Medical Store')),
  ownership VARCHAR(20),
  area      TEXT,
  phone     VARCHAR(30),
  geom      GEOMETRY(Point, 4326) NOT NULL
);
CREATE INDEX idx_health_geom ON health_facilities USING GIST (geom);