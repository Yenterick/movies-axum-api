use std::sync::Arc;

use axum::Router;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::application::services::hash_service::Argon2HashService;
use crate::application::services::movie_service::MovieService;
use crate::application::services::user_service::UserService;
use crate::infrastructure::postgres::postgres;
use crate::infrastructure::postgres::repositories::postgres_movie_repository::PostgresMovieRepository;
use crate::infrastructure::postgres::repositories::postgres_user_repository::PostgresUserRepository;
use crate::presentation::api::openapi::ApiDoc;
use crate::presentation::api::routers::{health, movies, users};
use crate::presentation::api::state::AppState;

pub async fn run() -> Router {
    let pool = postgres::initialize_database().await;

    let movie_repository = PostgresMovieRepository::new(pool.clone());
    let user_repository = PostgresUserRepository::new(pool);
    let hasher_service = Argon2HashService::new();
    let movie_service = Arc::new(MovieService::new(Arc::new(movie_repository)));
    let user_service = Arc::new(UserService::new(
        Arc::new(user_repository),
        Arc::new(hasher_service),
    ));
    let state = AppState {
        movie_service,
        user_service,
    };

    let api_router: Router = Router::new()
        .nest("/health", health::router())
        .nest("/movies", movies::router())
        .nest("/users", users::router())
        .with_state(state);

    Router::new().nest("/api/v1", api_router).merge(
        SwaggerUi::new("/api/v1/docs").url("/api/v1/api-docs/openapi.json", ApiDoc::openapi()),
    )
}
