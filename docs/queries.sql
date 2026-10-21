-- Parameters use SQLite named bindings; bind values rather than concatenating SQL.

-- 1. Gallery: generation labels plus an average realism threshold.
SELECT i.image_id, i.intended_age, i.image_url, i.thumb_url,
       s.mean AS realism_mean, s.sd AS realism_sd, s.n AS realism_n
FROM images AS i
JOIN metric_summaries AS s ON s.image_key = i.image_key
JOIN metrics AS m ON m.metric_id = s.metric_id
WHERE m.code = 'Real'
  AND (:ethnicity IS NULL OR i.ethnicity_code = :ethnicity)
  AND (:gender IS NULL OR i.gender_code = :gender)
  AND (:age IS NULL OR i.intended_age = :age)
  AND (:expression IS NULL OR i.expression_code = :expression)
  AND s.mean >= :minimum_mean
ORDER BY s.mean DESC, i.image_id
LIMIT :page_size OFFSET :offset;

-- 2. Image details: source mean, sample SD, and valid-response count.
SELECT m.code, m.label, m.group_name, m.unit, s.mean, s.sd, s.n
FROM images AS i
JOIN metric_summaries AS s ON s.image_key = i.image_key
JOIN metrics AS m ON m.metric_id = s.metric_id
WHERE i.image_id = :image_id
ORDER BY m.metric_id;

-- 3. Distribution from individual responses; zero is retained for age.
SELECT r.score, COUNT(*) AS response_count
FROM ratings AS r
JOIN images AS i ON i.image_key = r.image_key
JOIN metrics AS m ON m.metric_id = r.metric_id
WHERE i.image_id = :image_id AND m.code = :metric_code
GROUP BY r.score
ORDER BY r.score;

-- 4. Inspect anonymous responses to a single image and metric.
SELECT r.response_id, r.score, q.completed, q.progress
FROM ratings AS r
JOIN images AS i ON i.image_key = r.image_key
JOIN metrics AS m ON m.metric_id = r.metric_id
JOIN responses AS q ON q.response_id = r.response_id
WHERE i.image_id = :image_id AND m.code = :metric_code
ORDER BY r.response_id;

-- 5. Coverage: number of images and the range of valid response counts.
SELECT m.code, COUNT(*) AS images, MIN(s.n) AS min_n,
       MAX(s.n) AS max_n, AVG(s.n) AS mean_n
FROM metric_summaries AS s
JOIN images AS i ON i.image_key = s.image_key
JOIN metrics AS m ON m.metric_id = s.metric_id
GROUP BY m.metric_id
ORDER BY m.metric_id;

-- 6. Compare image-level means across intended expression categories.
-- Each image contributes equally here, regardless of its response count.
SELECT i.expression_code, COUNT(*) AS images, AVG(s.mean) AS mean_of_image_means
FROM images AS i
JOIN metric_summaries AS s ON s.image_key = i.image_key
JOIN metrics AS m ON m.metric_id = s.metric_id
WHERE m.code = :metric_code
GROUP BY i.expression_code;

-- 7. Rank images within each intended expression using a window function.
WITH ranked AS (
    SELECT i.image_id, i.expression_code, s.mean, s.n,
           ROW_NUMBER() OVER (
               PARTITION BY i.expression_code ORDER BY s.mean DESC, i.image_id
           ) AS rank_within_expression
    FROM images AS i
    JOIN metric_summaries AS s ON s.image_key = i.image_key
    JOIN metrics AS m ON m.metric_id = s.metric_id
    WHERE m.code = :metric_code
)
SELECT * FROM ranked WHERE rank_within_expression <= :top_k
ORDER BY expression_code, rank_within_expression;

-- 8. Reconcile source summaries with raw scores (sample variance = SD squared).
SELECT i.image_id, m.code, s.n AS source_n, v.n AS calculated_n,
       ABS(s.mean - v.mean) AS mean_difference,
       ABS(s.sd * s.sd - v.sample_variance) AS variance_difference
FROM rating_statistics AS v
JOIN metric_summaries AS s USING (image_key, metric_id)
JOIN images AS i USING (image_key)
JOIN metrics AS m USING (metric_id)
WHERE s.n <> v.n
   OR ABS(s.mean - v.mean) > 0.00000001
   OR ABS(s.sd * s.sd - v.sample_variance) > 0.00000001;

-- 9. A missing observation is not a zero. LEFT JOIN can expose missing summaries.
SELECT i.image_id, m.code
FROM images AS i CROSS JOIN metrics AS m
LEFT JOIN metric_summaries AS s
  ON s.image_key = i.image_key AND s.metric_id = m.metric_id
WHERE s.image_key IS NULL;

-- 10. Audit the documented inclusion of partial questionnaire responses.
SELECT q.completed, COUNT(DISTINCT q.response_id) AS responses_with_scores,
       COUNT(*) AS score_count
FROM responses AS q
JOIN ratings AS r ON r.response_id = q.response_id
GROUP BY q.completed;
