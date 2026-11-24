use std::collections::HashMap;

use async_trait::async_trait;
use chrono::NaiveDate;
use sqlx::{FromRow, PgConnection, PgPool, Postgres, QueryBuilder};

use crate::domain::entities::movie::{
    Country, CrewMember, Gender, Genre, Movie, MovieStatus, ProductionCompany, SpokenLanguage,
};
use crate::domain::repositories::movie_repository::{MovieFilter, MovieRepository};
use crate::domain::{entities::movie::MovieUpdate, errors::MovieError};

pub struct PostgresMovieRepository {
    pool: PgPool,
}

impl PostgresMovieRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    async fn hydrate(&self, rows: Vec<MovieRow>) -> Result<Vec<Movie>, MovieError> {
        if rows.is_empty() {
            return Ok(Vec::new());
        }

        let ids: Vec<i64> = rows.iter().map(|row| row.id).collect();

        let mut genres_by_movie: HashMap<i64, Vec<Genre>> = HashMap::new();
        for row in sqlx::query_as::<_, GenreRow>(
            r#"SELECT mg.movie_id, g.name
               FROM movie_genres mg
               JOIN genres g ON g.id = mg.genre_id
               WHERE mg.movie_id = ANY($1)"#,
        )
        .bind(&ids)
        .fetch_all(&self.pool)
        .await
        .map_err(db_error)?
        {
            if let Some(genre) = parse_genre(&row.name) {
                genres_by_movie.entry(row.movie_id).or_default().push(genre);
            }
        }

        let mut keywords_by_movie: HashMap<i64, Vec<String>> = HashMap::new();
        for row in sqlx::query_as::<_, KeywordRow>(
            r#"SELECT mk.movie_id, k.name
               FROM movie_keywords mk
               JOIN keywords k ON k.id = mk.keyword_id
               WHERE mk.movie_id = ANY($1)"#,
        )
        .bind(&ids)
        .fetch_all(&self.pool)
        .await
        .map_err(db_error)?
        {
            keywords_by_movie
                .entry(row.movie_id)
                .or_default()
                .push(row.name);
        }

        let mut companies_by_movie: HashMap<i64, Vec<ProductionCompany>> = HashMap::new();
        for row in sqlx::query_as::<_, CompanyRow>(
            r#"SELECT mpc.movie_id, pc.id, pc.name
               FROM movie_production_companies mpc
               JOIN production_companies pc ON pc.id = mpc.company_id
               WHERE mpc.movie_id = ANY($1)"#,
        )
        .bind(&ids)
        .fetch_all(&self.pool)
        .await
        .map_err(db_error)?
        {
            companies_by_movie
                .entry(row.movie_id)
                .or_default()
                .push(ProductionCompany {
                    id: row.id as u32,
                    name: row.name,
                });
        }

        let mut countries_by_movie: HashMap<i64, Vec<Country>> = HashMap::new();
        for row in sqlx::query_as::<_, CountryRow>(
            r#"SELECT mpc.movie_id, c.iso_3166_1, c.name
               FROM movie_production_countries mpc
               JOIN production_countries c ON c.iso_3166_1 = mpc.country_iso
               WHERE mpc.movie_id = ANY($1)"#,
        )
        .bind(&ids)
        .fetch_all(&self.pool)
        .await
        .map_err(db_error)?
        {
            countries_by_movie
                .entry(row.movie_id)
                .or_default()
                .push(Country {
                    iso_3166_1: row.iso_3166_1,
                    name: row.name,
                });
        }

        let mut languages_by_movie: HashMap<i64, Vec<SpokenLanguage>> = HashMap::new();
        for row in sqlx::query_as::<_, LanguageRow>(
            r#"SELECT msl.movie_id, l.iso_639_1, l.name
               FROM movie_spoken_languages msl
               JOIN spoken_languages l ON l.iso_639_1 = msl.language_iso
               WHERE msl.movie_id = ANY($1)"#,
        )
        .bind(&ids)
        .fetch_all(&self.pool)
        .await
        .map_err(db_error)?
        {
            languages_by_movie
                .entry(row.movie_id)
                .or_default()
                .push(SpokenLanguage {
                    iso_639_1: row.iso_639_1,
                    name: row.name,
                });
        }

