use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MovieError {
    NotFound(u32),
    AlreadyExists(u32),
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

impl std::error::Error for MovieError {}
