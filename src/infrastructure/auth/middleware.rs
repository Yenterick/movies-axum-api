use axum::{extract::Request, http::header, middleware::Next, response::Response};

use crate::domain::errors::AuthError;
use crate::infrastructure::auth::jwt::validate_token;

pub async fn jwt_auth(mut req: Request, next: Next) -> Result<Response, AuthError> {
    let auth_header = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok());

    let token = match auth_header {
        Some(header) if header.starts_with("Bearer ") => &header["Bearer ".len()..],
        _ => return Err(AuthError::Missing),
    };

    let claims = validate_token(token)?;
    req.extensions_mut().insert(claims);
    Ok(next.run(req).await)
}