        let mut cast_by_movie: HashMap<i64, Vec<String>> = HashMap::new();
        for row in sqlx::query_as::<_, CastRow>(
            r#"SELECT mc.movie_id, p.name
               FROM movie_cast mc
               JOIN people p ON p.id = mc.person_id
               WHERE mc.movie_id = ANY($1)"#,
        )
        .bind(&ids)
        .fetch_all(&self.pool)
        .await
        .map_err(db_error)?
        {
            cast_by_movie
                .entry(row.movie_id)
                .or_default()
                .push(row.name);
        }

        let mut crew_by_movie: HashMap<i64, Vec<CrewMember>> = HashMap::new();
        for row in sqlx::query_as::<_, CrewRow>(
            r#"SELECT mc.movie_id, p.id AS person_id, p.name, p.gender, mc.department, mc.job, mc.credit_id
               FROM movie_crew mc
               JOIN people p ON p.id = mc.person_id
               WHERE mc.movie_id = ANY($1)"#,
        )
        .bind(&ids)
        .fetch_all(&self.pool)
        .await
        .map_err(db_error)?
        {
            crew_by_movie
                .entry(row.movie_id)
                .or_default()
                .push(CrewMember {
                    id: row.person_id as u32,
                    name: row.name,
                    gender: parse_gender(row.gender.unwrap_or_default()),
                    department: row.department.unwrap_or_default(),
                    job: row.job.unwrap_or_default(),
                    credit_id: row.credit_id,
                });
        }

        Ok(rows
            .into_iter()
            .map(|row| {
                let id = row.id;
                let genres = genres_by_movie.remove(&id).unwrap_or_default();
                let keywords = keywords_by_movie.remove(&id).unwrap_or_default();
                let production_companies = companies_by_movie.remove(&id).unwrap_or_default();
                let production_countries = countries_by_movie.remove(&id).unwrap_or_default();
                let spoken_languages = languages_by_movie.remove(&id).unwrap_or_default();
                let cast = cast_by_movie.remove(&id).unwrap_or_default();
                let crew = crew_by_movie.remove(&id).unwrap_or_default();
                let director = crew
                    .iter()
                    .find(|member| member.job.eq_ignore_ascii_case("director"))
                    .map(|member| member.name.clone());

                assemble_movie(
                    row,
                    genres,
                    keywords,
                    production_companies,
                    production_countries,
                    spoken_languages,
                    cast,
                    crew,
                    director,
                )
            })
            .collect())
    }
}

const MOVIE_COLUMNS: &str = "id, index, budget, homepage, original_language, original_title, \
    overview, popularity, release_date, revenue, runtime, status, tagline, title, vote_average, \
    vote_count";

#[async_trait]
impl MovieRepository for PostgresMovieRepository {
    async fn find_all(&self) -> Result<Vec<Movie>, MovieError> {
        let sql = format!("SELECT {MOVIE_COLUMNS} FROM movies");
        let rows = sqlx::query_as::<_, MovieRow>(sqlx::AssertSqlSafe(sql))
            .fetch_all(&self.pool)
            .await
            .map_err(db_error)?;

        self.hydrate(rows).await
    }

