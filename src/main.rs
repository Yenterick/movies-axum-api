mod domain;
mod presentation;

use crate::presentation::api::app;

#[tokio::main]
async fn main() {
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    println!("Server started successfully at 0.0.0.0:3000!");
    axum::serve(listener, app::run().await).await.unwrap();
}
