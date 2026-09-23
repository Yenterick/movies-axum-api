use axum::{Json, Router, response::IntoResponse, routing::get};
use serde_json::{Value, json};

use crate::presentation::api::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/", get(health))
}

#[utoipa::path(
    get,
    path = "/api/v1/health",
    tag = "health",
    responses(
        (status = 200, description = "The API is up and running")
    )
)]
pub(crate) async fn health() -> impl IntoResponse {
    let body: Value = json!({
        "success": true,
        "message": "Movies API is up and running!"
    });
    Json(body)
}