    async fn find_paginated(&self, limit: usize, offset: usize, filter: &MovieFilter) -> Vec<Movie> {
        let mut builder: QueryBuilder<Postgres> =
            QueryBuilder::new(format!("SELECT {MOVIE_COLUMNS} FROM movies WHERE 1 = 1"));

        if let Some(genre) = filter.genre {
            builder.push(
                " AND EXISTS (SELECT 1 FROM movie_genres mg \
                  JOIN genres g ON g.id = mg.genre_id \
                  WHERE mg.movie_id = movies.id AND g.name = ",
            );
            builder.push_bind(genre_to_str(genre));
            builder.push(")");
        }

        if let Some(keyword) = &filter.keyword {
            builder.push(
                " AND EXISTS (SELECT 1 FROM movie_keywords mk \
                  JOIN keywords k ON k.id = mk.keyword_id \
                  WHERE mk.movie_id = movies.id AND k.name ILIKE ",
            );
            builder.push_bind(like_pattern(keyword));
            builder.push(")");
        }

        if let Some(language) = &filter.language {
            builder.push(" AND LOWER(original_language) = LOWER(");
            builder.push_bind(language.clone());
            builder.push(")");
        }

        if let Some(country) = &filter.country {
            builder.push(
                " AND EXISTS (SELECT 1 FROM movie_production_countries mpc \
                  JOIN production_countries c ON c.iso_3166_1 = mpc.country_iso \
                  WHERE mpc.movie_id = movies.id AND (c.iso_3166_1 ILIKE ",
            );
            builder.push_bind(country.clone());
            builder.push(" OR c.name ILIKE ");
            builder.push_bind(like_pattern(country));
            builder.push("))");
        }

        if let Some(search) = &filter.search {
            builder.push(" AND (title ILIKE ");
            builder.push_bind(like_pattern(search));
            builder.push(" OR original_title ILIKE ");
            builder.push_bind(like_pattern(search));
            builder.push(")");
        }

        builder.push(" ORDER BY id LIMIT ");
        builder.push_bind(limit as i64);
        builder.push(" OFFSET ");
        builder.push_bind(offset as i64);

        let rows = builder
            .build_query_as::<MovieRow>()
            .fetch_all(&self.pool)
            .await
            .unwrap_or_default();

        self.hydrate(rows).await.unwrap_or_default()
    }

    async fn find_by_id(&self, id: u32) -> Result<Option<Movie>, MovieError> {
        let sql = format!("SELECT {MOVIE_COLUMNS} FROM movies WHERE id = $1");
        let row = sqlx::query_as::<_, MovieRow>(sqlx::AssertSqlSafe(sql))
            .bind(id as i64)
            .fetch_optional(&self.pool)
            .await
            .map_err(db_error)?;

        match row {
            Some(row) => Ok(self.hydrate(vec![row]).await?.into_iter().next()),
            None => Ok(None),
        }
    }

