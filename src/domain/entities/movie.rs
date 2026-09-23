use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Genre {
    Action,
    Adventure,
    Animation,
    Comedy,
    Crime,
    Documentary,
    Drama,
    Family,
    Fantasy,
    Foreign,
    History,
    Horror,
    Music,
    Mystery,
    Romance,
    ScienceFiction,
    Thriller,
    TvMovie,
    War,
    Western,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Country {
    pub iso_3166_1: String,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SpokenLanguage {
    pub iso_639_1: String,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProductionCompany {
    pub id: u32,
    pub name: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Gender {
    Unspecified,
    Female,
    Male,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CrewMember {
    pub id: u32,
    pub name: String,
    pub gender: Gender,
    pub department: String,
    pub job: String,
    pub credit_id: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MovieStatus {
    Released,
    PostProduction,
    Rumored,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Movie {
    pub index: usize,
    pub budget: u64,
    pub genres: Vec<Genre>,
    pub homepage: Option<String>,
    pub id: u32,
    pub keywords: Vec<String>,
    pub original_language: String,
    pub original_title: String,
    pub overview: Option<String>,
    pub popularity: f32,
    pub production_companies: Vec<ProductionCompany>,
    pub production_countries: Vec<Country>,
    pub release_date: Option<NaiveDate>,
    pub revenue: u64,
    pub runtime: Option<u32>,
    pub spoken_languages: Vec<SpokenLanguage>,
    pub status: MovieStatus,
    pub tagline: Option<String>,
    pub title: String,
    pub vote_average: f32,
    pub vote_count: u32,
    pub cast: Vec<String>,
    pub crew: Vec<CrewMember>,
    pub director: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct MovieUpdate {
    pub budget: Option<u64>,
    pub homepage: Option<String>,
    pub original_language: Option<String>,
    pub original_title: Option<String>,
    pub overview: Option<String>,
    pub popularity: Option<f32>,
    pub release_date: Option<NaiveDate>,
    pub revenue: Option<u64>,
    pub runtime: Option<u32>,
    pub status: Option<MovieStatus>,
    pub tagline: Option<String>,
    pub title: Option<String>,
    pub vote_average: Option<f32>,
    pub vote_count: Option<u32>,
    pub director: Option<String>,
}

impl MovieUpdate {
    pub fn apply_to(self, movie: &mut Movie) {
        if let Some(budget) = self.budget {
            movie.budget = budget;
        }
        if let Some(homepage) = self.homepage {
            movie.homepage = Some(homepage);
        }
        if let Some(original_language) = self.original_language {
            movie.original_language = original_language;
        }
        if let Some(original_title) = self.original_title {
            movie.original_title = original_title;
        }
        if let Some(overview) = self.overview {
            movie.overview = Some(overview);
        }
        if let Some(popularity) = self.popularity {
            movie.popularity = popularity;
        }
        if let Some(release_date) = self.release_date {
            movie.release_date = Some(release_date);
        }
        if let Some(revenue) = self.revenue {
            movie.revenue = revenue;
        }
        if let Some(runtime) = self.runtime {
            movie.runtime = Some(runtime);
        }
        if let Some(status) = self.status {
            movie.status = status;
        }
        if let Some(tagline) = self.tagline {
            movie.tagline = Some(tagline);
        }
        if let Some(title) = self.title {
            movie.title = title;
        }
        if let Some(vote_average) = self.vote_average {
            movie.vote_average = vote_average;
        }
        if let Some(vote_count) = self.vote_count {
            movie.vote_count = vote_count;
        }
        if let Some(director) = self.director {
            movie.director = Some(director);
        }
    }
}
