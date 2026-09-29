use async_trait::async_trait;

use crate::domain::entities::user::User;
use crate::domain::errors::UserError;

#[async_trait]
pub trait UserRepository: Send + Sync {
    async fn find_by_username(&self, username: &str) -> Result<Option<User>, UserError>;
    async fn create(&self, user: User) -> Result<User, UserError>;
}