    async fn create(&self, movie: Movie) -> Result<Movie, MovieError> {
        let mut tx = self.pool.begin().await.map_err(db_error)?;

        let sql = format!(
            "INSERT INTO movies ({MOVIE_COLUMNS}) \
             VALUES (COALESCE(NULLIF($1, 0), (SELECT COALESCE(MAX(id), 0) + 1 FROM movies)), \
                     $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) \
             RETURNING {MOVIE_COLUMNS}"
        );

        let row = sqlx::query_as::<_, MovieRow>(sqlx::AssertSqlSafe(sql))
            .bind(movie.id as i64)
            .bind(movie.index as i64)
            .bind(movie.budget as i64)
            .bind(&movie.homepage)
            .bind(&movie.original_language)
            .bind(&movie.original_title)
            .bind(&movie.overview)
            .bind(movie.popularity as f64)
            .bind(movie.release_date)
            .bind(movie.revenue as i64)
            .bind(movie.runtime.map(|value| value as f64))
            .bind(status_to_str(movie.status))
            .bind(&movie.tagline)
            .bind(&movie.title)
            .bind(movie.vote_average as f64)
            .bind(movie.vote_count as i64)
            .fetch_one(&mut *tx)
            .await
            .map_err(db_error)?;

        let movie_id = row.id;

        replace_genres(&mut tx, movie_id, &movie.genres).await?;
        replace_keywords(&mut tx, movie_id, &movie.keywords).await?;
        replace_companies(&mut tx, movie_id, &movie.production_companies).await?;
        replace_countries(&mut tx, movie_id, &movie.production_countries).await?;
        replace_languages(&mut tx, movie_id, &movie.spoken_languages).await?;
        replace_cast(&mut tx, movie_id, &movie.cast).await?;

        for crew_member in &movie.crew {
            sqlx::query(
                "INSERT INTO people (id, name, gender) VALUES ($1, $2, $3) \
                 ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, gender = EXCLUDED.gender",
            )
            .bind(crew_member.id as i64)
            .bind(&crew_member.name)
            .bind(gender_to_i32(crew_member.gender))
            .execute(&mut *tx)
            .await
            .map_err(db_error)?;

            sqlx::query(
                "INSERT INTO movie_crew (credit_id, movie_id, person_id, department, job) \
                 VALUES ($1, $2, $3, $4, $5) \
                 ON CONFLICT (credit_id) DO UPDATE SET \
                    movie_id = EXCLUDED.movie_id, person_id = EXCLUDED.person_id, \
                    department = EXCLUDED.department, job = EXCLUDED.job",
            )
            .bind(&crew_member.credit_id)
            .bind(movie_id)
            .bind(crew_member.id as i64)
            .bind(&crew_member.department)
            .bind(&crew_member.job)
            .execute(&mut *tx)
            .await
            .map_err(db_error)?;
        }

        // A director given without a matching crew entry (the usual case for the admin form)
        // still has to land in movie_crew, which is where reads look for it.
        let crew_has_director = movie
            .crew
            .iter()
            .any(|member| member.job.eq_ignore_ascii_case("director"));
        if !crew_has_director && let Some(director) = &movie.director {
            replace_director(&mut tx, movie_id, director).await?;
        }

        tx.commit().await.map_err(db_error)?;

        // Re-read so the response reflects what was actually stored.
        self.find_by_id(movie_id as u32)
            .await?
            .ok_or(MovieError::NotFound(movie_id as u32))
    }

    async fn update(&self, id: u32, update: MovieUpdate) -> Result<Movie, MovieError> {
        let mut tx = self.pool.begin().await.map_err(db_error)?;

        let movie_id = sqlx::query_scalar::<_, i64>(
            "UPDATE movies SET \
                budget = COALESCE($2, budget), \
                homepage = COALESCE($3, homepage), \
                original_language = COALESCE($4, original_language), \
                original_title = COALESCE($5, original_title), \
                overview = COALESCE($6, overview), \
                popularity = COALESCE($7, popularity), \
                release_date = COALESCE($8, release_date), \
                revenue = COALESCE($9, revenue), \
                runtime = COALESCE($10, runtime), \
                status = COALESCE($11, status), \
                tagline = COALESCE($12, tagline), \
                title = COALESCE($13, title), \
                vote_average = COALESCE($14, vote_average), \
                vote_count = COALESCE($15, vote_count) \
             WHERE id = $1 \
             RETURNING id",
        )
        .bind(id as i64)
        .bind(update.budget.map(|value| value as i64))
        .bind(update.homepage)
        .bind(update.original_language)
        .bind(update.original_title)
        .bind(update.overview)
        .bind(update.popularity.map(|value| value as f64))
        .bind(update.release_date)
        .bind(update.revenue.map(|value| value as i64))
        .bind(update.runtime.map(|value| value as f64))
        .bind(update.status.map(status_to_str))
        .bind(update.tagline)
        .bind(update.title)
        .bind(update.vote_average.map(|value| value as f64))
        .bind(update.vote_count.map(|value| value as i64))
        .fetch_optional(&mut *tx)
        .await
        .map_err(db_error)?
        .ok_or(MovieError::NotFound(id))?;

        if let Some(genres) = &update.genres {
            replace_genres(&mut tx, movie_id, genres).await?;
        }
        if let Some(keywords) = &update.keywords {
            replace_keywords(&mut tx, movie_id, keywords).await?;
        }
        if let Some(companies) = &update.production_companies {
            replace_companies(&mut tx, movie_id, companies).await?;
        }
        if let Some(countries) = &update.production_countries {
            replace_countries(&mut tx, movie_id, countries).await?;
        }
        if let Some(languages) = &update.spoken_languages {
            replace_languages(&mut tx, movie_id, languages).await?;
        }
        if let Some(cast) = &update.cast {
            replace_cast(&mut tx, movie_id, cast).await?;
        }
        if let Some(director) = &update.director {
            replace_director(&mut tx, movie_id, director).await?;
        }

        tx.commit().await.map_err(db_error)?;

        self.find_by_id(id).await?.ok_or(MovieError::NotFound(id))
    }

