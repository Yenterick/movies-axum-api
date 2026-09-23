use async_trait::async_trait;

use crate::domain::entities::movie::{Movie, MovieUpdate};
use crate::domain::errors::MovieError;

#[async_trait]
pub trait MovieRepository: Send + Sync {
    async fn find_all(&self) -> Vec<Movie>;
    async fn find_by_id(&self, id: u32) -> Option<Movie>;
    async fn create(&self, movie: Movie) -> Result<Movie, MovieError>;
    async fn update(&self, id: u32, update: MovieUpdate) -> Result<Movie, MovieError>;
    async fn delete(&self, id: u32) -> Result<(), MovieError>;
}
