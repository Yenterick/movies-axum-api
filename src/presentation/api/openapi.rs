use utoipa::OpenApi;

use crate::application::dto::movie_dto::{
    CountryRequest, CountryResponse, CrewMemberRequest, CrewMemberResponse, GenderRequest,
    GenderResponse, GenreRequest, GenreResponse, MovieCreateRequest, MoviePatchRequest,
    MovieResponse, MovieStatusRequest, MovieStatusResponse, ProductionCompanyRequest,
    ProductionCompanyResponse, SpokenLanguageRequest, SpokenLanguageResponse,
};
use crate::presentation::api::routers::{health, movies};

#[derive(OpenApi)]
#[openapi(
    info(title = "Movies API", description = "Basic hexagonal architecture movie catalogue"),
    paths(
        health::health,
        movies::get_all,
        movies::create,
        movies::get_by_id,
        movies::patch,
        movies::delete,
    ),
    components(schemas(
        MovieCreateRequest,
        MoviePatchRequest,
        MovieStatusRequest,
        GenreRequest,
        GenderRequest,
        CountryRequest,
        SpokenLanguageRequest,
        ProductionCompanyRequest,
        CrewMemberRequest,
        MovieResponse,
        MovieStatusResponse,
        GenreResponse,
        GenderResponse,
        CountryResponse,
        SpokenLanguageResponse,
        ProductionCompanyResponse,
        CrewMemberResponse,
    )),
    tags(
        (name = "movies", description = "Movie catalogue operations"),
        (name = "health", description = "Service health checks")
    )
)]
pub struct ApiDoc;
