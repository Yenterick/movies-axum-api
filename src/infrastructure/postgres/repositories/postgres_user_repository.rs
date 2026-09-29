use async_trait::async_trait;
use sqlx::{FromRow, PgPool};

use crate::domain::entities::user::User;
use crate::domain::errors::UserError;
use crate::domain::repositories::user_repository::UserRepository;

pub struct PostgresUserRepository {
    pool: PgPool,
}

impl PostgresUserRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl UserRepository for PostgresUserRepository {
    async fn find_by_username(&self, username: &str) -> Result<Option<User>, UserError> {
        let row = sqlx::query_as::<_, UserRow>(
            "SELECT id, username, password_hash FROM users WHERE username = $1",
        )
        .bind(username)
        .fetch_optional(&self.pool)
        .await
        .map_err(db_error)?;

        Ok(row.map(Into::into))
    }

    async fn create(&self, user: User) -> Result<User, UserError> {
        let username = user.username.clone();

        let row = sqlx::query_as::<_, UserRow>(
            "INSERT INTO users (username, password_hash) VALUES ($1, $2) \
             RETURNING id, username, password_hash",
        )
        .bind(user.username)
        .bind(user.password_hash)
        .fetch_one(&self.pool)
        .await
        .map_err(|error| {
            if is_unique_violation(&error) {
                UserError::AlreadyExists(username.clone())
            } else {
                db_error(error)
            }
        })?;

        Ok(row.into())
    }
}

fn is_unique_violation(error: &sqlx::Error) -> bool {
    matches!(error, sqlx::Error::Database(db_error) if db_error.code().as_deref() == Some("23505"))
}

fn db_error(error: sqlx::Error) -> UserError {
    UserError::RepositoryError(error.to_string())
}

#[derive(FromRow)]
struct UserRow {
    id: i32,
    username: String,
    password_hash: String,
}

impl From<UserRow> for User {
    fn from(row: UserRow) -> Self {
        User {
            id: Some(row.id as u32),
            username: row.username,
            password_hash: row.password_hash,
        }
    }
}
