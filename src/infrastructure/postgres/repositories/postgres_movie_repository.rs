use std::sync::RwLock;

use async_trait::async_trait;

use crate::domain::{entities::movie::Movie, repositories::movie_repository::MovieRepository};

pub struct PostgresMovieRepository {
    movies: RwLock<Vec<Movie>>,
}

#[async_trait]
impl MovieRepository for PostgresMovieRepository {
    async fn find_all(&self) -> Vec<Movie> {
        
    }

    async fn find_by_id(&self, )
}
