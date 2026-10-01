use utoipa::OpenApi;

use crate::application::dto::movie_dto::{
    CountryRequest, CountryResponse, CrewMemberRequest, CrewMemberResponse, GenderRequest,
    GenderResponse, GenreRequest, GenreResponse, MovieCreateRequest, MoviePatchRequest,
    MovieResponse, MovieStatusRequest, MovieStatusResponse, ProductionCompanyRequest,
    ProductionCompanyResponse, SpokenLanguageRequest, SpokenLanguageResponse,
};
use crate::application::dto::user_dto::{UserCreateRequest, UserLoginRequest, UserResponse};
use crate::presentation::api::routers::{health, movies, users};

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
        users::login,
        users::register,
    ),
    components(schemas(
        UserCreateRequest,
        UserLoginRequest,
        UserResponse,
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
        (name = "users", description = "Users authentication operations"),
        (name = "movies", description = "Movie catalogue operations"),
        (name = "health", description = "Service health checks")
    )
)]
pub struct ApiDoc;
