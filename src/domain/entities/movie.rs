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
