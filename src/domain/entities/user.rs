use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct User {
    pub id: Option<u32>,
    pub username: String,
    pub password_hash: String,
}
