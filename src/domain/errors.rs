use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MovieError {
    NotFound(u32),
    AlreadyExists(u32),
    RepositoryError(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UserError {
    NotFound(String),
    AlreadyExists(String),
    RepositoryError(String),
}

impl fmt::Display for MovieError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            MovieError::NotFound(id) => write!(f, "movie with id {id} not found"),
            MovieError::AlreadyExists(id) => write!(f, "movie with id {id} already exists"),
            MovieError::RepositoryError(message) => write!(f, "repository error: {message}"),
        }
    }
}

impl fmt::Display for UserError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            UserError::NotFound(username) => write!(f, "user with id {username} not found"),
            UserError::AlreadyExists(username) => {
                write!(f, "user with id {username} already exists")
            }
            UserError::RepositoryError(message) => write!(f, "repository error: {message}"),
        }
    }
}

impl std::error::Error for MovieError {}
impl std::error::Error for UserError {}
