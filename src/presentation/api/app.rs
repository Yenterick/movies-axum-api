use axum::Router;

use crate::presentation::api::routers::health;
use crate::presentation::api::state::AppState;

pub async fn run() -> Router {
    let state: AppState = AppState {};

    let api_router: Router = Router::new()
        .nest("/health", health::router())
        .with_state(state);

    Router::new().nest("/api/v1", api_router)
}
