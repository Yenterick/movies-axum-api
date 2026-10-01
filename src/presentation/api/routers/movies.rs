use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::routing::{get, patch, post};
use axum::{Json, Router};

use crate::application::dto::movie_dto::{
    MovieCreateRequest, MovieListQuery, MoviePatchRequest, MovieResponse,
};
use crate::infrastructure::auth::middleware::jwt_auth;
use crate::presentation::api::state::AppState;

pub fn router() -> Router<AppState> {
    let protected = Router::new()
        .route("/", post(create))
        .route("/{id}", patch(update).delete(delete))
        .route_layer(middleware::from_fn(jwt_auth));

    Router::new()
        .route("/", get(get_all))
        .route("/{id}", get(get_by_id))
        .merge(protected)
}

#[utoipa::path(
    get,
    path = "/api/v1/movies",
    tag = "movies",
    params(MovieListQuery),
    responses(
        (status = 200, description = "List of movies", body = [MovieResponse])
    )
)]
pub(crate) async fn get_all(
    State(state): State<AppState>,
    Query(query): Query<MovieListQuery>,
) -> impl IntoResponse {
    Json(state.movie_service.get_all(query).await)
}

#[utoipa::path(
    post,
    path = "/api/v1/movies",
    tag = "movies",
    request_body = MovieCreateRequest,
    security(("bearer_auth" = [])),
    responses(
        (status = 201, description = "The movie was created", body = MovieResponse),
        (status = 409, description = "A movie with the given id already exists"),
        (status = 401, description = "Unauthorized, invalid or expired token")
    )
)]
pub(crate) async fn create(
    State(state): State<AppState>,
    Json(request): Json<MovieCreateRequest>,
) -> Result<impl IntoResponse, impl IntoResponse> {
    state
        .movie_service
        .create(request)
        .await
        .map(|movie| (StatusCode::CREATED, Json(movie)))
}

#[utoipa::path(
    get,
    path = "/api/v1/movies/{id}",
    tag = "movies",
    params(("id" = u32, Path, description = "Movie id")),
    responses(
        (status = 200, description = "The movie was found", body = MovieResponse),
        (status = 404, description = "No movie exists with the given id")
    )
)]
pub(crate) async fn get_by_id(
    State(state): State<AppState>,
    Path(id): Path<u32>,
) -> Result<impl IntoResponse, impl IntoResponse> {
    state.movie_service.get_by_id(id).await.map(Json)
}

#[utoipa::path(
    patch,
    path = "/api/v1/movies/{id}",
    tag = "movies",
    params(("id" = u32, Path, description = "Movie id")),
    request_body = MoviePatchRequest,
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "The movie was updated", body = MovieResponse),
        (status = 404, description = "No movie exists with the given id"),
        (status = 401, description = "Unauthorized, invalid or expired token")
    )
)]
pub(crate) async fn update(
    State(state): State<AppState>,
    Path(id): Path<u32>,
    Json(request): Json<MoviePatchRequest>,
) -> Result<impl IntoResponse, impl IntoResponse> {
    state.movie_service.patch(id, request).await.map(Json)
}

#[utoipa::path(
    delete,
    path = "/api/v1/movies/{id}",
    tag = "movies",
    params(("id" = u32, Path, description = "Movie id")),
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "The movie was deleted"),
        (status = 404, description = "No movie exists with the given id"),
        (status = 401, description = "Unauthorized, invalid or expired token")
    )
)]
pub(crate) async fn delete(
    State(state): State<AppState>,
    Path(id): Path<u32>,
) -> Result<impl IntoResponse, impl IntoResponse> {
    state.movie_service.delete(id).await
}
