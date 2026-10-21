PRAGMA foreign_keys = ON;
PRAGMA user_version = 2;

CREATE TABLE images (
    image_key INTEGER PRIMARY KEY,
    image_id TEXT NOT NULL UNIQUE,
    ethnicity_code TEXT NOT NULL CHECK (ethnicity_code IN ('A','B','W','L','S','N','M','P')),
    gender_code TEXT NOT NULL CHECK (gender_code IN ('B','G')),
    intended_age INTEGER NOT NULL CHECK (intended_age > 0),
    expression_code TEXT NOT NULL CHECK (expression_code IN ('S','F','A')),
    sequence_code TEXT NOT NULL,
    image_url TEXT NOT NULL,
    thumb_url TEXT NOT NULL
);

CREATE TABLE metrics (
    metric_id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    group_name TEXT NOT NULL,
    scale_min REAL NOT NULL,
    scale_max REAL,
    unit TEXT NOT NULL,
    CHECK (scale_max IS NULL OR scale_max >= scale_min)
);

-- These are anonymous questionnaire responses, not identified people.
CREATE TABLE responses (
    response_id INTEGER PRIMARY KEY,
    completed INTEGER NOT NULL CHECK (completed IN (0,1)),
    progress INTEGER NOT NULL CHECK (progress BETWEEN 0 AND 100)
);

CREATE TABLE ratings (
    image_key INTEGER NOT NULL REFERENCES images(image_key),
    metric_id INTEGER NOT NULL REFERENCES metrics(metric_id),
    response_id INTEGER NOT NULL REFERENCES responses(response_id),
    score REAL NOT NULL CHECK (score >= 0),
    PRIMARY KEY (image_key, metric_id, response_id)
) WITHOUT ROWID;

-- Published source summaries remain available as a reproducible reference.
CREATE TABLE metric_summaries (
    image_key INTEGER NOT NULL REFERENCES images(image_key),
    metric_id INTEGER NOT NULL REFERENCES metrics(metric_id),
    mean REAL NOT NULL,
    sd REAL NOT NULL CHECK (sd >= 0),
    n INTEGER NOT NULL CHECK (n > 1),
    PRIMARY KEY (image_key, metric_id)
) WITHOUT ROWID;

CREATE INDEX images_categories ON images
    (ethnicity_code, gender_code, intended_age, expression_code);
CREATE INDEX summaries_metric_mean ON metric_summaries (metric_id, mean, image_key);
CREATE INDEX ratings_response ON ratings (response_id, image_key);

CREATE TRIGGER ratings_validate_scale BEFORE INSERT ON ratings
BEGIN
    SELECT CASE WHEN NEW.score < (SELECT scale_min FROM metrics WHERE metric_id=NEW.metric_id)
        OR NEW.score > (SELECT scale_max FROM metrics WHERE metric_id=NEW.metric_id)
        THEN RAISE(ABORT, 'Score outside metric scale') END;
END;

-- The sample variance uses n-1. Clients can take its square root for SD.
-- Using a view makes the published summary independently reproducible in SQL.
CREATE VIEW rating_statistics AS
SELECT image_key, metric_id, COUNT(*) AS n, AVG(score) AS mean,
       CASE WHEN COUNT(*) > 1 THEN
           MAX(0.0, (SUM(score * score) - SUM(score) * SUM(score) / COUNT(*)) / (COUNT(*) - 1))
       ELSE NULL END AS sample_variance
FROM ratings
GROUP BY image_key, metric_id;
