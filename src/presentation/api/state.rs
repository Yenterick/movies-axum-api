use std::sync::Arc;

use crate::application::services::movie_service::MovieService;

#[derive(Clone)]
pub struct AppState {
    pub movie_service: Arc<MovieService>,
}
