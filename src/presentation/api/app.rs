use std::sync::Arc;

use axum::Router;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::application::services::movie_service::MovieService;
use crate::infrastructure::repositories::csv_movie_repository::CsvMovieRepository;
use crate::presentation::api::openapi::ApiDoc;
use crate::presentation::api::routers::{health, movies};
use crate::presentation::api::state::AppState;

pub async fn run() -> Router {
    let movie_repository = CsvMovieRepository::from_csv_file("db/movies.csv");
    let movie_service = Arc::new(MovieService::new(Arc::new(movie_repository)));
    let state = AppState { movie_service };

    let api_router: Router = Router::new()
        .nest("/health", health::router())
        .nest("/movies", movies::router())
        .with_state(state);

    Router::new().nest("/api/v1", api_router).merge(
        SwaggerUi::new("/api/v1/docs").url("/api/v1/api-docs/openapi.json", ApiDoc::openapi()),
    )
}