    async fn delete(&self, id: u32) -> Result<(), MovieError> {
        let result = sqlx::query("DELETE FROM movies WHERE id = $1")
            .bind(id as i64)
            .execute(&self.pool)
            .await
            .map_err(db_error)?;

        if result.rows_affected() == 0 {
            return Err(MovieError::NotFound(id));
        }

        Ok(())
    }
}

// ---------- Relation writers ----------
// Each one replaces a movie's links for one relation, upserting the related rows it needs.
// They run inside the caller's transaction so a failed write never leaves half a movie.

async fn replace_genres(
    conn: &mut PgConnection,
    movie_id: i64,
    genres: &[Genre],
) -> Result<(), MovieError> {
    sqlx::query("DELETE FROM movie_genres WHERE movie_id = $1")
        .bind(movie_id)
        .execute(&mut *conn)
        .await
        .map_err(db_error)?;

    for genre in genres {
        let genre_id = sqlx::query_scalar::<_, i32>(
            "INSERT INTO genres (name) VALUES ($1) \
             ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name \
             RETURNING id",
        )
        .bind(genre_to_str(*genre))
        .fetch_one(&mut *conn)
        .await
        .map_err(db_error)?;

        sqlx::query(
            "INSERT INTO movie_genres (movie_id, genre_id) VALUES ($1, $2) \
             ON CONFLICT DO NOTHING",
        )
        .bind(movie_id)
        .bind(genre_id)
        .execute(&mut *conn)
        .await
        .map_err(db_error)?;
    }

    Ok(())
}

async fn replace_keywords(
    conn: &mut PgConnection,
    movie_id: i64,
    keywords: &[String],
) -> Result<(), MovieError> {
    sqlx::query("DELETE FROM movie_keywords WHERE movie_id = $1")
        .bind(movie_id)
        .execute(&mut *conn)
        .await
        .map_err(db_error)?;

    for keyword in keywords.iter().map(|k| k.trim()).filter(|k| !k.is_empty()) {
        let keyword_id = sqlx::query_scalar::<_, i32>(
            "INSERT INTO keywords (name) VALUES ($1) \
             ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name \
             RETURNING id",
        )
        .bind(keyword)
        .fetch_one(&mut *conn)
        .await
        .map_err(db_error)?;

        sqlx::query(
            "INSERT INTO movie_keywords (movie_id, keyword_id) VALUES ($1, $2) \
             ON CONFLICT DO NOTHING",
        )
        .bind(movie_id)
        .bind(keyword_id)
        .execute(&mut *conn)
        .await
        .map_err(db_error)?;
    }

    Ok(())
}

