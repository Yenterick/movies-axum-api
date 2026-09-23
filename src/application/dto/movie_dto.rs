use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};

use crate::domain::entities::movie::{
    Country, CrewMember, Gender, Genre, Movie, MovieStatus, MovieUpdate, ProductionCompany,
    SpokenLanguage,
};

#[derive(Debug, Deserialize, IntoParams)]
pub struct MovieListQuery {
    #[serde(default = "default_limit")]
    #[param(example = 10)]
    pub limit: usize,
    #[serde(default)]
    #[param(example = 0)]
    pub offset: usize,
}

fn default_limit() -> usize {
    10
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct MoviePatchRequest {
    pub budget: Option<u64>,
    pub homepage: Option<String>,
    pub original_language: Option<String>,
    pub original_title: Option<String>,
    pub overview: Option<String>,
    pub popularity: Option<f32>,
    pub release_date: Option<NaiveDate>,
    pub revenue: Option<u64>,
    pub runtime: Option<u32>,
    pub status: Option<MovieStatusRequest>,
    pub tagline: Option<String>,
    pub title: Option<String>,
    pub vote_average: Option<f32>,
    pub vote_count: Option<u32>,
    pub director: Option<String>,
}

impl From<MoviePatchRequest> for MovieUpdate {
    fn from(request: MoviePatchRequest) -> Self {
        MovieUpdate {
            budget: request.budget,
            homepage: request.homepage,
            original_language: request.original_language,
            original_title: request.original_title,
            overview: request.overview,
            popularity: request.popularity,
            release_date: request.release_date,
            revenue: request.revenue,
            runtime: request.runtime,
            status: request.status.map(Into::into),
            tagline: request.tagline,
            title: request.title,
            vote_average: request.vote_average,
            vote_count: request.vote_count,
            director: request.director,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, ToSchema)]
pub enum MovieStatusRequest {
    Released,
    PostProduction,
    Rumored,
}

impl From<MovieStatusRequest> for MovieStatus {
    fn from(status: MovieStatusRequest) -> Self {
        match status {
            MovieStatusRequest::Released => MovieStatus::Released,
            MovieStatusRequest::PostProduction => MovieStatus::PostProduction,
            MovieStatusRequest::Rumored => MovieStatus::Rumored,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, ToSchema)]
pub enum GenreRequest {
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

impl From<GenreRequest> for Genre {
    fn from(genre: GenreRequest) -> Self {
        match genre {
            GenreRequest::Action => Genre::Action,
            GenreRequest::Adventure => Genre::Adventure,
            GenreRequest::Animation => Genre::Animation,
            GenreRequest::Comedy => Genre::Comedy,
            GenreRequest::Crime => Genre::Crime,
            GenreRequest::Documentary => Genre::Documentary,
            GenreRequest::Drama => Genre::Drama,
            GenreRequest::Family => Genre::Family,
            GenreRequest::Fantasy => Genre::Fantasy,
            GenreRequest::Foreign => Genre::Foreign,
            GenreRequest::History => Genre::History,
            GenreRequest::Horror => Genre::Horror,
            GenreRequest::Music => Genre::Music,
            GenreRequest::Mystery => Genre::Mystery,
            GenreRequest::Romance => Genre::Romance,
            GenreRequest::ScienceFiction => Genre::ScienceFiction,
            GenreRequest::Thriller => Genre::Thriller,
            GenreRequest::TvMovie => Genre::TvMovie,
            GenreRequest::War => Genre::War,
            GenreRequest::Western => Genre::Western,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, ToSchema)]
pub struct CountryRequest {
    pub iso_3166_1: String,
    pub name: String,
}

impl From<CountryRequest> for Country {
    fn from(country: CountryRequest) -> Self {
        Country {
            iso_3166_1: country.iso_3166_1,
            name: country.name,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, ToSchema)]
pub struct SpokenLanguageRequest {
    pub iso_639_1: String,
    pub name: String,
}

impl From<SpokenLanguageRequest> for SpokenLanguage {
    fn from(spoken_language: SpokenLanguageRequest) -> Self {
        SpokenLanguage {
            iso_639_1: spoken_language.iso_639_1,
            name: spoken_language.name,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, ToSchema)]
pub struct ProductionCompanyRequest {
    pub id: u32,
    pub name: String,
}

impl From<ProductionCompanyRequest> for ProductionCompany {
    fn from(production_company: ProductionCompanyRequest) -> Self {
        ProductionCompany {
            id: production_company.id,
            name: production_company.name,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, ToSchema)]
pub enum GenderRequest {
    Unspecified,
    Female,
    Male,
}

impl From<GenderRequest> for Gender {
    fn from(gender: GenderRequest) -> Self {
        match gender {
            GenderRequest::Unspecified => Gender::Unspecified,
            GenderRequest::Female => Gender::Female,
            GenderRequest::Male => Gender::Male,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, ToSchema)]
pub struct CrewMemberRequest {
    pub id: u32,
    pub name: String,
    pub gender: GenderRequest,
    pub department: String,
    pub job: String,
    pub credit_id: String,
}

impl From<CrewMemberRequest> for CrewMember {
    fn from(crew_member: CrewMemberRequest) -> Self {
        CrewMember {
            id: crew_member.id,
            name: crew_member.name,
            gender: crew_member.gender.into(),
            department: crew_member.department,
            job: crew_member.job,
            credit_id: crew_member.credit_id,
        }
    }
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct MovieCreateRequest {
    pub id: u32,
    pub budget: u64,
    pub genres: Vec<GenreRequest>,
    pub homepage: Option<String>,
    pub keywords: Vec<String>,
    pub original_language: String,
    pub original_title: String,
    pub overview: Option<String>,
    pub popularity: f32,
    pub production_companies: Vec<ProductionCompanyRequest>,
    pub production_countries: Vec<CountryRequest>,
    pub release_date: Option<NaiveDate>,
    pub revenue: u64,
    pub runtime: Option<u32>,
    pub spoken_languages: Vec<SpokenLanguageRequest>,
    pub status: MovieStatusRequest,
    pub tagline: Option<String>,
    pub title: String,
    pub vote_average: f32,
    pub vote_count: u32,
    pub cast: Vec<String>,
    pub crew: Vec<CrewMemberRequest>,
    pub director: Option<String>,
}

impl From<MovieCreateRequest> for Movie {
    fn from(request: MovieCreateRequest) -> Self {
        Movie {
            index: 0,
            budget: request.budget,
            genres: request.genres.into_iter().map(Into::into).collect(),
            homepage: request.homepage,
            id: request.id,
            keywords: request.keywords,
            original_language: request.original_language,
            original_title: request.original_title,
            overview: request.overview,
            popularity: request.popularity,
            production_companies: request
                .production_companies
                .into_iter()
                .map(Into::into)
                .collect(),
            production_countries: request
                .production_countries
                .into_iter()
                .map(Into::into)
                .collect(),
            release_date: request.release_date,
            revenue: request.revenue,
            runtime: request.runtime,
            spoken_languages: request
                .spoken_languages
                .into_iter()
                .map(Into::into)
                .collect(),
            status: request.status.into(),
            tagline: request.tagline,
            title: request.title,
            vote_average: request.vote_average,
            vote_count: request.vote_count,
            cast: request.cast,
            crew: request.crew.into_iter().map(Into::into).collect(),
            director: request.director,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, ToSchema)]
pub enum GenreResponse {
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

impl From<Genre> for GenreResponse {
    fn from(genre: Genre) -> Self {
        match genre {
            Genre::Action => GenreResponse::Action,
            Genre::Adventure => GenreResponse::Adventure,
            Genre::Animation => GenreResponse::Animation,
            Genre::Comedy => GenreResponse::Comedy,
            Genre::Crime => GenreResponse::Crime,
            Genre::Documentary => GenreResponse::Documentary,
            Genre::Drama => GenreResponse::Drama,
            Genre::Family => GenreResponse::Family,
            Genre::Fantasy => GenreResponse::Fantasy,
            Genre::Foreign => GenreResponse::Foreign,
            Genre::History => GenreResponse::History,
            Genre::Horror => GenreResponse::Horror,
            Genre::Music => GenreResponse::Music,
            Genre::Mystery => GenreResponse::Mystery,
            Genre::Romance => GenreResponse::Romance,
            Genre::ScienceFiction => GenreResponse::ScienceFiction,
            Genre::Thriller => GenreResponse::Thriller,
            Genre::TvMovie => GenreResponse::TvMovie,
            Genre::War => GenreResponse::War,
            Genre::Western => GenreResponse::Western,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, ToSchema)]
pub struct CountryResponse {
    pub iso_3166_1: String,
    pub name: String,
}

impl From<Country> for CountryResponse {
    fn from(country: Country) -> Self {
        CountryResponse {
            iso_3166_1: country.iso_3166_1,
            name: country.name,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, ToSchema)]
pub struct SpokenLanguageResponse {
    pub iso_639_1: String,
    pub name: String,
}

impl From<SpokenLanguage> for SpokenLanguageResponse {
    fn from(spoken_language: SpokenLanguage) -> Self {
        SpokenLanguageResponse {
            iso_639_1: spoken_language.iso_639_1,
            name: spoken_language.name,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, ToSchema)]
pub struct ProductionCompanyResponse {
    pub id: u32,
    pub name: String,
}

impl From<ProductionCompany> for ProductionCompanyResponse {
    fn from(production_company: ProductionCompany) -> Self {
        ProductionCompanyResponse {
            id: production_company.id,
            name: production_company.name,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, ToSchema)]
pub enum GenderResponse {
    Unspecified,
    Female,
    Male,
}

impl From<Gender> for GenderResponse {
    fn from(gender: Gender) -> Self {
        match gender {
            Gender::Unspecified => GenderResponse::Unspecified,
            Gender::Female => GenderResponse::Female,
            Gender::Male => GenderResponse::Male,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, ToSchema)]
pub struct CrewMemberResponse {
    pub id: u32,
    pub name: String,
    pub gender: GenderResponse,
    pub department: String,
    pub job: String,
    pub credit_id: String,
}

impl From<CrewMember> for CrewMemberResponse {
    fn from(crew_member: CrewMember) -> Self {
        CrewMemberResponse {
            id: crew_member.id,
            name: crew_member.name,
            gender: crew_member.gender.into(),
            department: crew_member.department,
            job: crew_member.job,
            credit_id: crew_member.credit_id,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, ToSchema)]
pub enum MovieStatusResponse {
    Released,
    PostProduction,
    Rumored,
}

impl From<MovieStatus> for MovieStatusResponse {
    fn from(status: MovieStatus) -> Self {
        match status {
            MovieStatus::Released => MovieStatusResponse::Released,
            MovieStatus::PostProduction => MovieStatusResponse::PostProduction,
            MovieStatus::Rumored => MovieStatusResponse::Rumored,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, ToSchema)]
pub struct MovieResponse {
    pub budget: u64,
    pub genres: Vec<GenreResponse>,
    pub homepage: Option<String>,
    pub id: u32,
    pub keywords: Vec<String>,
    pub original_language: String,
    pub original_title: String,
    pub overview: Option<String>,
    pub popularity: f32,
    pub production_companies: Vec<ProductionCompanyResponse>,
    pub production_countries: Vec<CountryResponse>,
    pub release_date: Option<NaiveDate>,
    pub revenue: u64,
    pub runtime: Option<u32>,
    pub spoken_languages: Vec<SpokenLanguageResponse>,
    pub status: MovieStatusResponse,
    pub tagline: Option<String>,
    pub title: String,
    pub vote_average: f32,
    pub vote_count: u32,
    pub cast: Vec<String>,
    pub crew: Vec<CrewMemberResponse>,
    pub director: Option<String>,
}

impl From<Movie> for MovieResponse {
    fn from(movie: Movie) -> Self {
        MovieResponse {
            budget: movie.budget,
            genres: movie.genres.into_iter().map(Into::into).collect(),
            homepage: movie.homepage,
            id: movie.id,
            keywords: movie.keywords,
            original_language: movie.original_language,
            original_title: movie.original_title,
            overview: movie.overview,
            popularity: movie.popularity,
            production_companies: movie
                .production_companies
                .into_iter()
                .map(Into::into)
                .collect(),
            production_countries: movie
                .production_countries
                .into_iter()
                .map(Into::into)
                .collect(),
            release_date: movie.release_date,
            revenue: movie.revenue,
            runtime: movie.runtime,
            spoken_languages: movie.spoken_languages.into_iter().map(Into::into).collect(),
            status: movie.status.into(),
            tagline: movie.tagline,
            title: movie.title,
            vote_average: movie.vote_average,
            vote_count: movie.vote_count,
            cast: movie.cast,
            crew: movie.crew.into_iter().map(Into::into).collect(),
            director: movie.director,
        }
    }
}
