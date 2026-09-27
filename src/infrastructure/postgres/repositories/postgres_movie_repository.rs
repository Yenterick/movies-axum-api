use std::collections::HashMap;

use async_trait::async_trait;
use chrono::NaiveDate;
use sqlx::{FromRow, PgPool};

use crate::domain::entities::movie::{
    Country, CrewMember, Gender, Genre, Movie, MovieStatus, ProductionCompany, SpokenLanguage,
};
use crate::domain::repositories::movie_repository::MovieRepository;
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
            cast_by_movie.entry(row.movie_id).or_default().push(row.name);
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

    async fn find_paginated(&self, limit: usize, offset: usize) -> Vec<Movie> {
        let sql = format!("SELECT {MOVIE_COLUMNS} FROM movies ORDER BY id LIMIT $1 OFFSET $2");
        let rows = sqlx::query_as::<_, MovieRow>(sqlx::AssertSqlSafe(sql))
            .bind(limit as i64)
            .bind(offset as i64)
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

    async fn create(&self, _movie: Movie) -> Result<Movie, MovieError> {
        unimplemented!("PostgresMovieRepository::create is not implemented yet")
    }

    async fn update(&self, _id: u32, _update: MovieUpdate) -> Result<Movie, MovieError> {
        unimplemented!("PostgresMovieRepository::update is not implemented yet")
    }

    async fn delete(&self, _id: u32) -> Result<(), MovieError> {
        unimplemented!("PostgresMovieRepository::delete is not implemented yet")
    }
}

fn db_error(error: sqlx::Error) -> MovieError {
    MovieError::RepositoryError(error.to_string())
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

fn parse_genre(name: &str) -> Option<Genre> {
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

fn parse_gender(value: i32) -> Gender {
    match value {
        1 => Gender::Female,
        2 => Gender::Male,
        _ => Gender::Unspecified,
    }
}