async fn replace_companies(
    conn: &mut PgConnection,
    movie_id: i64,
    companies: &[ProductionCompany],
) -> Result<(), MovieError> {
    sqlx::query("DELETE FROM movie_production_companies WHERE movie_id = $1")
        .bind(movie_id)
        .execute(&mut *conn)
        .await
        .map_err(db_error)?;

    for company in companies {
        sqlx::query(
            "INSERT INTO production_companies (id, name) VALUES ($1, $2) \
             ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name",
        )
        .bind(company.id as i64)
        .bind(&company.name)
        .execute(&mut *conn)
        .await
        .map_err(db_error)?;

        sqlx::query(
            "INSERT INTO movie_production_companies (movie_id, company_id) VALUES ($1, $2) \
             ON CONFLICT DO NOTHING",
        )
        .bind(movie_id)
        .bind(company.id as i64)
        .execute(&mut *conn)
        .await
        .map_err(db_error)?;
    }

    Ok(())
}

async fn replace_countries(
    conn: &mut PgConnection,
    movie_id: i64,
    countries: &[Country],
) -> Result<(), MovieError> {
    sqlx::query("DELETE FROM movie_production_countries WHERE movie_id = $1")
        .bind(movie_id)
        .execute(&mut *conn)
        .await
        .map_err(db_error)?;

    for country in countries {
        sqlx::query(
            "INSERT INTO production_countries (iso_3166_1, name) VALUES ($1, $2) \
             ON CONFLICT (iso_3166_1) DO UPDATE SET name = EXCLUDED.name",
        )
        .bind(&country.iso_3166_1)
        .bind(&country.name)
        .execute(&mut *conn)
        .await
        .map_err(db_error)?;

        sqlx::query(
            "INSERT INTO movie_production_countries (movie_id, country_iso) VALUES ($1, $2) \
             ON CONFLICT DO NOTHING",
        )
        .bind(movie_id)
        .bind(&country.iso_3166_1)
        .execute(&mut *conn)
        .await
        .map_err(db_error)?;
    }

    Ok(())
}

async fn replace_languages(
    conn: &mut PgConnection,
    movie_id: i64,
    languages: &[SpokenLanguage],
) -> Result<(), MovieError> {
    sqlx::query("DELETE FROM movie_spoken_languages WHERE movie_id = $1")
        .bind(movie_id)
        .execute(&mut *conn)
        .await
        .map_err(db_error)?;

    for language in languages {
        sqlx::query(
            "INSERT INTO spoken_languages (iso_639_1, name) VALUES ($1, $2) \
             ON CONFLICT (iso_639_1) DO UPDATE SET name = EXCLUDED.name",
        )
        .bind(&language.iso_639_1)
        .bind(&language.name)
        .execute(&mut *conn)
        .await
        .map_err(db_error)?;

        sqlx::query(
            "INSERT INTO movie_spoken_languages (movie_id, language_iso) VALUES ($1, $2) \
             ON CONFLICT DO NOTHING",
        )
        .bind(movie_id)
        .bind(&language.iso_639_1)
        .execute(&mut *conn)
        .await
        .map_err(db_error)?;
    }

    Ok(())
}

async fn replace_cast(
    conn: &mut PgConnection,
    movie_id: i64,
    cast: &[String],
) -> Result<(), MovieError> {
    sqlx::query("DELETE FROM movie_cast WHERE movie_id = $1")
        .bind(movie_id)
        .execute(&mut *conn)
        .await
        .map_err(db_error)?;

    for name in cast.iter().map(|n| n.trim()).filter(|n| !n.is_empty()) {
        let person_id = find_or_create_person(conn, name).await?;
        sqlx::query(
            "INSERT INTO movie_cast (movie_id, person_id) VALUES ($1, $2) \
             ON CONFLICT DO NOTHING",
        )
        .bind(movie_id)
        .bind(person_id)
        .execute(&mut *conn)
        .await
        .map_err(db_error)?;
    }

    Ok(())
}

