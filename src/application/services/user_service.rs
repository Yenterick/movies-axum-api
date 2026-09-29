use std::sync::Arc;

use crate::application::dto::user_dto::{UserCreateRequest, UserLoginRequest, UserResponse};
use crate::application::services::hash_service::HashService;
use crate::domain::entities::user::User;
use crate::domain::errors::UserError;
use crate::domain::repositories::user_repository::UserRepository;

#[derive(Clone)]
pub struct UserService {
    repository: Arc<dyn UserRepository>,
    hash_service: Arc<dyn HashService>,
}

impl UserService {
    pub fn new(repository: Arc<dyn UserRepository>, hash_service: Arc<dyn HashService>) -> Self {
        Self {
            repository,
            hash_service,
        }
    }

    pub async fn login(&self, request: UserLoginRequest) -> Result<UserResponse, UserError> {
        let user = self
            .repository
            .find_by_username(&request.username)
            .await?
            .ok_or_else(|| UserError::NotFound(request.username.clone()))?;

        if !self
            .hash_service
            .verify_password(&request.password, &user.password_hash)
        {
            return Err(UserError::NotFound(request.username));
        }

        Ok(UserResponse {
            id: user.id,
            username: user.username,
            token: None,
        })
    }

    pub async fn register(&self, request: UserCreateRequest) -> Result<UserResponse, UserError> {
        let password_hash = self
            .hash_service
            .hash_password(&request.password)
            .map_err(|error| UserError::RepositoryError(error.to_string()))?;

        let user = User {
            id: None,
            username: request.username,
            password_hash,
        };

        self.repository.create(user).await.map(|user| UserResponse {
            id: user.id,
            username: user.username,
            token: None,
        })
    }
}
