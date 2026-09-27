use axum::Json;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde_json::json;

use crate::domain::errors::MovieError;

impl IntoResponse for MovieError {
    fn into_response(self) -> Response {
        let status = match self {
            MovieError::NotFound(_) => StatusCode::NOT_FOUND,
            MovieError::AlreadyExists(_) => StatusCode::CONFLICT,
            MovieError::RepositoryError(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };

        (
            status,
            Json(json!({ "success": false, "message": self.to_string() })),
        )
            .into_response()
    }
}
