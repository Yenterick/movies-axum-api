use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::post;
use axum::{Json, Router};

use crate::application::dto::user_dto::{UserCreateRequest, UserLoginRequest, UserResponse};
use crate::presentation::api::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/login", post(login))
        .route("/bootstrap", post(register))
}

#[utoipa::path(
    post,
    path = "/api/v1/users/login",
    tag = "users",
    responses(
        (status = 200, description = "Successfully logged in", body = UserResponse),
        (status = 404, description = "Couldn't fint an user with the credentials")
    )
)]
pub(crate) async fn login(
    State(state): State<AppState>,
    Json(request): Json<UserLoginRequest>,
) -> Result<impl IntoResponse, impl IntoResponse> {
    state
        .user_service
        .login(request)
        .await
        .map(|user| (StatusCode::OK, Json(user)))
}

#[utoipa::path(
    post,
    path = "/api/v1/users/bootstrap",
    tag = "users",
    responses(
        (status = 200, description = "Successfully created a new user", body = UserResponse),
        (status = 409, description = "User already exists")
    )
)]
pub(crate) async fn register(
    State(state): State<AppState>,
    Json(request): Json<UserCreateRequest>,
) -> Result<impl IntoResponse, impl IntoResponse> {
    state
        .user_service
        .register(request)
        .await
        .map(|user| (StatusCode::OK, Json(user)))
}
