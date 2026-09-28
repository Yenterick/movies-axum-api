mod application;
mod domain;
mod infrastructure;
mod presentation;
mod scripts;

use crate::presentation::api::app;

#[tokio::main]
async fn main() {
    let mut args = std::env::args();
    args.next();

    if let Some("seed") = args.next().as_deref() {
        let csv_path = args.next().unwrap_or_else(|| "db/movies.csv".to_string());
        scripts::csv_to_postgres::run(&csv_path).await;
        return;
    }

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    println!("Server starting on 0.0.0.0:3000!");
    axum::serve(listener, app::run().await).await.unwrap();
}
