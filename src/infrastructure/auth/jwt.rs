use jsonwebtoken::{
    DecodingKey, EncodingKey, Header, Validation, decode, encode, errors::ErrorKind,
};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::domain::errors::AuthError;
use crate::infrastructure::auth::claims::Claims;

fn secret() -> String {
    std::env::var("JWT_SECRET_KEY").expect("JWT_SECRET_KEY environment variable must be set!")
}

pub fn create_token(user_id: &str) -> Result<String, jsonwebtoken::errors::Error> {
    let expiry = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as usize
        + 3600;

    let claims = Claims {
        sub: user_id.to_string(),
        exp: expiry,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret().as_bytes()),
    )
}

pub fn validate_token(token: &str) -> Result<Claims, AuthError> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret().as_bytes()),
        &Validation::default(),
    )
    .map(|data| data.claims)
    .map_err(|error| match error.kind() {
        ErrorKind::ExpiredSignature => AuthError::Expired,
        _ => AuthError::Invalid,
    })
}
