use std::sync::Arc;

use crate::application::services::{movie_service::MovieService, user_service::UserService};

#[derive(Clone)]
pub struct AppState {
    pub movie_service: Arc<MovieService>,
    pub user_service: Arc<UserService>,
}
