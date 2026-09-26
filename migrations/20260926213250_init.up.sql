-- Add up migration script here
CREATE TABLE IF NOT EXISTS movies (
    id BIGINT PRIMARY KEY,
    index BIGINT,
    budget BIGINT,
    homepage TEXT,
    original_language VARCHAR(100),
    original_title TEXT,
    overview TEXT,
    popularity DOUBLE PRECISION,
    release_date DATE,
    revenue BIGINT,
    runtime DOUBLE PRECISION,
    status VARCHAR(100),
    tagline TEXT,
    title TEXT,
    vote_average DOUBLE PRECISION,
    vote_count BIGINT
);

CREATE TABLE IF NOT EXISTS genres (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS movie_genres (
    movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
    genre_id INT REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, genre_id)
);

CREATE TABLE IF NOT EXISTS keywords (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS movie_keywords (
    movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
    keyword_id INT REFERENCES keywords(id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, keyword_id)
);

CREATE TABLE IF NOT EXISTS production_companies (
    id BIGINT PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS movie_production_companies (
    movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
    company_id BIGINT REFERENCES production_companies(id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, company_id)
);

CREATE TABLE IF NOT EXISTS production_countries (
    iso_3166_1 VARCHAR(10) PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS movie_production_countries (
    movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
    country_iso VARCHAR(10) REFERENCES production_countries(iso_3166_1) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, country_iso)
);

CREATE TABLE IF NOT EXISTS spoken_languages (
    iso_639_1 VARCHAR(10) PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS movie_spoken_languages (
    movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
    language_iso VARCHAR(10) REFERENCES spoken_languages(iso_639_1) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, language_iso)
);

CREATE TABLE IF NOT EXISTS people (
    id BIGINT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    gender INT
);

CREATE TABLE IF NOT EXISTS movie_cast (
    movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
    person_id BIGINT REFERENCES people(id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, person_id)
);

CREATE TABLE IF NOT EXISTS movie_crew (
    credit_id VARCHAR(100) PRIMARY KEY,
    movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
    person_id BIGINT REFERENCES people(id) ON DELETE CASCADE,
    department VARCHAR(255),
    job VARCHAR(255)
);
