use std::sync::Arc;

use crate::application::dto::movie_dto::{
    MovieCreateRequest, MovieListQuery, MoviePatchRequest, MovieResponse,
};
use crate::domain::errors::MovieError;
use crate::domain::repositories::movie_repository::MovieRepository;

#[derive(Clone)]
pub struct MovieService {
    repository: Arc<dyn MovieRepository>,
}

impl MovieService {
    pub fn new(repository: Arc<dyn MovieRepository>) -> Self {
        Self { repository }
    }

    pub async fn get_all(&self, query: MovieListQuery) -> Vec<MovieResponse> {
        self.repository
            .find_all()
            .await
            .into_iter()
            .skip(query.offset)
            .take(query.limit)
            .map(Into::into)
            .collect()
    }

    pub async fn get_by_id(&self, id: u32) -> Result<MovieResponse, MovieError> {
        self.repository
            .find_by_id(id)
            .await
            .ok_or(MovieError::NotFound(id))
            .map(Into::into)
    }

    pub async fn create(&self, request: MovieCreateRequest) -> Result<MovieResponse, MovieError> {
        self.repository.create(request.into()).await.map(Into::into)
    }

    pub async fn patch(
        &self,
        id: u32,
        request: MoviePatchRequest,
    ) -> Result<MovieResponse, MovieError> {
        self.repository
            .update(id, request.into())
            .await
            .map(Into::into)
    }

    pub async fn delete(&self, id: u32) -> Result<(), MovieError> {
        self.repository.delete(id).await
    }
}