/// Replaces the movie's director credit; an empty name just removes it.
async fn replace_director(
    conn: &mut PgConnection,
    movie_id: i64,
    name: &str,
) -> Result<(), MovieError> {
    sqlx::query("DELETE FROM movie_crew WHERE movie_id = $1 AND job ILIKE 'director'")
        .bind(movie_id)
        .execute(&mut *conn)
        .await
        .map_err(db_error)?;

    let name = name.trim();
    if name.is_empty() {
        return Ok(());
    }

    let person_id = find_or_create_person(conn, name).await?;
    sqlx::query(
        "INSERT INTO movie_crew (credit_id, movie_id, person_id, department, job) \
         VALUES ($1, $2, $3, 'Directing', 'Director') \
         ON CONFLICT (credit_id) DO UPDATE SET person_id = EXCLUDED.person_id",
    )
    .bind(format!("director-{movie_id}"))
    .bind(movie_id)
    .bind(person_id)
    .execute(&mut *conn)
    .await
    .map_err(db_error)?;

    Ok(())
}

/// People have no natural key besides their TMDB id, so match by exact name and mint a new
/// id for anyone not in the dataset yet.
async fn find_or_create_person(conn: &mut PgConnection, name: &str) -> Result<i64, MovieError> {
    let existing = sqlx::query_scalar::<_, i64>("SELECT id FROM people WHERE name = $1 LIMIT 1")
        .bind(name)
        .fetch_optional(&mut *conn)
        .await
        .map_err(db_error)?;
    if let Some(id) = existing {
        return Ok(id);
    }

    // Serialise id allocation so two concurrent writes can't mint the same one.
    sqlx::query("LOCK TABLE people IN SHARE ROW EXCLUSIVE MODE")
        .execute(&mut *conn)
        .await
        .map_err(db_error)?;

    sqlx::query_scalar::<_, i64>(
        "INSERT INTO people (id, name, gender) \
         VALUES ((SELECT COALESCE(MAX(id), 0) + 1 FROM people), $1, 0) \
         RETURNING id",
    )
    .bind(name)
    .fetch_one(&mut *conn)
    .await
    .map_err(db_error)
}

fn db_error(error: sqlx::Error) -> MovieError {
    MovieError::RepositoryError(error.to_string())
}

fn like_pattern(raw: &str) -> String {
    let escaped = raw.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_");
    format!("%{escaped}%")
}

#[derive(FromRow)]
struct MovieRow {
    id: i64,
    index: Option<i64>,
    budget: Option<i64>,
    homepage: Option<String>,
    original_language: Option<String>,
    original_title: Option<String>,
    overview: Option<String>,
    popularity: Option<f64>,
    release_date: Option<NaiveDate>,
    revenue: Option<i64>,
    runtime: Option<f64>,
    status: Option<String>,
    tagline: Option<String>,
    title: Option<String>,
    vote_average: Option<f64>,
    vote_count: Option<i64>,
}

#[derive(FromRow)]
struct GenreRow {
    movie_id: i64,
    name: String,
}

#[derive(FromRow)]
struct KeywordRow {
    movie_id: i64,
    name: String,
}

#[derive(FromRow)]
struct CompanyRow {
    movie_id: i64,
    id: i64,
    name: String,
}

#[derive(FromRow)]
struct CountryRow {
    movie_id: i64,
    iso_3166_1: String,
    name: String,
}

#[derive(FromRow)]
struct LanguageRow {
    movie_id: i64,
    iso_639_1: String,
    name: String,
}

#[derive(FromRow)]
struct CastRow {
    movie_id: i64,
    name: String,
}

#[derive(FromRow)]
struct CrewRow {
    movie_id: i64,
    person_id: i64,
    name: String,
    gender: Option<i32>,
    department: Option<String>,
    job: Option<String>,
    credit_id: String,
}

