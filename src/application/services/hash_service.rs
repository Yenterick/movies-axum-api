use argon2::{Argon2, PasswordHasher, PasswordVerifier};

pub trait HashService: Send + Sync {
    fn hash_password(&self, password: &str) -> Result<String, argon2::password_hash::Error>;
    fn verify_password(&self, password: &str, stored_hash: &str) -> bool;
}

pub struct Argon2HashService;

impl Argon2HashService {
    pub fn new() -> Self {
        Self
    }
}

impl HashService for Argon2HashService {
    fn hash_password(&self, password: &str) -> Result<String, argon2::password_hash::Error> {
        Ok(Argon2::default()
            .hash_password(password.as_bytes())?
            .to_string())
    }

    fn verify_password(&self, password: &str, stored_hash: &str) -> bool {
        Argon2::default()
            .verify_password(password.as_bytes(), stored_hash)
            .is_ok()
    }
}