#[allow(clippy::too_many_arguments)]
fn assemble_movie(
    row: MovieRow,
    genres: Vec<Genre>,
    keywords: Vec<String>,
    production_companies: Vec<ProductionCompany>,
    production_countries: Vec<Country>,
    spoken_languages: Vec<SpokenLanguage>,
    cast: Vec<String>,
    crew: Vec<CrewMember>,
    director: Option<String>,
) -> Movie {
    Movie {
        index: row.index.unwrap_or_default().max(0) as usize,
        budget: row.budget.unwrap_or_default().max(0) as u64,
        genres,
        homepage: row.homepage,
        id: row.id as u32,
        keywords,
        original_language: row.original_language.unwrap_or_default(),
        original_title: row.original_title.unwrap_or_default(),
        overview: row.overview,
        popularity: row.popularity.unwrap_or_default() as f32,
        production_companies,
        production_countries,
        release_date: row.release_date,
        revenue: row.revenue.unwrap_or_default().max(0) as u64,
        runtime: row.runtime.map(|value| value as u32),
        spoken_languages,
        status: parse_status(row.status.as_deref().unwrap_or_default()),
        tagline: row.tagline,
        title: row.title.unwrap_or_default(),
        vote_average: row.vote_average.unwrap_or_default() as f32,
        vote_count: row.vote_count.unwrap_or_default().max(0) as u32,
        cast,
        crew,
        director,
    }
}

pub(crate) fn parse_genre(name: &str) -> Option<Genre> {
    match name {
        "Action" => Some(Genre::Action),
        "Adventure" => Some(Genre::Adventure),
        "Animation" => Some(Genre::Animation),
        "Comedy" => Some(Genre::Comedy),
        "Crime" => Some(Genre::Crime),
        "Documentary" => Some(Genre::Documentary),
        "Drama" => Some(Genre::Drama),
        "Family" => Some(Genre::Family),
        "Fantasy" => Some(Genre::Fantasy),
        "Foreign" => Some(Genre::Foreign),
        "History" => Some(Genre::History),
        "Horror" => Some(Genre::Horror),
        "Music" => Some(Genre::Music),
        "Mystery" => Some(Genre::Mystery),
        "Romance" => Some(Genre::Romance),
        "Science Fiction" => Some(Genre::ScienceFiction),
        "Thriller" => Some(Genre::Thriller),
        "TV Movie" => Some(Genre::TvMovie),
        "War" => Some(Genre::War),
        "Western" => Some(Genre::Western),
        _ => None,
    }
}

fn parse_status(raw: &str) -> MovieStatus {
    match raw {
        "Released" => MovieStatus::Released,
        "Rumored" => MovieStatus::Rumored,
        _ => MovieStatus::PostProduction,
    }
}

pub(crate) fn genre_to_str(genre: Genre) -> &'static str {
    match genre {
        Genre::Action => "Action",
        Genre::Adventure => "Adventure",
        Genre::Animation => "Animation",
        Genre::Comedy => "Comedy",
        Genre::Crime => "Crime",
        Genre::Documentary => "Documentary",
        Genre::Drama => "Drama",
        Genre::Family => "Family",
        Genre::Fantasy => "Fantasy",
        Genre::Foreign => "Foreign",
        Genre::History => "History",
        Genre::Horror => "Horror",
        Genre::Music => "Music",
        Genre::Mystery => "Mystery",
        Genre::Romance => "Romance",
        Genre::ScienceFiction => "Science Fiction",
        Genre::Thriller => "Thriller",
        Genre::TvMovie => "TV Movie",
        Genre::War => "War",
        Genre::Western => "Western",
    }
}

fn gender_to_i32(gender: Gender) -> i32 {
    match gender {
        Gender::Unspecified => 0,
        Gender::Female => 1,
        Gender::Male => 2,
    }
}

fn status_to_str(status: MovieStatus) -> &'static str {
    match status {
        MovieStatus::Released => "Released",
        MovieStatus::Rumored => "Rumored",
        MovieStatus::PostProduction => "Post Production",
    }
}

fn parse_gender(value: i32) -> Gender {
    match value {
        1 => Gender::Female,
        2 => Gender::Male,
        _ => Gender::Unspecified,
    }
}
